const TEAM_ID = /^[\w-]+$/;

function clip(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanBid(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > 9999999) return null;
  const rounded = Math.round(num * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function cleanTeams(input) {
  if (!Array.isArray(input)) return null;
  const teams = [];
  for (const team of input.slice(0, 12)) {
    if (!team || typeof team !== "object") continue;
    const id = clip(team.id, 40);
    const name = clip(team.name, 40);
    if (!TEAM_ID.test(id) || !name) continue;
    teams.push({ id, name });
  }
  return teams.length ? teams : null;
}

function cleanBids(input) {
  const bids = {};
  if (!input || typeof input !== "object") return bids;
  for (const [id, value] of Object.entries(input)) {
    const bid = cleanBid(value);
    if (bid && TEAM_ID.test(id)) bids[id] = bid;
  }
  return bids;
}

function emptyRoom() {
  return { teams: [], bids: {} };
}

export class PriceRoomDO {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.room = emptyRoom();
    this.loaded = ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get("room");
      if (!stored || typeof stored !== "object") return;
      this.room = {
        teams: cleanTeams(stored.teams) || [],
        bids: cleanBids(stored.bids),
      };
    });
  }

  async fetch(request) {
    await this.loaded;
    if (request.headers.get("Upgrade") !== "websocket") {
      return Response.json({ ok: true, teams: this.room.teams, bids: this.room.bids });
    }

    const url = new URL(request.url);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      role: url.searchParams.get("role") === "host" ? "host" : "player",
    });
    this.safeSend(server, this.snapshot());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    await this.loaded;
    let data;
    try {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      data = JSON.parse(text);
    } catch {
      return;
    }
    if (!data || typeof data.type !== "string") return;
    const host = (ws.deserializeAttachment() || {}).role === "host";

    if (data.type === "JOIN") {
      this.safeSend(ws, this.snapshot());
      return;
    }

    if (data.type === "SYNC_TEAMS") {
      if (!host) return;
      const teams = cleanTeams(data.teams);
      if (!teams) return;
      this.room.teams = teams;
      const allowed = new Set(teams.map((team) => team.id));
      for (const id of Object.keys(this.room.bids)) {
        if (!allowed.has(id)) delete this.room.bids[id];
      }
      await this.persist();
      this.broadcast();
      return;
    }

    if (data.type === "SUBMIT_BID") {
      const teamId = clip(data.teamId, 40);
      const bid = cleanBid(data.bid);
      if (!bid || !TEAM_ID.test(teamId)) return;
      if (this.room.teams.length && !this.room.teams.some((team) => team.id === teamId)) return;
      this.room.bids[teamId] = bid;
      await this.persist();
      this.broadcast();
      return;
    }

    if (data.type === "CLEAR_BIDS") {
      if (!host) return;
      const echo = {};
      for (const team of this.room.teams) echo[team.id] = "";
      this.room.bids = {};
      await this.persist();
      this.broadcast(echo);
    }
  }

  async webSocketClose() {}

  async webSocketError(ws) {
    try {
      ws.close(1011, "error");
    } catch {
      // The socket is already gone.
    }
  }

  snapshot() {
    return { type: "ROOM", teams: this.room.teams, bids: this.room.bids };
  }

  async persist() {
    await this.ctx.storage.put("room", this.room);
  }

  safeSend(ws, payload) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // Drop a socket that already closed.
    }
  }

  broadcast(bidOverride) {
    const bids = bidOverride || this.room.bids;
    const roomText = JSON.stringify({ type: "ROOM", teams: this.room.teams, bids });
    const bidsText = JSON.stringify({ type: "BIDS_UPDATED", bids });
    for (const sock of this.ctx.getWebSockets()) {
      try {
        sock.send(roomText);
        sock.send(bidsText);
      } catch {
        // Drop a socket that already closed.
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/room\/([A-Za-z0-9]{4})\/?$/);
    if (match) {
      return env.PRICE_ROOM.getByName(match[1].toUpperCase()).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

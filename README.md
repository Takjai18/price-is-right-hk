# 🏷️ 估價王 The Price is Right HK

跨團契破冰。大電視由主持操作：各組估惠康／百佳，或者豐澤／百老匯嘅最低價。最接近而唔爆煲贏。分數同題號記喺瀏覽器 localStorage。

Mode C：主持撳「手機競投」開 4 位房間碼。團友掃 QR 入 `?role=player`，揀自己組，銀碼即時出現喺大電視。手機頁睇唔到答案。每間房一個 SQLite Durable Object。

題庫價錢係開波參考，未逐項對過今日貨架。開波前可喺「設定/題庫」改。

## 點玩

1. 大電視開呢一頁。想團友用手機出價，撳「手機競投」，將 QR 投出去。
2. 各組鎖定銀碼。明標唔可以同價。未鎖定嘅銀碼唔會計分。
3. 撳「揭曉最低實價」。全部高過實價就係全場爆煲，要重投，而且新價要低過上一輪最低出價。
4. 最接近而唔爆煲 +100。一毫子都唔差 +300。之後勝出組估邊間舖平啲，估中再 +100。
5. 終極大櫥窗唔爆煲 +500。同最低總價相差 $50 以內 +800。
6. 去下一題會保留分數，並清空手機嗰輪出價。撳「清空本輪出價」先會撤銷呢輪啱啱加嘅分。

## 部署

GitHub：https://github.com/Takjai18/price-is-right-hk

靜態檔喺 `public/index.html`。`worker.js` 負責 `/api/room/:code` WebSocket，其他路徑交畀 `ASSETS`。帳號 Ymtwill。唔用 Gemini 份 `wrangler.toml`，因為佢冇靜態資源，部署之後頁面只會出一行字。

```bash
CI=1 npx --yes wrangler@4 deploy
```

線上版：https://price-is-right-hk.ymtwill.workers.dev

## 約書亞同但以理主站

Icebreaking 卡片喺 `kyc-joshua` 同 `kyc-daniel` 嘅 `src/pages/index.astro`，`games` 陣列。按鈕用現有粉紅色「開遊戲」。

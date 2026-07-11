# 分析師情報平台 MVP 規格

## 產品定位

這不是「AI 選股」產品，而是「分析分析師」的板塊市場情報系統。

核心承諾：

> 用 5 分鐘，告訴使用者指定板塊裡哪些股票與題材值得研究，以及哪些可信來源正在形成共識。

AI 不作為意見來源。AI 只負責收集、比較、整理與解釋。真正的觀點必須來自可追溯來源，例如分析師、法人報告、財報、新聞、Podcast、YouTube、X、資金流與搜尋趨勢。

## 目標使用者

- 沒時間追大量財經資訊，但想掌握市場重點的投資人
- 會自己判斷投資決策，但需要更快知道「這個板塊該研究什麼」的人
- 想追蹤分析師觀點變化，而不是只看新聞標題的人

## 第一版要回答的問題

1. 這個板塊最值得研究的股票或題材是什麼？
2. 為什麼近期出現新的研究價值？
3. 哪些分析師或機構開始提到？
4. 這些來源過去可信度如何？
5. 市場共識正在升溫、降溫，還是分歧？
6. 主要風險和反方敘事是什麼？

## MVP 首頁

首頁只做一件事：板塊選擇。

第一層不顯示 Today、不顯示每日股票清單。使用者先選投資宇宙，例如：

- AI 半導體
- 軍工 / 國防科技
- 娛樂 / 內容平台
- 能源 / 電力基建
- 自訂板塊

使用者點進板塊後，才進入第二層分析。

## 第二層板塊頁

每個板塊頁固定包含三塊：

1. 資料來源：可依全部 / 官方 / 新聞 / YouTube 等來源類型篩選。
2. Long / Short 研究建議：提出這個板塊中值得做多研究或做空研究的股票方向。
3. 歷史驗證：驗證過去類似 thesis 的結果，而不是只看單一新聞。

## 評分模型

第一版採透明規則分數，不假裝神秘 AI。

總分建議：

- Analyst Signal 30%
- Narrative Momentum 25%
- Evidence Strength 20%
- Freshness 15%
- Risk Adjustment 10%

欄位定義：

- Analyst Signal：高可信分析師或機構是否同步提及
- Narrative Momentum：題材被提及頻率是否連續升溫
- Evidence Strength：是否有報告、財報、新聞、資金流等多源支持
- Freshness：是否是新的變化，而不是舊訊號
- Risk Adjustment：估值、已漲幅、反方訊號、資料不足等扣分

## 資料結構

```json
{
  "id": "alchip-asic",
  "rank": 1,
  "title": "世芯-KY",
  "ticker": "3661.TW",
  "theme": "ASIC 接棒 GPU",
  "score": 92,
  "status": "Heating",
  "summary": "4 位高可信來源首次在 48 小時內同步提到 ASIC 需求升溫。",
  "metrics": {
    "analystSignal": 94,
    "narrativeMomentum": 91,
    "evidenceStrength": 86,
    "freshness": 88,
    "risk": 42
  },
  "sources": [
    {
      "name": "Morgan Stanley",
      "type": "Broker Report",
      "credibility": 88,
      "signal": "首次納入 ASIC 受惠名單"
    }
  ],
  "whyToday": [],
  "counterView": [],
  "watchNext": []
}
```

## 第一版資料來源

MVP 可先從低整合成本來源開始：

- 公開新聞與法人新聞稿
- YouTube / Podcast 逐字稿
- X / Threads / 社群貼文
- 券商報告摘要或公開引用
- 財報電話會議逐字稿
- Google Trends
- 股票價格與成交量

第一版不必先買昂貴資料。先驗證使用者是否每天會打開。

## 重要限制

- 不顯示「買進 / 賣出」指令
- 不宣稱保證報酬
- 不讓 AI 自己變成消息來源
- 每個推薦必須能追溯來源
- 沒有重要訊號時，要敢顯示「目前無高信心新 idea」

## 成功指標

- 使用者是否會重複回來查看關注板塊
- 每次停留是否能在 5 分鐘內完成閱讀
- 使用者是否點擊來源與追蹤後續
- Top 5 idea 的 7 日、30 日後續驗證表現
- 使用者是否信任分數，而不是只看結論

## 下一階段

1. 做真實資料收集 pipeline
2. 建立來源可信度資料庫
3. 追蹤每個 idea 的後續結果
4. 加入「分析師命中率」與「題材歷史表現」
5. 做定時自動更新與 Email / LINE 推送

## 目前原型已實作

- 第一層首頁：只顯示板塊選擇，已移除 Today。
- 第二層板塊頁：資料來源、Long / Short 研究建議、歷史驗證。
- 來源篩選：每個板塊可依來源類型篩選。
- Long / Short：每個板塊列出做多研究與做空研究方向，並附來源。
- 歷史驗證：以 thesis 為單位列出 window、result、status、note。
- 自訂板塊 live-only：只顯示 live collector 抓到的真實可查來源；沒有來源就不產生分析。
- Live collector：啟動 `live_server.py` 後，可從 Google News RSS 抓即時新聞，並用 Yahoo Finance Search 找可交易股票候選，前端點「建立真實分析」會建立 live evidence。
- 來源開啟方式：所有來源連結使用新分頁開啟，不取代原本分析畫面。
- 明確股票方向：每張推薦卡必須顯示 ticker、公司名稱、做多研究或做空研究方向，不能只顯示籠統題材。
- 精簡決策畫面：不顯示更新時間與解釋型說明欄位，畫面只保留板塊、來源、Long / Short、歷史驗證與必要狀態。
- 預設板塊來源密度：AI 半導體、軍工 / 國防科技、娛樂 / 內容平台、能源 / 電力基建各至少 10 個真實可點來源，混合官方、新聞與研究來源。
- 預設板塊建議密度：每個預設板塊至少 6 張 Long / Short 研究建議，每張建議至少綁定 2 個可點來源，避免建議區與來源區脫節。
- 預設板塊歷史驗證密度：每個預設板塊至少 6 條歷史驗證，與 Long / Short 建議一一對應。
- 外部觀點來源密度：每個預設板塊需包含 YouTube 與專家/市場作者分析入口，Long / Short 建議卡也要綁定這些外部觀點來源。
- 自訂板塊泛化：自訂查詢不只支援提示範例；live server 會用產業詞庫、新聞標題英文詞與 Yahoo Finance Search 找股票候選。
- 自訂板塊外部觀點：每個自訂股票候選會自動建立 YouTube 搜尋、Seeking Alpha 與 Yahoo Finance Analysis 入口，作為「其他人 / 專家 / YouTube」分析結果來源。

## 投資者決策網站下一步精進

第一版不能只讓使用者看到「高分標的」，還需要讓他完成一個投資前檢查流程：

1. 選擇投資宇宙：使用者先決定要看 AI 半導體、軍工、娛樂、能源或自訂板塊。
2. 板塊摘要：每個板塊必須有近期重點、主要催化、反方風險。
3. 候選標的：顯示值得研究的股票，但避免直接寫成買賣指令。
4. 來源佐證：每個判斷都要有可點來源，例如 IR、新聞稿、官網、YouTube、財報；連結一律開新分頁。
5. 投資檢查：估值、籌碼、催化時間、風險事件、資料可信度。
6. 後續驗證：追蹤 7 日 / 30 日 / 90 日結果，累積信任。

目前 detail 頁已加入一個可互動的投資前檢查區：

- 風險偏好：保守、平衡、積極
- 投資週期：7 日觀察、30 日波段、90 日題材
- Fit Score：根據 idea 分數、風險、證據強度、使用者偏好動態調整
- Checklist：來源可追溯、催化明確、風險可接受、反方已讀、追蹤指標設定
- 催化時間表：列出未來要觀察的事件
- 失效條件：列出這個 idea 什麼情況下應該降級或放棄

## 自訂板塊策略

自訂板塊採 live-only 原則：

1. 使用者輸入任意板塊，例如「咖啡」、「軍工」、「機器人」、「遊戲」。
2. 前端呼叫 `http://127.0.0.1:4318/api/custom-sector?q=...`。
3. `live_server.py` 從 Google News RSS 抓取即時新聞條目，並從 Yahoo Finance Search 抓可交易股票候選。
4. 只有抓到真實來源時，頁面才顯示候選研究項目與來源連結。
5. 若沒有抓到來源，明確顯示尚未取得資料，不用假資料填空。

## 最新性驗證方式

畫面不顯示更新時間，但資料層必須可驗證：

1. 前端每次自訂板塊查詢都使用 `cache: "no-store"`，並在 API URL 加上時間戳參數。
2. `live_server.py` 回應 `Cache-Control: no-store, max-age=0` 與 `Pragma: no-cache`。
3. API 回應保留 `collectedAt`，供開發與測試確認該次資料收集時間，但不顯示在 UI。
4. API 回應保留 `freshness.signature` 與 `freshness.changedFromPrevious`，用來源 URL 與股票候選清單比對同查詢是否和前一日不同。
5. 真正上線前，應加入自動測試：連續兩次請求同一板塊，確認 response header 不可快取、`collectedAt` 更新、來源格式完整、股票候選皆為 `EQUITY`。

啟動 live collector：

```bash
python3 live_server.py
```

然後在 Sectors > 自訂板塊輸入關鍵字，點「建立真實分析」。

使用者真正需要的不是「現在買什麼」，而是：

> 我關心的板塊近期有沒有新變化？哪些標的值得研究？哪些證據支持？哪些風險會讓這個 idea 失效？

## Collector 使用方式

離線產生樣本資料：

```bash
python3 collector.py --sample
```

輸出：

```text
data/generated-intelligence.json
```

未來要接真實 RSS 來源時，先編輯 `sources.json`，再執行：

```bash
python3 collector.py
```

第一版 collector 只做 evidence 收集與 keyword classification，不直接產生投資建議。真正上線時，還需要把 evidence 丟進 scoring pipeline，並要求每個分數都能回溯到來源。

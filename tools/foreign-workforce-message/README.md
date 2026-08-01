# 外籍人力多語訊息助手

## 工具用途
這個工具用於產生外籍人力管理常見工作通知的中文與外語對照訊息。第一版只使用瀏覽器內的人工範本資料，不串接 AI API 或翻譯 API。

## 第一版情境
- 報到通知
- 面試安排
- 體檢提醒
- 收取護照或居留證
- 文件補交通知
- 接送或接機通知

第一版不包含費用通知、薪資或扣款、工作安全正式警告、放假安排、住宿安排、工作時間通知。

## 支援語言
- 中文＋印尼文
- 中文＋越南文
- 中文＋泰文

中文固定保留，畫面可切換中文在前、外語在前、只顯示外語。

## 範本資料結構
`templates.js` 採資料驅動方式，包含 `languages`、`tones`、`fieldLabels`、`fieldTypes`、`scenarios`、`optionalPhrases`、`data`。每個情境、語言、語氣可追溯 `scenario_id`、`language`、`tone`、`required_fields`、`optional_phrases`、`template`、`review_status`。

## 翻譯校對狀態
`review_status` 支援 `draft`、`needs-native-review`、`reviewed`。中文為 `reviewed`；印尼文、越南文、泰文皆為 `needs-native-review`。畫面固定顯示「此翻譯目前為測試版本，傳送前請再次確認。」

## 禁止保存個資
不得儲存姓名、地點、文件內容或訊息全文；不得將表單內容寫入 localStorage；不得將使用者輸入內容送入 analytics；不得建立登入、歷史紀錄、資料庫或雲端保存。analytics 只允許 `tool_id`、`pack_id`、`language`、`scenario`、`action`、`page`。

## 未來擴充方式
新增語言時補 `languages`、`optionalPhrases`、`data` 的完整句型。新增情境時補 `scenarios` 與各語言範本。每個情境可透過 `tones` 陣列限制語氣。未來若串接 AI 或翻譯 API，需保留人工範本作為 fallback，且不得自動送出個資。

## 仍需人工確認的外語內容
所有印尼文、越南文與泰文目前皆為可測試草稿，正式發布或交付客戶使用前，需由熟悉該語言與外籍人力工作情境的人員確認語意、禮貌程度、語序與在地用詞。
# MUMING WorkKit

牧茗產業工具平台是一個獨立的產業工作工具網站，第一版使用原生 HTML、CSS、JavaScript 建立。

## 第一版範圍

- 不需登入
- 不串 API
- 不使用資料庫
- 不儲存工具表單內容
- 不串接 Google Analytics 或 Google AdSense
- 不建立付款功能

## 本機測試

可以直接開啟 `index.html` 檢查靜態頁。若要測試 Service Worker 與 PWA 快取，請用本機伺服器開啟專案根目錄。

## PWA TODO

正式上線前需要補上品牌確認後的 app icon，例如 192x192 與 512x512 PNG。第一版不使用臨時假 Logo。

## 統計事件

`assets/js/analytics.js` 目前只在 console 顯示事件，且僅允許 `tool_id`、`category`、`action`、`format`、`page` 欄位。

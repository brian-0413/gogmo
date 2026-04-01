# 機場接送派單平台 — 設計規範

## 設計理念

參考 Airbnb 的設計風格：乾淨、專業、溫暖、大量留白。
拒絕「AI 生成感」的通用介面，打造看起來像正式產品的專業平台。

## 配色系統

```css
:root {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F7F7F7;
  --bg-tertiary: #EBEBEB;
  --text-primary: #222222;
  --text-secondary: #717171;
  --text-tertiary: #B0B0B0;
  --border-default: #DDDDDD;
  --border-hover: #B0B0B0;
  --brand-primary: #FF385C;
  --brand-dark: #D70466;
  --status-success: #008A05;
  --status-success-bg: #E8F5E8;
  --status-warning: #B45309;
  --status-warning-bg: #FFF3E0;
  --status-danger: #E24B4A;
  --status-danger-bg: #FCEBEB;
  --status-info: #0C447C;
  --status-info-bg: #E6F1FB;
  --tag-dropoff: #92400E;
  --tag-dropoff-bg: #FFF3E0;
  --tag-kenichi: #6B21A8;
  --tag-kenichi-bg: #F3E8FF;
  --tag-neutral-bg: #F7F7F7;
}
```

MVP 只做淺色模式。

## 字體

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans TC', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #222222;
  -webkit-font-smoothing: antialiased;
}
```

| 用途 | 大小 | 粗細 | 顏色 |
|------|------|------|------|
| 頁面標題 | 22px | 500 | #222222 |
| 區塊標題 | 18px | 500 | #222222 |
| 卡片路線文字 | 15px | 500 | #222222 |
| 金額 | 18px | 500 | #222222 |
| 統計數字 | 22px | 500 | #222222 |
| 正文 | 14px | 400 | #222222 |
| 次要說明 | 13px | 400 | #717171 |
| 標籤文字 | 11-12px | 400 | 對應語義色 |

只使用 400 和 500 兩種粗細，不使用 600 或 700。

## 圓角

| 元素 | 圓角 |
|------|------|
| 卡片 | 12px |
| 統計區塊 | 12px |
| 標籤（藥丸形） | 20px |
| 按鈕（主要） | 8px |
| 導航膠囊按鈕 | 20px |
| 輸入框 | 8px |

## 陰影

只有卡片 hover 時使用：
```css
box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
transition: box-shadow 0.2s ease;
```

## 元件規範

### 導航列

膠囊按鈕形式，圓角 20px。
- 選中：背景 #222，文字白色
- 未選中：背景透明，邊框 #DDDDDD，文字 #717171
- 項目：行控中心、派單中心、帳務中心

### 統計卡片

背景 #F7F7F7，圓角 12px，padding 14px 16px。
上方 12px 灰色標籤，下方 22px 數字。
四個統計：接機、送機、待接單（紅色）、已接單（綠色）。一行四個。

### 行程卡片

桌面版 grid-cols-2 並列。白底、0.5px 邊框 #DDDDDD、圓角 12px、padding 16px。

卡片結構：
1. 狀態標籤（藥丸）+ 單號（右對齊灰色小字）
2. 種類標籤 + 車型標籤 + 肯驛標籤（如有）
3. 路線：「起點 → 終點」15px font-weight 500（最醒目）
4. 日期時間 13px 灰色
5. 分隔線 0.5px
6. 金額 18px（左）+ 承接司機 12px 灰色（右）

待接單卡片邊框改為 2px solid #E24B4A。

### 標籤系統（藥丸形，圓角 20px，淺底深字）

| 標籤 | 底色 | 文字色 |
|------|------|--------|
| 接機 | #E6F1FB | #0C447C |
| 送機 | #FFF3E0 | #92400E |
| 交通接駁 | #F7F7F7 | #717171 |
| 套裝 | #F3E8FF | #6B21A8 |
| 待接單 | #FCEBEB | #A32D2D |
| 已指派 | #FFF3E0 | #B45309 |
| 進行中 | #E6F1FB | #0C447C |
| 已完成 | #E8F5E8 | #008A05 |
| 肯驛 | #F3E8FF | #6B21A8 |
| 車型（任意/休旅/大車等） | #F7F7F7 | #717171 |

### 按鈕

主要按鈕：背景 #FF385C，文字白色，圓角 8px，hover 變 #D70466。
次要按鈕：背景透明，邊框 0.5px #DDDDDD，圓角 8px，hover 加 #F7F7F7 底色。

### 輸入框

邊框 1px solid #DDDDDD，圓角 8px，padding 10px 12px。
focus 邊框變 #222222 + 1px box-shadow。

### 表格

表頭：12px font-weight 500，#717171，底部 1px 邊框。
行：14px #222222，底部 0.5px 邊框，hover 加 #F7F7F7 底色。

## 頁面佈局

### 車頭端結構

```
頂部：標題 + 司機在線數
導航：膠囊按鈕組
統計：四格一行
內容：卡片兩列網格
```

### 響應式

| 寬度 | 卡片 | 統計 |
|------|------|------|
| > 1024px | 2 列 | 4 格一行 |
| 768-1024px | 2 列 | 4 格一行 |
| < 768px | 1 列 | 2 格一行 |

## 禁止事項

- 不使用任何 emoji 符號
- 不使用漸層背景
- 不使用 font-weight 600 或 700
- 不使用花俏動畫（只允許 hover transition）
- 不使用深色/黑色背景
- 不使用紫色漸層等 AI 通用風格
- 所有文字使用繁體中文

## 實作順序

1. 改全站背景（黑底換白底）和 Tailwind 全域樣式
2. 改導航列為膠囊按鈕
3. 改統計卡片
4. 改行程卡片為新設計
5. 改標籤系統
6. 改按鈕和表單
7. 改帳務中心表格
8. 全站檢查確保沒有殘留舊配色
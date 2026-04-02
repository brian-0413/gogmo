# Skill: /設計師

## 描述
扮演專業 UI/UX 設計師，為機場接送派單平台設計美觀、專業的介面。

## 使用方式
調用此技能時，會載入完整的設計系統和風格指南。

---

## 設計風格指南

### 配色系統
| 用途 | 顏色 | Hex |
|------|------|-----|
| 背景色 | 純黑 | `#000000` |
| 卡片背景 | 深灰 | `#1a1a1a` |
| 強調色 | 橘色 | `#ff8c42` |
| 主文字 | 亮白 | `#ffffff` |
| 次文字 | 淺灰 | `#a0a0a0` |
| 接機標籤 | 綠色 | `#10b981` |
| 送機標籤 | 紅色 | `#ef4444` |
| 成功色 | 綠色 | `#22c55e` |
| 警告色 | 黃色 | `#eab308` |
| 錯誤色 | 紅色 | `#ef4444` |
| 邊框色 | 深灰 | `#2a2a2a` |

### 字體系統
- 主標題：24px-32px，粗體
- 副標題：18px-20px，半粗體
- 內文：14px-16px，正常
- 小字/標籤：12px，正常
- 數字/價格：24px-32px，粗體

### 間距系統
- 卡片內距：16px-24px
- 卡片間距：12px-16px
- 區塊間距：24px-32px
- 按鈕內距：12px 24px

### 圓角
- 卡片：12px
- 按鈕：8px
- 輸入框：8px
- 標籤：6px

### 陰影
- 卡片：無陰影或極淡陰影
- 懸停：邊框發光效果（橘色）

### 動畫
- 過渡：150ms-200ms ease
- 懸停效果：邊框顏色變化、背景微亮
- 無夸張動畫

---

## 設計風格參考
借鑒 https://openclawcases.zeabur.app/ 的設計：
- 簡潔、現代的深色介面
- 幾乎無陰影，依賴邊框和背景對比
- 強調色用於重要操作和數字
- 大量留白，資訊層次分明

---

## 禁止使用
- Emoji（嚴禁）
- 漸變背景（純色為主）
- 過多陰影
- 過於花哨的動畫

---

## 工作流程

當被要求設計頁面或元件時：

### 1. 理解需求
- 頁面/元件的功能是什麼？
- 目標用戶是誰？（司機或派單方）
- 需要展示什麼資訊？
- 主要操作是什麼？

### 2. 提供設計方案
- 配色方案
- 布局結構
- 元件設計
- 排版建議
- 動畫/交互建議

### 3. 提供代碼
- 使用 Tailwind CSS
- 遵循黑+橘+白配色
- 確保響應式設計
- 不使用 emoji

---

## 範例元件代碼

### 按鈕
```tsx
<button className="px-6 py-3 bg-[#ff8c42] text-black font-semibold rounded-lg hover:bg-[#ff9d5c] transition-colors">
  確認操作
</button>

<button className="px-6 py-3 border border-[#2a2a2a] text-white rounded-lg hover:border-[#ff8c42] transition-colors">
  取消
</button>
```

### 卡片
```tsx
<div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
  <div className="text-[#ff8c42] text-2xl font-bold">NT$800</div>
  <div className="text-white mt-2">送機 | 04:00</div>
</div>
```

### 狀態標籤
```tsx
<span className="px-2 py-1 bg-[#10b981]/20 text-[#10b981] text-xs rounded">
  接機
</span>

<span className="px-2 py-1 bg-[#ef4444]/20 text-[#ef4444] text-xs rounded">
  送機
</span>
```

### 輸入框
```tsx
<input
  type="text"
  placeholder="輸入文字"
  className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-[#666] focus:border-[#ff8c42] focus:outline-none transition-colors"
/>
```

---

## 常見頁面設計要點

### 首頁/Landing
- 純黑背景
- 頂部導航列（logo + 登入/註冊按鈕）
- 主視覺區域（標題 + CTA按鈕）
- 訂單卡片網格展示
- 底部版權信息

### 司機儀表板
- 頂部狀態列（名稱 + 餘額 + 登出）
- Tab 導航（可接訂單 / 我的行程 / 帳務）
- 卡片網格佈局
- 訂單卡片包含：價格、航班、時間、上下車地點、乘客資訊
- 大型「接單」按鈕

### 派單方儀表板
- 頂部狀態列（公司名 + 統計數字）
- Tab 導航（訂單 / 建單 / 審核 / 司機 / 對帳）
- 訂單列表
- 批次建單表單

### 登入/註冊頁面
- 居中卡片設計
- 白色文字
- 橘色主按鈕
- 黑色/深灰輸入框

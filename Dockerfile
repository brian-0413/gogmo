# 使用 Node.js 官方 LTS 映像
FROM node:20-slim

# 設定工作目錄
WORKDIR /src

# 複製 package files
COPY package*.json ./

# 安裝依賴（使用 npm ci 確保一致性）
RUN npm ci

# 複製其餘程式碼
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 將 seed script 的相依項目加入
# (bcryptjs & ts-node already in node_modules from npm ci)

# 建置 Next.js
RUN npm run build

# 啟動指令
CMD ["npm", "start"]

# ===== 第一階段：建置 =====

FROM node:24-alpine AS builder

WORKDIR /app
# 用 build-arg 選擇 npm registry 設定（預設公開 registry；內網用 --build-arg NPM_RC_FILE=.npmrc-nexus）
ARG NPM_RC_FILE=.npmrc-public
COPY ${NPM_RC_FILE} ./.npmrc

# lockfile 進版控，npm ci 會完全照 package-lock.json 安裝，建置結果可重現
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 型別檢查（vue-tsc）+ vite build，輸出到 /app/dist
RUN npm run build

# ===== 第二階段：用 nginx 提供靜態檔 =====

FROM nginx:stable-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

# 放進 templates，容器啟動時由 nginx 映像檔的 entrypoint 以 envsubst 代入 BACKEND_URL、DNS_RESOLVER
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
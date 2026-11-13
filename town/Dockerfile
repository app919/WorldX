# 三邻邦（OPC Town）：前端 + 后端一个镜像。数据挂载到 /data。
FROM node:22-bookworm-slim
# LibreOffice 用于解析旧版 .doc / .ppt（免费开源）
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-writer libreoffice-impress fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8787 DB_PATH=/data/sanlinbang.db UPLOAD_DIR=/data/uploads WEB_DIST=/app/dist
VOLUME ["/data"]
EXPOSE 8787
CMD ["npx", "tsx", "server/src/server.ts"]

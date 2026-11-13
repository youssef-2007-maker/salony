# Container build for Salony (web app + API in one service).
# Used by Hugging Face Spaces; works on any Docker host.
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY . .
RUN npx expo export --platform web
ENV SALONY_ENV=production PORT=7860 SALONY_DB_PATH=/tmp/salony.db
EXPOSE 7860
CMD ["node", "backend/server.js"]

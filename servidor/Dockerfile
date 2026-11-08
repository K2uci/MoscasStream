# ---- 1. Panel web (React + Vite) ----
FROM node:24-alpine AS panel
WORKDIR /panel
COPY panel/package*.json ./
RUN npm ci --no-audit --no-fund
COPY panel/ ./
RUN npm run build

# ---- 2. API (Express + TypeScript) ----
FROM node:24-alpine AS api
WORKDIR /api
COPY api/package*.json ./
RUN npm ci --no-audit --no-fund
COPY api/ ./
RUN npm run build && npm prune --omit=dev

# ---- 3. Imagen final ----
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIR=/app/web \
    UPLOAD_DIR=/app/uploads \
    IMPORT_DIR=/app/importacion
WORKDIR /app
COPY --from=api /api/package.json ./
COPY --from=api /api/node_modules ./node_modules
COPY --from=api /api/dist ./dist
COPY --from=panel /panel/dist ./web
RUN mkdir -p uploads importacion && chown node:node uploads importacion
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/index.js"]

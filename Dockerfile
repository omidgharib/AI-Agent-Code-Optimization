FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY ui/package*.json ./ui/
RUN npm ci && npm --prefix ui ci
COPY . .
RUN npm run build:all
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production AI_AUDITOR_UI_PORT=4317
COPY --from=build /app/dist ./dist
COPY --from=build /app/ui/dist ./ui/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 4317
ENTRYPOINT ["node", "dist/cli/index.js"]

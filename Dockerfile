FROM node:24.21.0-bookworm-slim AS dependencies

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

FROM dependencies AS development
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium webkit
COPY . .
EXPOSE 3000 5173
CMD ["npm", "run", "dev"]

FROM dependencies AS build
COPY . .
RUN npm run check
RUN npm prune --omit=dev

FROM node:24.21.0-bookworm-slim AS production
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV SERVE_WEB=true
WORKDIR /app
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/web/dist ./apps/web/dist
COPY --from=build /workspace/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /workspace/packages/contracts/dist ./packages/contracts/dist
COPY config/reader.example.yaml ./config/reader.example.yaml
RUN mkdir -p /app/.data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]

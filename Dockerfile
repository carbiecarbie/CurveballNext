FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY server ./server
COPY tsconfig.json tsconfig.server.json ./
COPY tools/m5/build-server.mjs ./tools/m5/build-server.mjs
RUN npm run server:build

FROM node:24.19.0-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist-server/server.mjs ./server.mjs
USER node
EXPOSE 8787
CMD ["node", "server.mjs"]

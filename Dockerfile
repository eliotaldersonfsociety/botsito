# Etapa 1: Builder
FROM node:21-alpine3.18 AS builder

WORKDIR /app

COPY . .
RUN npm install --production --ignore-scripts

# Etapa 2: Producción
FROM node:21-alpine3.18

WORKDIR /app

# Copiar los archivos desde la etapa builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/*.json /app/*-lock.yaml ./

RUN npm cache clean --force && pnpm install --production --ignore-scripts \
    && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs \
    && rm -rf /usr/local/bin/.npm /usr/local/bin/.node-gyp

EXPOSE 3000

CMD ["node", "dist/app.js"]

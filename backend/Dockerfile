# Etapa 1: Builder
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/
COPY scripts ./scripts/
RUN npm run build

# Etapa 2: Runner (Producción)
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh && \
    mkdir -p /app/uploads && \
    chown -R node:node /app

USER node

EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]

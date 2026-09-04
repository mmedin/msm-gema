FROM node:22-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/
COPY scripts ./scripts/
RUN npm run build

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

RUN mkdir -p /app/uploads

EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]

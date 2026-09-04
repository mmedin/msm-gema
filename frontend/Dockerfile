FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

COPY . .
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN mkdir -p /usr/share/nginx/html/uploads /usr/share/nginx/html/datos-geo

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

FROM node:18-alpine

RUN apk add --no-cache \
    iproute2 \
    net-tools \
    busybox-extras \
    curl \
    ca-certificates

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node

CMD ["node", "server/index.js"]
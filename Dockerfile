FROM node:24-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV NODE_ENV=production

EXPOSE 5000

CMD ["npm", "start"]

FROM node:24.14.0-alpine3.23

WORKDIR /app
COPY package.json ./
COPY src ./src

USER node
EXPOSE 8090
CMD ["node", "src/server.js"]

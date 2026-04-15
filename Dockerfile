FROM node:20-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

FROM base AS dev

WORKDIR /app

CMD ["npm", "run", "start:api:dev"]

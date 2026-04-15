# code-ray-server

NestJS monorepo skeleton for the Code Ray backend.

## Local Development

```bash
cp .env.local.example .env.local
docker compose --env-file .env.local up --build
```

The local compose stack starts `postgres`, `redis`, `rabbitmq`, `migrator`, `api`, and `worker`.

```bash
docker compose --env-file .env.local config
docker compose --env-file .env.local down -v
```

`docker/postgres/init/20-seed-prompt-templates.sql` only runs when the Postgres volume is created from an empty state. Reusing the existing volume does not re-seed prompt templates.

For host-based app execution without Docker for the Nest apps, keep `.env.local` values pointed at `localhost` and run:

```bash
npm install
npm run migration:run
npm run start:api:dev
npm run start:worker:dev
```

## Production Runtime

PM2 runs on the host, not inside Docker Compose.

```bash
cp .env.production.example .env.production
npm install
npm run build
npm run migration:run
pm2 start ecosystem.config.js
```

Useful commands:

```bash
pm2 list
pm2 logs
pm2 restart ecosystem.config.js
pm2 stop ecosystem.config.js
```

Recommended production prerequisites:

- Node.js 20
- PM2 installed globally
- `.env.production` placed in the repository root
- reachable PostgreSQL, Redis, and RabbitMQ endpoints

Optional log rotation:

```bash
pm2 install pm2-logrotate
```

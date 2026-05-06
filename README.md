
<p align="center"></p>

<!-- <p align="center">
  Find the Perfect Work & Study Tools for Your Next Project
  <br>
  <a href="https://devsuite.co"><strong>Learn more »</strong></a>
  <br />
  <br />
  <a href="https://devsuite.co">Website</a>
  ·
  <a href="https://github.com/piotrkulpinski/devsuite/issues">Issues</a>
</p> -->


## About this project

AI Knowledge Cloud is a **free, curated collection of the best Work & Study tools** designed to improve your productivity when building your next project.

In today's fast-paced tech world, keeping up with the **constant stream of new software development tools** can be challenging. That's where DevSuite comes in. The mission is simple: to help Work & Studys like you find the perfect tools to improve your workflow and bring your ideas to life more efficiently.

DevSuite is more than just a directory; it's **a community-driven resource**. Feel free to explore, discover, and contribute by submitting your favorite tools to the site. Your input is invaluable in helping to grow and maintain a comprehensive, up-to-date collection.

## Development

This project uses [Bun](https://bun.sh/) as the package manager and runtime. Make sure you have Bun installed before proceeding.

To set up the project for development:

1. Clone the repository
2. Run `bun install` in the root directory to install all dependencies
3. Set up the required environment variables (see below)
4. Start the local infrastructure with `docker compose up -d postgres qdrant infinity`
5. Either run `bun run db:push` for an empty local database or `SYNC_SOURCE_DATABASE_URL=... bun run db:bootstrap:dev` to clone the current cloud PostgreSQL data into local PostgreSQL
6. Create symlinks for the .env file (see Environment Variables section)
7. Run `bun run dev` to start the web application in development mode

### Environment Variables

Refer to the `.env.example` file for a complete list of required variables.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command           | Action
| :---------------- | :-------------------------------------------------------- 
| `bun install`     | Installs dependencies
| `bun run dev`     | Starts web app in development mode at `localhost:5175`
| `bun run build`   | Build both apps for production
| `bun run icons`   | Generate SVG sprite and icon manifest from `assets/icons`
| `bun run start`   | Preview production build locally
| `bun run lint`    | Run linter
| `bun run format`  | Format code
| `bun run typecheck` | Run TypeScript type checking
| `bun run db:generate` | Generate Prisma client
| `bun run db:studio` | Start Prisma Studio
| `bun run db:push` | Push Prisma schema to database
| `bun run db:pull` | Pull Prisma schema from database
| `bun run db:reset` | Reset Prisma schema
| `bun run db:bootstrap:dev` | Clone cloud PostgreSQL into local PostgreSQL, redact dev PII, sync schema, and rebuild local Qdrant
| `bun run db:bootstrap:vps` | Clone cloud PostgreSQL into the VPS PostgreSQL, sync schema, and rebuild local Qdrant
| `bun run db:verify:sync` | Compare source and target PostgreSQL schema/data after bootstrap

## Third-Party Services

DevSuite uses the following third-party services:

- Database: PostgreSQL in the local/VPS Compose stack, with cloud PostgreSQL used only as a bootstrap source during migration
- Background Jobs: [Inngest](https://inngest.com)
- File Storage: [AWS S3](https://aws.amazon.com/s3)
- Screenshots: [ScreenshotOne](https://go.devsuite.co/screenshotone)

Make sure to set up accounts with these services and add the necessary environment variables to your `.env` file.

## Deployment

The primary deployment target is the bundled VPS Docker Compose stack.

For the first production cutover:

1. Prepare the VPS stack and environment file
2. Run `COMPOSE_ENV_FILE=/srv/stukit/shared/.env.production bash ./scripts/bootstrap-postgres.sh vps`
3. Verify the imported PostgreSQL data and rebuilt Qdrant state
4. Switch traffic to the VPS stack
5. Retire the cloud PostgreSQL source and Vercel deployment after your rollback window closes

## Docker Compose

For a local containerized stack with the application, Caddy, PostgreSQL, PostgREST, Qdrant, and Infinity:

1. Optionally copy `.env.example` to `.env` and replace any placeholder values you actually use
2. Start the stack with `docker compose up --build`

To bootstrap local PostgreSQL from the current cloud database:

1. Set `SYNC_SOURCE_DATABASE_URL` in `.env` or export it in your shell
2. Run `bun run db:bootstrap:dev`

Local endpoints:

- App via Caddy: `http://localhost`
- PostgREST via Caddy: `http://localhost/postgrest/`
- Qdrant via Caddy: `http://localhost/qdrant/`
- Infinity via Caddy: `http://localhost/infinity/`
- PostgreSQL direct port: `localhost:5432`
- Qdrant direct port: `localhost:6333`
- Infinity direct port: `localhost:7997`

Notes:

- The compose stack defaults to local placeholder values for required app secrets, so it can boot without a fully populated `.env`
- The compose stack always points the app to the local PostgreSQL, Qdrant, and Infinity containers, even if your repo `.env` contains remote service URLs
- The pg_dump/pg_restore bootstrap runs in a dedicated ops-only Compose service (`pg-tools`), so you do not need host-installed PostgreSQL client tools
- `bun run db:bootstrap:dev` recreates the local PostgreSQL database, verifies the import, reapplies PostgREST grants, redacts developer-local email fields, pushes the Prisma schema, and rebuilds local Qdrant
- Prisma schema sync is handled automatically by the `migrate` service before the app starts
- PostgREST is configured against the same local PostgreSQL database and reads the Prisma-managed `public` schema
- Infinity uses the upstream `michaelf34/infinity:latest-cpu` image with a persisted Hugging Face cache volume and defaults to `sentence-transformers/all-MiniLM-L6-v2`

## License

DevSuite is licensed under the [GPL-3.0 License](LICENSE).

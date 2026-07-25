# Ludo Game

একটি মাল্টিপ্লেয়ার লুডো গেম — Express (Node.js) ব্যাকএন্ড এবং React (Vite) ফ্রন্টএন্ড সহ।

## Stack

- **Backend:** Express 5, express-session, bcryptjs, Drizzle ORM, libsql (SQLite), WebSocket (ws)
- **Frontend:** React 19, Vite 7, Tailwind CSS v4, Wouter, TanStack Query, Framer Motion
- **Database:** SQLite (`data/ludo.db`)
- **Auth:** Custom session-based auth (bcrypt password hashing, express-session)
- **Package manager:** pnpm (monorepo workspace)

## Project Structure

```
artifacts/
  api-server/    # Express backend (port via $PORT, default 10000)
  ludo-game/     # React frontend (Vite dev server)
lib/
  db/            # Drizzle ORM schema + SQLite client
  api-client-react/
  api-spec/
  api-zod/
data/
  ludo.db        # SQLite database file
```

## Render Deployment

`render.yaml` এ সব কনফিগ আছে। কোনো environment variable সেট করতে হবে না — সব কিছুর default value আছে:

- `SESSION_SECRET` → fallback: `"dev-secret-change-in-prod"`
- `SQLITE_DB_PATH` → fallback: `"./data/ludo.db"`
- `PORT` → Render নিজে inject করে
- `NODE_ENV` → `render.yaml` এ `production` সেট করা আছে

## How to Deploy on Render

1. GitHub-এ repo push করো
2. Render-এ "New Web Service" → GitHub repo select করো
3. Render `render.yaml` automatically detect করবে
4. Deploy করো — কোনো env var দিতে হবে না

## Local Development

```bash
# Install dependencies
pnpm install

# Run backend (dev mode)
pnpm --filter @workspace/api-server run dev

# Run frontend (dev mode)
pnpm --filter @workspace/ludo-game run dev
```

## User Preferences

- Clerk authentication সম্পূর্ণ remove করা হয়েছে — custom session-based auth ব্যবহার করা হচ্ছে
- Preview/mockup ফাইল প্রজেক্টে add করা হবে না

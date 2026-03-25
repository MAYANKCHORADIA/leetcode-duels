# LeetCode Duels — Setup Checklist

Everything you need to do before running the app end-to-end.

---

## 1. Neon DB (PostgreSQL)

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the connection strings into `server/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

3. Run Prisma migrations from the `server/` directory:

```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
```

4. (Optional) Verify your tables in Prisma Studio:

```bash
npx prisma studio
```

---

## 2. Judge0 API Key

1. Go to [RapidAPI Judge0 CE](https://rapidapi.com/judge0-official/api/judge0-ce)
2. Subscribe to the free tier
3. Copy your API key into `server/.env`:

```env
JUDGE0_API_URL="https://judge0-ce.p.rapidapi.com"
JUDGE0_API_KEY="your_rapidapi_key_here"
```

---

## 3. CORS / Frontend URL

If deploying, update the `FRONTEND_URL` in `server/.env` to your Vercel domain:

```env
FRONTEND_URL="https://your-app.vercel.app"
```

And update `NEXT_PUBLIC_BACKEND_URL` in `frontend/.env.local` to your Render URL:

```env
NEXT_PUBLIC_BACKEND_URL="https://your-backend.onrender.com"
```

For local development, the defaults (`localhost:3000` / `localhost:8080`) already work.

---

## 4. Run Locally

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:8080

---

## 5. Deploy (when ready)

| Service  | Platform | Notes |
|----------|----------|-------|
| Frontend | Vercel   | Connect GitHub repo, set root to `frontend/`, add `NEXT_PUBLIC_BACKEND_URL` env var |
| Backend  | Render   | Connect GitHub repo, set root to `server/`, add all `server/.env` vars |
| Database | Neon     | Already configured via `DATABASE_URL` |

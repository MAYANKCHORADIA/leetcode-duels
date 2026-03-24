# Technical Requirements

## 1. Tech Stack Architecture
* **Frontend:** Next.js (App Router), React, Tailwind CSS, Monaco Editor (`@monaco-editor/react`). Hosted on Vercel.
* **Backend:** Node.js, Express, Socket.io. Hosted on Render.
* **Database:** Neon DB (Serverless Postgres) managed via Prisma ORM.
* **Execution Engine:** Judge0 API.

## 2. Environment Variables Required
**Frontend (.env.local):**
* `NEXT_PUBLIC_BACKEND_URL` (The Render URL for Socket/API calls)

**Backend (.env):**
* `DATABASE_URL` (Neon DB connection string)
* `DIRECT_URL` (Neon DB direct connection for Prisma migrations)
* `JUDGE0_API_URL`
* `JUDGE0_API_KEY`
* `FRONTEND_URL` (For CORS configuration)

## 3. Database Schema (Prisma for Neon DB)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id            String   @id @default(uuid())
  username      String   @unique
  collegeName   String
  eloRating     Int      @default(1200)
  matchesPlayed Int      @default(0)
  matchesWon    Int      @default(0)
  createdAt     DateTime @default(now())
}

model MatchHistory {
  id          String   @id @default(uuid())
  winnerId    String
  loserId     String
  problemName String
  duration    Int      // time taken in seconds
  createdAt   DateTime @default(now())
}
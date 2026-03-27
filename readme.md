# ⚔️ LeetCode Duels

A real-time, competitive programming platform where developers can challenge their friends or random opponents to live coding matches. Solve algorithmic problems under timed conditions, watch your opponent's progress in real-time, and climb the global and college-specific leaderboards.

## ✨ Key Features
* **Real-Time Multiplayer:** Built with Socket.io for millisecond-level synchronization, live typing indicators, and instant matchmaking.
* **Secure Code Execution:** Integrated with the Judge0 Compiler API (Batched Submissions) to safely compile and evaluate C++ code against hidden test cases.
* **Elo Rating System:** A mathematical matchmaking ranking system that updates player skill ratings dynamically after every duel.
* **Social & Progression:** Complete friend system (add, accept, challenge), daily coding streaks, and detailed user profiles with login counters.
* **Mock Execution Fallback:** Gracefully falls back to a mock execution state if API limits are reached, ensuring the UI and game loop never break for portfolio viewers.

## 🛠️ Tech Stack
* **Frontend:** Next.js (App Router), React, Tailwind CSS, Monaco Editor
* **Backend:** Node.js, Express, Socket.io
* **Database:** Neon (Serverless PostgreSQL), Prisma ORM
* **Authentication:** Better Auth (Cross-domain configured for Vercel/Render)
* **Code Engine:** Judge0 CE (via RapidAPI)

## 🏗️ Architecture
Because this app relies heavily on persistent WebSocket connections (which do not work well with serverless edge functions), the architecture is intentionally decoupled:
* The **Frontend** is hosted on Vercel for lightning-fast edge delivery.
* The **Backend** is a dedicated Express server hosted on Render to maintain stateful Socket.io connections and securely communicate with the Judge0 API.

## ⚙️ Local Development Setup

### 1. Prerequisites
Ensure you have Node.js and npm installed. You will also need a free [Neon DB](https://neon.tech/) PostgreSQL instance and a [RapidAPI](https://rapidapi.com/) account for Judge0 CE.

### 2. Environment Variables
Create a `.env` file in your backend directory:
```text
DATABASE_URL="your_neon_db_connection_string"
DIRECT_URL="your_neon_db_direct_connection_string"
FRONTEND_URL="http://localhost:3000"
BETTER_AUTH_SECRET="a_random_secure_string"
BETTER_AUTH_URL="http://localhost:8080"
RAPIDAPI_KEY="your_rapidapi_judge0_key"
RAPIDAPI_HOST="judge0-ce.p.rapidapi.com"
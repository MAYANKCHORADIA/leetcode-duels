import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { toNodeHandler } from "better-auth/node";
import prisma from "./db.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";

const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BACKEND_URL || "http://localhost:8080",
  trustedOrigins: [FRONTEND_URL],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      username: { type: "string", required: true },
      collegeName: { type: "string", required: true },
      eloRating: { type: "number", required: false, defaultValue: 1200 },
      matchesPlayed: { type: "number", required: false, defaultValue: 0 },
      matchesWon: { type: "number", required: false, defaultValue: 0 },
    }
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: false,
      httpOnly: true,
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await prisma.user.update({
            where: { id: session.userId },
            data: { loginCount: { increment: 1 } }
          });
        }
      }
    }
  }
});

export { auth, toNodeHandler };

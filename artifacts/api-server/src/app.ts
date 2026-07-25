import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Render (and most cloud providers) terminate SSL at the load balancer
// and forward plain HTTP to the app. Without this, secure cookies won't work.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  }),
);

// API routes must come BEFORE the catch-all
app.use("/api", router);

// ── Serve built frontend in production ──────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  // __dirname points to dist/ after esbuild bundles the app
  const frontendDist = path.resolve(
    __dirname,
    "..",
    "..",
    "ludo-game",
    "dist",
    "public",
  );

  if (fs.existsSync(frontendDist)) {
    logger.info({ frontendDist }, "Serving frontend static files");
    app.use(express.static(frontendDist));

    // Catch-all: serve index.html for client-side routing
    // express.static above won't match /api/* paths, so API routes work fine
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  } else {
    logger.warn(
      { frontendDist },
      "Frontend dist not found — API-only mode",
    );
  }
}

export default app;

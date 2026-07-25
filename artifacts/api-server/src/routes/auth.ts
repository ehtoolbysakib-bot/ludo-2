import { Router, type IRouter } from "express";
import { eq, or, count } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getAvatarUrl(gender: string, displayName: string): string {
  const seed = encodeURIComponent(`${gender}_${displayName}_${Date.now()}`);
  if (gender === "female") {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&facialHairProbability=0&top=longHair,bun,bob,bigHair,straight01,frizzle`;
  }
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&facialHairProbability=65&accessories=prescription02,round`;
}

function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    clerkId: u.clerkId,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl ?? null,
    coins: u.coins,
    level: u.level,
    isAdmin: u.isAdmin,
    gender: u.gender,
    email: u.email ?? null,
    phone: u.phone ?? null,
  };
}

// POST /api/auth/register
router.post("/auth/register", async (req: any, res): Promise<void> => {
  const { name, emailOrPhone, gender, password } = req.body ?? {};

  if (!name?.trim() || name.trim().length < 2) {
    res.status(400).json({ error: "নামটি কমপক্ষে ২ অক্ষরের হতে হবে" });
    return;
  }
  if (!emailOrPhone?.trim()) {
    res.status(400).json({ error: "ইমেইল বা ফোন নাম্বার দিন" });
    return;
  }
  if (!password || password.length < 6) {
    res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে" });
    return;
  }
  if (!["male", "female"].includes(gender)) {
    res.status(400).json({ error: "লিঙ্গ সিলেক্ট করুন" });
    return;
  }

  const trimmed = emailOrPhone.trim();
  const emailVal = isEmail(trimmed) ? trimmed.toLowerCase() : null;
  const phoneVal = !emailVal ? trimmed : null;

  try {
    // Check existing
    const whereClause = emailVal
      ? eq(usersTable.email, emailVal)
      : eq(usersTable.phone, phoneVal!);
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(whereClause);
    if (existing) {
      res.status(409).json({ error: "এই ইমেইল/নাম্বার দিয়ে আগেই অ্যাকাউন্ট আছে" });
      return;
    }

    // First user becomes admin
    const [{ total }] = await db.select({ total: count() }).from(usersTable);
    const isFirstUser = Number(total) === 0;

    const passwordHash = await bcrypt.hash(password, 10);
    const clerkId = `user_${crypto.randomUUID()}`;
    const avatarUrl = getAvatarUrl(gender, name.trim());

    const [user] = await db
      .insert(usersTable)
      .values({
        clerkId,
        email: emailVal,
        phone: phoneVal,
        displayName: name.trim(),
        passwordHash,
        gender,
        avatarUrl,
        isAdmin: isFirstUser,
      })
      .returning();

    req.session.userId = user.clerkId;
    req.session.save((err: any) => {
      if (err) {
        logger.error({ err }, "Session save error");
        res.status(500).json({ error: "সেশন সংরক্ষণে সমস্যা" });
        return;
      }
      res.status(201).json(formatUser(user));
    });
  } catch (e: any) {
    logger.error({ e }, "Register error");
    if (e?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      res.status(409).json({ error: "এই ইমেইল/নাম্বার দিয়ে আগেই অ্যাকাউন্ট আছে" });
    } else {
      res.status(500).json({ error: "রেজিস্ট্রেশনে সমস্যা হয়েছে" });
    }
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req: any, res): Promise<void> => {
  const { emailOrPhone, password } = req.body ?? {};

  if (!emailOrPhone?.trim() || !password) {
    res.status(400).json({ error: "ইমেইল/নাম্বার এবং পাসওয়ার্ড দিন" });
    return;
  }

  const trimmed = emailOrPhone.trim();
  const emailVal = isEmail(trimmed) ? trimmed.toLowerCase() : null;
  const phoneVal = !emailVal ? trimmed : null;

  try {
    const whereClause = emailVal
      ? eq(usersTable.email, emailVal)
      : eq(usersTable.phone, phoneVal!);

    const [user] = await db.select().from(usersTable).where(whereClause);

    if (!user) {
      res.status(401).json({ error: "ইমেইল/নাম্বার বা পাসওয়ার্ড ভুল" });
      return;
    }

    if (user.isSuspended) {
      res.status(403).json({ error: "এই অ্যাকাউন্ট সাসপেন্ড করা হয়েছে" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "ইমেইল/নাম্বার বা পাসওয়ার্ড ভুল" });
      return;
    }

    req.session.userId = user.clerkId;
    req.session.save((err: any) => {
      if (err) {
        logger.error({ err }, "Session save error");
        res.status(500).json({ error: "সেশন সংরক্ষণে সমস্যা" });
        return;
      }
      res.json(formatUser(user));
    });
  } catch (e) {
    logger.error({ e }, "Login error");
    res.status(500).json({ error: "লগইনে সমস্যা হয়েছে" });
  }
});

// POST /api/auth/logout
router.post("/auth/logout", (req: any, res): void => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req: any, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId));

    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "User not found" });
      return;
    }

    res.json(formatUser(user));
  } catch (e) {
    logger.error({ e }, "Auth/me error");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;

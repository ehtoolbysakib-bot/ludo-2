import { Router, type IRouter } from "express";
import { eq, like, or, count, sum, desc } from "drizzle-orm";
import { db, usersTable, roomsTable } from "@workspace/db";
import {
  AdminListUsersQueryParams,
  AdminSuspendUserBody,
  AdminSuspendUserParams,
  AdminAddCoinsBody,
  AdminAddCoinsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const requireAdmin = async (req: any, res: any, next: any) => {
  const clerkId = req.session?.userId as string | undefined;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkId = clerkId;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));

  if (!user || !user.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    clerkId: u.clerkId,
    email: u.email ?? "",
    phone: u.phone ?? null,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl ?? null,
    gender: u.gender,
    coins: u.coins,
    level: u.level,
    wins: u.wins,
    losses: u.losses,
    matches: u.matches,
    isSuspended: u.isSuspended,
    isAdmin: u.isAdmin,
    lastDailyReward: u.lastDailyReward ?? null,
    createdAt: u.createdAt,
  };
}

// List users
router.get("/admin/users", requireAdmin, async (req: any, res): Promise<void> => {
  const parsed = AdminListUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page = 1, limit = 20, search } = parsed.data;
  const offset = (page - 1) * limit;

  const searchPattern = search ? `%${search}%` : undefined;
  const whereClause = searchPattern
    ? or(
        like(usersTable.displayName, searchPattern),
        like(usersTable.email, searchPattern),
        like(usersTable.phone, searchPattern),
      )
    : undefined;

  const users = await db
    .select()
    .from(usersTable)
    .where(whereClause)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(whereClause);

  res.json({
    users: users.map(formatUser),
    total: Number(total),
    page,
    limit,
  });
});

// Suspend/unsuspend user
router.post(
  "/admin/users/:userId/suspend",
  requireAdmin,
  async (req: any, res): Promise<void> => {
    const params = AdminSuspendUserParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = AdminSuspendUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [user] = await db
      .update(usersTable)
      .set({ isSuspended: parsed.data.suspended })
      .where(eq(usersTable.clerkId, params.data.userId))
      .returning();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(formatUser(user));
  },
);

// Add coins
router.post(
  "/admin/users/:userId/coins",
  requireAdmin,
  async (req: any, res): Promise<void> => {
    const params = AdminAddCoinsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = AdminAddCoinsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, params.data.userId));

    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [user] = await db
      .update(usersTable)
      .set({ coins: existing.coins + parsed.data.amount })
      .where(eq(usersTable.clerkId, params.data.userId))
      .returning();

    res.json(formatUser(user));
  },
);

// Admin dashboard stats
router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [{ totalUsers }] = await db
    .select({ totalUsers: count() })
    .from(usersTable);
  const [{ activeUsers }] = await db
    .select({ activeUsers: count() })
    .from(usersTable)
    .where(eq(usersTable.isSuspended, false));
  const [{ totalRooms }] = await db
    .select({ totalRooms: count() })
    .from(roomsTable);
  const [{ totalCoins }] = await db
    .select({ totalCoins: sum(usersTable.coins) })
    .from(usersTable);
  const [{ totalGamesRaw }] = await db
    .select({ totalGamesRaw: sum(usersTable.matches) })
    .from(usersTable);

  res.json({
    totalUsers: Number(totalUsers),
    activeUsers: Number(activeUsers),
    totalGames: Math.floor(Number(totalGamesRaw ?? 0) / 2),
    totalRooms: Number(totalRooms),
    totalCoinsInCirculation: Number(totalCoins ?? 0),
  });
});

export default router;

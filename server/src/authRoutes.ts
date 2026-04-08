import express from "express";
import { prisma } from "./db.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  requireRole,
  getRequestUser,
} from "./auth.js";
import { logger } from "./logger.js";

const router = express.Router();

type AuthUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  displayName: string;
  organizationId?: string | null;
  organizationName?: string | null;
};

const prismaUser = prisma as typeof prisma & {
  user: {
    findUnique: (args: { where: { email?: string; id?: string } }) => Promise<AuthUserRecord | null>;
    count: () => Promise<number>;
    create: (args: {
      data: { email: string; passwordHash: string; role: string; displayName: string };
    }) => Promise<AuthUserRecord>;
  };
};

/** The suite program Chronicle sessions are scoped to. */
const PROGRAM_DOMAIN = "community-chronicle";

/**
 * Derive AppInitState for the response.
 * - "not_initialized" : no users exist at all
 * - "no_org"          : user exists but has no org assignment
 * - "ready"           : user has org context
 */
function resolveAppInitState(user: AuthUserRecord): "not_initialized" | "no_org" | "ready" {
  if (!user.organizationId) return "no_org";
  return "ready";
}

/** Build the safe user payload included in API responses. */
function buildUserPayload(user: AuthUserRecord) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    organizationId: user.organizationId ?? undefined,
    organizationName: user.organizationName ?? undefined,
    programDomain: PROGRAM_DOMAIN,
  };
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await prismaUser.user.findUnique({ where: { email } });
  if (!user) {
    // Constant-time comparison even on miss — avoids user enumeration
    await bcryptFakeCompare();
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId ?? undefined,
    programDomain: PROGRAM_DOMAIN,
  });
  logger.info("User logged in", { userId: user.id, role: user.role, organizationId: user.organizationId });

  res.json({
    token,
    user: buildUserPayload(user),
    appInitialized: !!user.organizationId,
    appInitState: resolveAppInitState(user),
  });
});

// POST /api/auth/register  (admin only after first user)
router.post(
  "/register",
  (req, res, next) => {
    // First user can self-register (bootstrapping); subsequent registrations require admin
    void prismaUser.user
      .count()
      .then((count) => {
        if (count === 0) return next(); // allow first user
        requireAuth(req, res, () => requireRole("admin")(req, res, next));
      })
      .catch(next);
  },
  async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim() : "";
    const role =
      typeof body.role === "string" &&
      ["admin", "reviewer", "uploader"].includes(body.role)
        ? body.role
        : "uploader";

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const existing = await prismaUser.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "A user with that email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await prismaUser.user.create({
      data: { email, passwordHash, role, displayName },
    });

    logger.info("User registered", { userId: user.id, role: user.role });

    res.status(201).json({
      user: buildUserPayload(user),
    });
  },
);

// GET /api/auth/me
// Returns the current user with full org context and app-init state.
// Frontend calls this on mount to validate the stored token and refresh context.
router.get("/me", requireAuth, async (req, res) => {
  const payload = getRequestUser(req);
  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const user = await prismaUser.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    user: buildUserPayload(user),
    appInitialized: !!user.organizationId,
    appInitState: resolveAppInitState(user),
  });
});

// Timing-safe dummy hash comparison to prevent user enumeration on login miss
async function bcryptFakeCompare(): Promise<void> {
  await verifyPassword(
    "dummy",
    "$2a$12$invalidhashpaddingtomakeittimeconstant00000000000000000",
  );
}

export { router as authRouter };

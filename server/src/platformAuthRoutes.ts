import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./db.js";
import { hashPassword, signToken } from "./auth.js";
import { CURRENT_PROGRAM_DOMAIN, PLATFORM_LAUNCH_TOKEN_SECRET } from "./config.js";
import { logger } from "./logger.js";
import { getTenantScopeForUser } from "./tenant.js";

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
    create: (args: {
      data: {
        organizationId: string;
        email: string;
        passwordHash: string;
        role: string;
        displayName: string;
      };
    }) => Promise<AuthUserRecord>;
  };
};

function resolveAppInitState(user: AuthUserRecord): "not_initialized" | "no_org" | "ready" {
  if (!user.organizationId) return "no_org";
  return "ready";
}

function buildUserPayload(user: AuthUserRecord, organizationId: string) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    organizationId,
    organizationName: user.organizationName ?? undefined,
    programDomain: CURRENT_PROGRAM_DOMAIN,
  };
}

// POST /consume  (mounted at /api/platform-auth)
// Dev-server equivalent of nxt-lvl-api's POST /api/platform-auth/consume.
// Verifies a platform launch token and issues a local Chronicle JWT.
router.post("/consume", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const launchToken = typeof body.launchToken === "string" ? body.launchToken : "";

  if (!launchToken) {
    res.status(400).json({ error: "launchToken is required" });
    return;
  }

  let claims: {
    type?: string;
    userId: string;
    email: string;
    role: string;
    organizationId: string;
    programDomain: string;
  };

  try {
    claims = jwt.verify(launchToken, PLATFORM_LAUNCH_TOKEN_SECRET) as typeof claims;
  } catch {
    res.status(401).json({ error: "Invalid or expired launch token" });
    return;
  }

  if (claims.type !== "launch") {
    res.status(401).json({ error: "Invalid token type" });
    return;
  }

  if (claims.programDomain !== CURRENT_PROGRAM_DOMAIN) {
    res.status(403).json({ error: "Launch token is not valid for this program" });
    return;
  }

  const email = claims.email.trim().toLowerCase();
  const role = ["admin", "reviewer", "uploader"].includes(claims.role)
    ? (claims.role as "admin" | "reviewer" | "uploader")
    : "uploader";

  let user = await prismaUser.user.findUnique({ where: { email } });

  if (!user) {
    const passwordHash = await hashPassword(`platform-no-login-${Date.now()}`);
    user = await prismaUser.user.create({
      data: {
        organizationId: claims.organizationId,
        email,
        passwordHash,
        role,
        displayName: email.split("@")[0],
      },
    });
    logger.info("Platform user created (dev)", { userId: user.id, email, role });
  }

  const tenantScope = getTenantScopeForUser(user);
  const appInitState = resolveAppInitState(user);
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: tenantScope.organizationId,
    programDomain: CURRENT_PROGRAM_DOMAIN,
  });

  logger.info("Platform login successful (dev)", { userId: user.id });

  res.json({
    token,
    accessToken: token,
    user: buildUserPayload(user, tenantScope.organizationId),
    appInitialized: appInitState === "ready",
    appInitState,
  });
});

export { router as platformAuthRouter };

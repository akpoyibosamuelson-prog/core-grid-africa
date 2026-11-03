// ── Server-side authorisation guards ──────────────────────────────────────────
// These are the real gates. Hiding a menu item in the client is presentation,
// never protection: every admin procedure runs through `assertPlatformAdmin`,
// which re-reads the caller's role from the DATABASE on each request rather
// than trusting anything the browser sent.
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "./_core/db";
import { users } from "../drizzle/schema";
import type { SessionUser } from "../shared/types";

/**
 * Confirm the caller is a platform administrator.
 *
 * The session's `role` is a convenience copy; this re-reads `users.role` from
 * the database so a role revoked mid-session takes effect immediately, and a
 * forged/stale token cannot claim admin. Throws FORBIDDEN otherwise.
 */
export async function assertPlatformAdmin(user: SessionUser | null): Promise<SessionUser> {
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row || row.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform administrator access required." });
  }
  return { id: row.id, email: row.email, name: row.name, role: "admin" };
}

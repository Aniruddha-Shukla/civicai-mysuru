/**
 * Grant the OPERATOR role to an existing account (operators cannot self-register).
 *   npx tsx scripts/promote-operator.ts someone@mcc.example
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npx tsx scripts/promote-operator.ts <email>");
  const db = new PrismaClient();
  try {
    const profile = await db.profile.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!profile) throw new Error(`No profile found for ${email}. The user must sign in once first.`);
    await db.profile.update({ where: { id: profile.id }, data: { role: "OPERATOR", wardId: null } });
    await db.auditLog.create({ data: { actorId: null, action: "profile.promote_operator", entity: "Profile", entityId: profile.id, metadata: { email, by: "cli" } } });
    console.log(`${email} is now an OPERATOR.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

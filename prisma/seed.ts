import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { BUILT_IN_CATEGORIES } from "../src/lib/categories";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const db = new PrismaClient({ adapter });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@certprep.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "CertPrep@2026";
const ADMIN_NAME = "Platform Admin";

async function main() {
  for (const cat of BUILT_IN_CATEGORIES) {
    await db.examCategory.upsert({
      where: { slug: cat.slug },
      create: { ...cat, isBuiltIn: true },
      update: { label: cat.label, description: cat.description, isBuiltIn: true },
    });
  }
  console.log(`Seeded ${BUILT_IN_CATEGORIES.length} exam categories.`);

  let admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (!admin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    admin = await db.user.create({
      data: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash,
        role: Role.ADMIN,
      },
    });
    console.log("Seeded admin account:");
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
  } else {
    console.log(`Admin already exists: ${ADMIN_EMAIL}`);
  }

  const removed = await db.question.deleteMany({ where: { pdfUploadId: null } });
  if (removed.count > 0) {
    console.log(`Removed ${removed.count} demo questions (not from PDF uploads).`);
  }

  const approved = await db.question.updateMany({
    where: { reviewStatus: "pending" },
    data: { reviewStatus: "approved" },
  });
  if (approved.count > 0) {
    console.log(`Marked ${approved.count} existing questions as approved.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

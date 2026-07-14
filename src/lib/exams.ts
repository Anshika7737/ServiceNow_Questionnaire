import { db } from "./db";

export async function isValidExamType(value: string): Promise<boolean> {
  const category = await db.examCategory.findUnique({ where: { slug: value } });
  return !!category;
}

export async function getExamLabel(value: string): Promise<string> {
  const category = await db.examCategory.findUnique({ where: { slug: value } });
  return category?.label ?? value;
}

export async function listExamCategories() {
  return db.examCategory.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { label: "asc" }],
  });
}

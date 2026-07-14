import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listExamCategories } from "@/lib/exams";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const categories = await listExamCategories();
  return NextResponse.json({
    categories: categories.map((c) => ({
      slug: c.slug,
      label: c.label,
      description: c.description,
      isBuiltIn: c.isBuiltIn,
    })),
  });
}

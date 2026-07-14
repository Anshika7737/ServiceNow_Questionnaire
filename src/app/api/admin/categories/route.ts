import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";
import { BUILT_IN_CATEGORIES, slugifyCategoryLabel } from "@/lib/categories";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const categories = await db.examCategory.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { label: "asc" }],
  });

  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const label = (body.label as string)?.trim();
  const description = (body.description as string)?.trim();

  if (!label) {
    return NextResponse.json({ error: "Label is required." }, { status: 400 });
  }

  let slug = slugifyCategoryLabel(label);
  const builtInSlugs = new Set<string>(BUILT_IN_CATEGORIES.map((c) => c.slug));
  if (builtInSlugs.has(slug)) {
    return NextResponse.json(
      { error: "A built-in category with this name already exists." },
      { status: 409 }
    );
  }

  const existing = await db.examCategory.findUnique({ where: { slug } });
  if (existing) {
    let suffix = 2;
    while (await db.examCategory.findUnique({ where: { slug: `${slug}_${suffix}` } })) {
      suffix++;
    }
    slug = `${slug}_${suffix}`;
  }

  const category = await db.examCategory.create({
    data: {
      slug,
      label,
      description: description || label,
      isBuiltIn: false,
    },
  });

  return NextResponse.json({ category });
}

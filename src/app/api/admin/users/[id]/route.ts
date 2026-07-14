import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const disabled = body.disabled as boolean | undefined;

  if (typeof disabled !== "boolean") {
    return NextResponse.json(
      { error: "disabled must be a boolean." },
      { status: 400 }
    );
  }

  if (id === session.userId) {
    return NextResponse.json(
      { error: "You cannot disable your own account." },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, disabled: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
    return NextResponse.json(
      { error: "Only managers and admins can be disabled." },
      { status: 400 }
    );
  }

  if (disabled && user.role === Role.ADMIN) {
    const otherActiveAdmins = await db.user.count({
      where: {
        role: Role.ADMIN,
        disabled: false,
        id: { not: id },
      },
    });

    if (otherActiveAdmins === 0) {
      return NextResponse.json(
        { error: "Cannot disable the last active admin." },
        { status: 400 }
      );
    }
  }

  const updated = await db.user.update({
    where: { id },
    data: { disabled },
    select: {
      id: true,
      name: true,
      email: true,
      disabled: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user: updated });
}

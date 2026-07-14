import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== Role.MANAGER) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  const invite = await db.invite.findUnique({
    where: { id },
    select: { id: true, senderId: true, role: true, used: true, expiresAt: true },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (invite.senderId !== session.userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (invite.role !== Role.USER) {
    return NextResponse.json({ error: "Cannot delete this invite." }, { status: 400 });
  }

  if (invite.used) {
    return NextResponse.json(
      { error: "Cannot delete an invite that was already accepted." },
      { status: 400 }
    );
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite has already expired." }, { status: 400 });
  }

  await db.invite.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

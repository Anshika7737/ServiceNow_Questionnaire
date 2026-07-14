import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== Role.MANAGER) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  const [users, pendingInvites] = await Promise.all([
    db.user.findMany({
      where: { invitedById: session.userId, role: Role.USER },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        disabled: true,
        createdAt: true,
      },
    }),
    db.invite.findMany({
      where: {
        senderId: session.userId,
        role: Role.USER,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        token: true,
        createdAt: true,
      },
    }),
  ]);

  const pendingRows = pendingInvites.map((invite) => ({
    kind: "invite" as const,
    id: invite.id,
    email: invite.email,
    name: null as string | null,
    status: "pending" as const,
    inviteUrl: `${baseUrl}/invite?token=${invite.token}`,
    createdAt: invite.createdAt.toISOString(),
  }));

  const merged = [
    ...users.map((user) => ({
      kind: "user" as const,
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.disabled ? ("disabled" as const) : ("active" as const),
      inviteUrl: null as string | null,
      createdAt: user.createdAt.toISOString(),
    })),
    ...pendingRows,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeCount = users.filter((u) => !u.disabled).length;
  const pendingCount = pendingInvites.length;
  const total = merged.length;
  const skip = (page - 1) * limit;
  const items = merged.slice(skip, skip + limit);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages,
    activeCount,
    pendingCount,
  });
}

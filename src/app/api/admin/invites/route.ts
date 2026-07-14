import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

function mapInvite(
  invite: {
    id: string;
    email: string;
    examFocus: string | null;
    used: boolean;
    expiresAt: Date;
    createdAt: Date;
    token: string;
  },
  baseUrl: string
) {
  return {
    id: invite.id,
    email: invite.email,
    examFocus: invite.examFocus,
    used: invite.used,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    inviteUrl: invite.used ? null : `${baseUrl}/invite?token=${invite.token}`,
    status: invite.used
      ? "accepted"
      : invite.expiresAt < new Date()
        ? "expired"
        : "pending",
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const roleParam = searchParams.get("role");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  if (roleParam !== Role.MANAGER && roleParam !== Role.ADMIN) {
    return NextResponse.json(
      { error: "Invalid role. Use MANAGER or ADMIN." },
      { status: 400 }
    );
  }

  const where = { role: roleParam as typeof Role.MANAGER | typeof Role.ADMIN };
  const skip = (page - 1) * limit;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  const [total, invites] = await Promise.all([
    db.invite.count({ where }),
    db.invite.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        examFocus: true,
        used: true,
        expiresAt: true,
        createdAt: true,
        token: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({
    invites: invites.map((invite) => mapInvite(invite, baseUrl)),
    total,
    page,
    limit,
    totalPages,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required." }, { status: 400 });
  }

  const invite = await db.invite.findUnique({
    where: { token },
  });

  if (!invite || invite.used || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid invite." }, { status: 404 });
  }

  return NextResponse.json({
    invite: {
      email: invite.email,
      role: invite.role,
      examFocus: invite.examFocus,
    },
  });
}

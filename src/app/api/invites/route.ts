import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email";
import { Role } from "@/generated/prisma/client";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== Role.ADMIN && session.role !== Role.MANAGER) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, role, examFocus } = body as {
      email: string;
      role: Role;
      examFocus?: string;
    };

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (session.role === Role.MANAGER) {
      if (role !== Role.USER) {
        return NextResponse.json(
          { error: "Managers can only invite users." },
          { status: 403 }
        );
      }
    }

    if (session.role === Role.ADMIN && role === Role.USER) {
      return NextResponse.json(
        { error: "Admins invite managers or other admins. Managers invite users." },
        { status: 400 }
      );
    }

    if (session.role === Role.ADMIN && role !== Role.MANAGER && role !== Role.ADMIN) {
      return NextResponse.json({ error: "Invalid role for admin invite." }, { status: 400 });
    }


    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 }
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await db.invite.create({
      data: {
        email: normalizedEmail,
        role,
        examFocus: role === Role.MANAGER ? examFocus ?? null : null,
        token,
        expiresAt,
        senderId: session.userId,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const inviteUrl = `${baseUrl}/invite?token=${invite.token}`;

    const emailResult = await sendInviteEmail({
      to: invite.email,
      role: invite.role,
      inviteUrl,
      inviterName: session.name,
      expiresAt: invite.expiresAt,
    });

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        examFocus: invite.examFocus,
        inviteUrl,
        expiresAt: invite.expiresAt,
        emailSent: emailResult.sent,
        emailError: emailResult.error,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

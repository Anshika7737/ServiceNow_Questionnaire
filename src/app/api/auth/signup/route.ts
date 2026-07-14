import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, inviteToken } = body as {
      name: string;
      email: string;
      password: string;
      inviteToken?: string;
    };

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    if (!inviteToken) {
      return NextResponse.json(
        { error: "Registration requires a valid invite link." },
        { status: 403 }
      );
    }

    const invite = await db.invite.findUnique({
      where: { token: inviteToken },
    });

    if (!invite || invite.used) {
      return NextResponse.json(
        { error: "Invalid or already used invite link." },
        { status: 400 }
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invite link has expired." },
        { status: 400 }
      );
    }

    if (invite.email.toLowerCase() !== normalizedEmail) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address." },
        { status: 400 }
      );
    }

    const role = invite.role;
    const examFocus = invite.examFocus;
    const invitedById = invite.senderId;

    await db.invite.update({
      where: { id: invite.id },
      data: { used: true },
    });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role,
        examFocus,
        invitedById,
      },
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        examFocus: user.examFocus,
      },
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

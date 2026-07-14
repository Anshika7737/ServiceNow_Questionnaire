import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "quizlet-dev-secret-change-in-production"
);

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
  examFocus?: string | null;
}

const COOKIE_NAME = "quizlet-session";

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      disabled: true,
      email: true,
      name: true,
      role: true,
      examFocus: true,
    },
  });

  if (!user || user.disabled) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    examFocus: user.examFocus,
  };
}

export { COOKIE_NAME };

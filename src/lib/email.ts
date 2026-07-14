import nodemailer from "nodemailer";
import { EmailClient } from "@azure/communication-email";
import { ROLE_LABELS } from "./constants";
import { Role } from "@/generated/prisma/client";

function buildInviteContent({
  role,
  inviteUrl,
  inviterName,
  expiresAt,
}: {
  role: Role;
  inviteUrl: string;
  inviterName: string;
  expiresAt: Date;
}) {
  const roleLabel = ROLE_LABELS[role as keyof typeof ROLE_LABELS];
  const expires = expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; color: #0f172a;">
      <h2 style="color: #4f46e5; margin-bottom: 8px;">You're invited to CertPrep</h2>
      <p style="color: #64748b; margin-top: 0;">
        ${inviterName} invited you to join as <strong>${roleLabel}</strong>.
      </p>
      <p>Click the button below to set your password and activate your account:</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${inviteUrl}"
           style="background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Accept invite &amp; set password
        </a>
      </p>
      <p style="font-size: 13px; color: #64748b;">
        Or copy this link:<br />
        <a href="${inviteUrl}" style="color: #4f46e5; word-break: break-all;">${inviteUrl}</a>
      </p>
      <p style="font-size: 13px; color: #94a3b8;">
        This invite expires on ${expires}. If you didn't expect this email, you can ignore it.
      </p>
    </div>
  `;

  const text = [
    `You're invited to CertPrep`,
    ``,
    `${inviterName} invited you to join as ${roleLabel}.`,
    ``,
    `Set your password here: ${inviteUrl}`,
    ``,
    `This invite expires on ${expires}.`,
  ].join("\n");

  return {
    roleLabel,
    subject: `CertPrep invite — join as ${roleLabel}`,
    html,
    text,
  };
}

function isAzureEmailConfigured(): boolean {
  return Boolean(
    process.env.AZURE_COMMUNICATION_CONNECTION_STRING &&
      process.env.AZURE_EMAIL_SENDER_ADDRESS
  );
}

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  );
}

async function sendViaAzure({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING!;
  const sender = process.env.AZURE_EMAIL_SENDER_ADDRESS!;

  try {
    const client = new EmailClient(connectionString);
    const poller = await client.beginSend({
      senderAddress: sender,
      content: { subject, html, plainText: text },
      recipients: { to: [{ address: to }] },
    });

    const result = await poller.pollUntilDone();
    if (result.status === "Succeeded") {
      return { sent: true };
    }
    return { sent: false, error: result.error?.message || `Status: ${result.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Azure email failed.";
    console.error("Azure invite email failed:", message);
    return { sent: false, error: message };
  }
}

async function sendViaSmtp({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true";
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: { minVersion: "TLSv1.2" },
    });

    await transport.sendMail({ from, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP failed.";
    console.error("SMTP invite email failed:", message);
    return { sent: false, error: message };
  }
}

export async function sendInviteEmail({
  to,
  role,
  inviteUrl,
  inviterName,
  expiresAt,
}: {
  to: string;
  role: Role;
  inviteUrl: string;
  inviterName: string;
  expiresAt: Date;
}): Promise<{ sent: boolean; error?: string }> {
  const content = buildInviteContent({ role, inviteUrl, inviterName, expiresAt });

  if (isAzureEmailConfigured()) {
    return sendViaAzure({ to, ...content });
  }

  if (isSmtpConfigured()) {
    return sendViaSmtp({ to, ...content });
  }

  return { sent: false, error: "Email not configured. Set Azure ACS or SMTP env vars." };
}

export { isAzureEmailConfigured, isSmtpConfigured };

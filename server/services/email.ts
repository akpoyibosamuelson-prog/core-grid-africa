// ── Email notifications ──────────────────────────────────────────────────────
// Wraps the platform's email primitive. When no email provider is configured
// the platform primitive throws; we catch and report `sent: false` so a
// notification never breaks the business action that triggered it.
import { sendEmail } from "../_core/email";

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendNotificationEmail(input: EmailInput): Promise<{ sent: boolean; error?: string }> {
  try {
    await sendEmail(input);
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "email failed" };
  }
}

/** Branded HTML wrapper for Core Grid Africa notification emails. */
export function emailTemplate(title: string, body: string, ctaUrl?: string, ctaLabel?: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F5F7FA;font-family:Inter,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0A1F44;border-radius:12px 12px 0 0;padding:20px 24px">
      <span style="color:#fff;font-weight:700;font-size:16px">CORE GRID <span style="color:#8FB0FF">AFRICA</span></span>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px">
      <h1 style="margin:0 0 12px;font-size:20px;color:#0A1F44">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#475569">${body}</div>
      ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:20px;background:#1E4FD8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">${ctaLabel ?? "Open dashboard"}</a>` : ""}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">Powering Businesses. Connecting Growth.</p>
  </div></body></html>`;
}

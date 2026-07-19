import type { TemplateId } from '@safari-shule/shared-types';

type Renderer = (params: Record<string, string | number>) => { subject?: string; body: string; html?: string };

const REGISTRY: Record<TemplateId, Renderer> = {
  'student.boarded': (p) => ({
    body: `${p.studentName} has safely boarded Bus ${p.vehicleReg} at ${p.time}.`,
  }),
  'student.alighted': (p) => ({
    body: `${p.studentName} has safely alighted from Bus ${p.vehicleReg} at ${p.time} (${p.location ?? 'school'}).`,
  }),
  invitation: (p) => ({
    subject: 'You have been invited to Safari Shule',
    body: `Hello ${p.fullName}, you have been invited to join ${p.tenantName}. Use this link to set your password: ${p.acceptUrl}`,
    html: `<p>Hello <strong>${p.fullName}</strong>,</p><p>You have been invited to join <strong>${p.tenantName}</strong> on Safari Shule.</p><p><a href="${p.acceptUrl}">Set your password</a></p>`,
  }),
  'parent.otp': (p) => ({
    body: `Your Safari Shule verification code is ${p.code}. Expires in 5 minutes.`,
  }),
  'sos.alert': (p) => ({
    body: `URGENT SOS: ${p.tripDescription} reported by ${p.reportedBy}. Last known location: ${p.location}. Please respond immediately.`,
  }),
  'mpesa.receipt': (p) => ({
    subject: `M-Pesa receipt — KES ${p.amount}`,
    body: `Receipt ${p.receiptNumber}: KES ${p.amount} for ${p.description}.`,
    html: `<h3>M-Pesa Receipt</h3><p>${p.description}</p><p><strong>KES ${p.amount}</strong></p><p>Receipt: ${p.receiptNumber}</p>`,
  }),
  'monthly.statement': (p) => ({
    subject: `Monthly transport statement — ${p.period}`,
    body: `Your statement for ${p.period} totalling KES ${p.total} is attached.`,
    html: `<p>Hello ${p.parentName},</p><p>Your transport statement for <strong>${p.period}</strong> totalling <strong>KES ${p.total}</strong> is attached.</p>`,
  }),
  'auth.activation': (p) => ({
    subject: `Activate your Safari Shule account — ${p.tenantName}`,
    body: `Hello ${p.fullName}, your account for ${p.tenantName} is ready. Activate it and set your password here: ${p.activateUrl}  This link expires in ${p.ttlHours} hours.`,
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#18181b;max-width:560px;margin:40px auto;padding:0 16px">
<h2 style="color:#10b981">Welcome to Safari Shule</h2>
<p>Hello <strong>${p.fullName}</strong>,</p>
<p>Your account for <strong>${p.tenantName}</strong> has been created. Click the button below to activate it and set your password.</p>
<p style="margin:28px 0"><a href="${p.activateUrl}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Activate account</a></p>
<p style="font-size:13px;color:#71717a">This link expires in <strong>${p.ttlHours} hours</strong>. If you did not expect this email, you can safely ignore it.</p>
<p style="font-size:13px;color:#71717a">Or copy this URL: <a href="${p.activateUrl}">${p.activateUrl}</a></p>
</body></html>`,
  }),
  'auth.reset-password': (p) => ({
    subject: 'Reset your Safari Shule password',
    body: `Hello ${p.fullName}, you requested a password reset. Reset it here: ${p.resetUrl}  This link expires in ${p.ttlMinutes} minutes.`,
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#18181b;max-width:560px;margin:40px auto;padding:0 16px">
<h2 style="color:#10b981">Password reset</h2>
<p>Hello <strong>${p.fullName}</strong>,</p>
<p>We received a request to reset the password for your Safari Shule account. Click the button below to set a new password.</p>
<p style="margin:28px 0"><a href="${p.resetUrl}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
<p style="font-size:13px;color:#71717a">This link expires in <strong>${p.ttlMinutes} minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
<p style="font-size:13px;color:#71717a">Or copy this URL: <a href="${p.resetUrl}">${p.resetUrl}</a></p>
</body></html>`,
  }),
};

export function renderTemplate(id: TemplateId, params: Record<string, string | number>) {
  const renderer = REGISTRY[id];
  if (!renderer) throw new Error(`Unknown template: ${id}`);
  return renderer(params);
}

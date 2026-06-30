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
};

export function renderTemplate(id: TemplateId, params: Record<string, string | number>) {
  const renderer = REGISTRY[id];
  if (!renderer) throw new Error(`Unknown template: ${id}`);
  return renderer(params);
}

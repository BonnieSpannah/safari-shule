import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function key(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error('DATA_ENCRYPTION_KEY env var not set');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    return createHash('sha256').update(raw).digest();
  }
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

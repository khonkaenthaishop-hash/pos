import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256-bit

function getKey(): Buffer {
  const hexKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY env variable is not set');
  }
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `GMAIL_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars), got ${key.length} bytes`,
    );
  }
  return key;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string in format: iv:authTag:encrypted
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt ciphertext produced by encrypt().
 * Input format: iv:authTag:encrypted (all base64)
 */
export function decrypt(encryptedString: string): string {
  const key = getKey();
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format — expected iv:authTag:encrypted');
  }

  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

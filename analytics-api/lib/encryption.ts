import crypto from 'crypto';

// Use ENCRYPTION_KEY from environment, or derive a stable dev key so encrypted passwords
// remain readable after server restarts in local development.
let ENCRYPTION_KEY: Buffer;
if (process.env.ENCRYPTION_KEY) {
  ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  if (ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string');
  }
} else {
  ENCRYPTION_KEY = crypto.createHash('sha256').update('librechat-dev-encryption-key').digest();
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100_000, 32, 'sha256');
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(ENCRYPTION_KEY, salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Format: iv:salt:tag:encrypted
  return `${iv.toString('hex')}:${salt.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(hash: string): string {
  const parts = hash.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted text format');

  const iv = Buffer.from(parts[0], 'hex');
  const salt = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const encryptedText = parts[3];

  const tryDecrypt = (key: Buffer) => {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  };

  try {
    return tryDecrypt(ENCRYPTION_KEY);
  } catch {
    const derivedKey = deriveKey(ENCRYPTION_KEY, salt);
    return tryDecrypt(derivedKey);
  }
}

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Krypterar integrationernas tokens (AES-256-GCM) innan de sparas. Läcker
 * tabellen ska den inte ge åtkomst till kundernas konton. Varje integration
 * har sin egen nyckel i en miljövariabel.
 */
export function tokenCipher(envName: string) {
  function key(): Buffer {
    const secret = process.env[envName];
    if (!secret) throw new Error(`${envName} saknas`);
    return createHash('sha256').update(secret).digest();
  }

  return {
    encrypt(plain: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key(), iv);
      const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
    },
    decrypt(stored: string): string {
      const buf = Buffer.from(stored, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
      decipher.setAuthTag(buf.subarray(12, 28));
      return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}

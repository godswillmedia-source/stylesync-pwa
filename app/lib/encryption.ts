/**
 * Encryption Service
 * Simple encryption/decryption for OAuth tokens
 * Copied from MCP salon-mcp-server for direct calendar sync
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits

export class EncryptionService {
  private key: Buffer;

  constructor(encryptionKey?: string) {
    // Use provided key or get from environment
    const keyString = encryptionKey || process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

    // Derive a 256-bit key from the string
    this.key = crypto.scryptSync(keyString, 'salt', KEY_LENGTH);
  }

  /**
   * Encrypt a string value
   */
  encrypt(plaintext: string): string {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      // Return iv:authTag:encrypted as a single string
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted string
   */
  decrypt(encrypted: string): string {
    try {
      // Split the encrypted string into components
      const parts = encrypted.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const ciphertext = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }
}

// Singleton instance
let encryptionInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionInstance) {
    encryptionInstance = new EncryptionService();
  }
  return encryptionInstance;
}

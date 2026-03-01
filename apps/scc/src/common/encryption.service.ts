import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Service für Verschlüsselung von sensiblen Daten (z. B. DB-Passwörter)
 * Verwendet AES-256-GCM für symmetrische Verschlüsselung
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 64;
  private readonly tagLength = 16;

  constructor(private configService: ConfigService) {}

  /**
   * Verschlüsselt einen Text
   * @param plaintext Der zu verschlüsselnde Text
   * @returns Verschlüsselter Text im Format: salt:iv:tag:encrypted
   */
  encrypt(plaintext: string): string {
    const encryptionKey = this.getEncryptionKey();
    const salt = crypto.randomBytes(this.saltLength);
    const iv = crypto.randomBytes(this.ivLength);

    // Key-Derivation mit PBKDF2
    const key = crypto.pbkdf2Sync(
      encryptionKey,
      salt,
      100000, // Iterations
      this.keyLength,
      'sha256'
    );

    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Format: salt:iv:tag:encrypted
    return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  /**
   * Entschlüsselt einen verschlüsselten Text
   * @param encryptedText Verschlüsselter Text im Format: salt:iv:tag:encrypted
   * @returns Entschlüsselter Text
   */
  decrypt(encryptedText: string): string {
    const encryptionKey = this.getEncryptionKey();
    const parts = encryptedText.split(':');

    if (parts.length !== 4) {
      throw new Error('Ungültiges Verschlüsselungsformat');
    }

    const [saltHex, ivHex, tagHex, encrypted] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    // Key-Derivation mit PBKDF2
    const key = crypto.pbkdf2Sync(
      encryptionKey,
      salt,
      100000, // Iterations
      this.keyLength,
      'sha256'
    );

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Holt den Verschlüsselungsschlüssel aus der Umgebung
   * Falls nicht gesetzt, wird ein Dev-Key verwendet (NICHT für Produktion!)
   */
  private getEncryptionKey(): string {
    const key = this.configService.get<string>('ENCRYPTION_KEY');

    if (!key) {
      console.warn('⚠️  ENCRYPTION_KEY nicht gesetzt! Verwende Dev-Key (NICHT für Produktion!)');
      return 'dev-encryption-key-change-in-production-min-32-chars';
    }

    if (key.length < 32) {
      throw new Error('ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein');
    }

    return key;
  }
}

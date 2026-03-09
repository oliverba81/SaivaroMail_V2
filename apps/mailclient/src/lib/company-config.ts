import { PoolClient } from 'pg';
import * as crypto from 'crypto';

export type AiProvider = 'openai' | 'google';

export interface CompanyConfig {
  openaiApiKey: string | null;
  openaiModel: string;
  elevenlabsApiKey: string | null;
  elevenlabsVoiceId: string | null;
  elevenlabsEnabled: boolean;
  themeRequired?: boolean;
  /** Nach wie vielen Tagen gelöscht markierte E-Mails endgültig gelöscht werden (0 = nie). */
  permanentDeleteAfterDays?: number;
  aiProvider: AiProvider;
  geminiApiKey: string | null;
  geminiModel: string;
}

// Zentrale Definition der erlaubten OpenAI-Modelle
export const AVAILABLE_OPENAI_MODELS = [
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4-turbo',
] as const;

export type OpenAIModel = typeof AVAILABLE_OPENAI_MODELS[number];

export function isValidOpenAIModel(model: string): model is OpenAIModel {
  return AVAILABLE_OPENAI_MODELS.includes(model as OpenAIModel);
}

// Zentrale Definition der erlaubten Gemini-Modelle
export const AVAILABLE_GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
] as const;

export type GeminiModel = typeof AVAILABLE_GEMINI_MODELS[number];

export function isValidGeminiModel(model: string): model is GeminiModel {
  return AVAILABLE_GEMINI_MODELS.includes(model as GeminiModel);
}

const VALID_AI_PROVIDERS: AiProvider[] = ['openai', 'google'];

export function isValidAiProvider(provider: string): provider is AiProvider {
  return VALID_AI_PROVIDERS.includes(provider as AiProvider);
}

export async function getCompanyConfig(client: PoolClient): Promise<CompanyConfig> {
  const result = await client.query(
    `SELECT openai_api_key, openai_model, elevenlabs_api_key, elevenlabs_voice_id, elevenlabs_enabled, theme_required, permanent_delete_after_days, ai_provider, gemini_api_key, gemini_model 
     FROM company_config WHERE id = 'company_config'`
  );
  
  if (result.rows.length === 0) {
    // Erstelle Standard-Konfiguration
    await client.query(
      `INSERT INTO company_config (id, openai_api_key, openai_model, elevenlabs_api_key, elevenlabs_voice_id, elevenlabs_enabled, theme_required, permanent_delete_after_days, ai_provider, gemini_api_key, gemini_model) 
       VALUES ('company_config', NULL, 'gpt-4o-mini', NULL, NULL, false, false, 0, 'openai', NULL, 'gemini-2.0-flash')`
    );
    return { 
      openaiApiKey: null, 
      openaiModel: 'gpt-4o-mini',
      elevenlabsApiKey: null,
      elevenlabsVoiceId: null,
      elevenlabsEnabled: false,
      themeRequired: false,
      permanentDeleteAfterDays: 0,
      aiProvider: 'openai',
      geminiApiKey: null,
      geminiModel: 'gemini-2.0-flash',
    };
  }
  
  const row = result.rows[0];
  
  const config: CompanyConfig = {
    openaiApiKey: row.openai_api_key ? decryptApiKey(row.openai_api_key) : null,
    openaiModel: row.openai_model || 'gpt-4o-mini',
    elevenlabsApiKey: row.elevenlabs_api_key ? decryptApiKey(row.elevenlabs_api_key) : null,
    elevenlabsVoiceId: row.elevenlabs_voice_id || null,
    elevenlabsEnabled: row.elevenlabs_enabled ?? false,
    themeRequired: row.theme_required ?? false,
    permanentDeleteAfterDays: row.permanent_delete_after_days != null ? Math.max(0, parseInt(String(row.permanent_delete_after_days), 10) || 0) : 0,
    aiProvider: (row.ai_provider === 'google' ? 'google' : 'openai') as AiProvider,
    geminiApiKey: row.gemini_api_key ? decryptApiKey(row.gemini_api_key) : null,
    geminiModel: row.gemini_model || 'gemini-2.0-flash',
  };
  
  return config;
}

export async function saveCompanyConfig(
  client: PoolClient,
  config: Partial<CompanyConfig>
): Promise<void> {
  // Prüfe, ob Werte explizit gesetzt wurden (auch wenn leer/null)
  const hasOpenAIKey = 'openaiApiKey' in config;
  const hasElevenLabsKey = 'elevenlabsApiKey' in config;
  const hasOpenAIModel = 'openaiModel' in config;
  const hasElevenLabsVoiceId = 'elevenlabsVoiceId' in config;
  const hasElevenLabsEnabled = 'elevenlabsEnabled' in config;
  const hasThemeRequired = 'themeRequired' in config;
  const hasPermanentDeleteAfterDays = 'permanentDeleteAfterDays' in config;
  const hasAiProvider = 'aiProvider' in config;
  const hasGeminiKey = 'geminiApiKey' in config;
  const hasGeminiModel = 'geminiModel' in config;

  // Wenn Key explizit gesetzt wurde (auch wenn null), verschlüssele oder setze null
  const encryptedOpenAIKey = hasOpenAIKey 
    ? (config.openaiApiKey && config.openaiApiKey.trim() !== '' ? encryptApiKey(config.openaiApiKey) : null)
    : undefined;
  
  const encryptedElevenLabsKey = hasElevenLabsKey
    ? (config.elevenlabsApiKey && config.elevenlabsApiKey.trim() !== '' ? encryptApiKey(config.elevenlabsApiKey) : null)
    : undefined;
  
  const encryptedGeminiKey = hasGeminiKey
    ? (config.geminiApiKey && config.geminiApiKey.trim() !== '' ? encryptApiKey(config.geminiApiKey) : null)
    : undefined;
  
  const aiProvider = hasAiProvider && isValidAiProvider(config.aiProvider ?? '')
    ? config.aiProvider
    : hasAiProvider ? (config.aiProvider || 'openai') : undefined;
  
  const geminiModel = hasGeminiModel && config.geminiModel && isValidGeminiModel(config.geminiModel)
    ? config.geminiModel
    : hasGeminiModel ? (config.geminiModel || 'gemini-2.0-flash') : undefined;
  
  const openaiModel = hasOpenAIModel && config.openaiModel && isValidOpenAIModel(config.openaiModel) 
    ? config.openaiModel 
    : hasOpenAIModel ? (config.openaiModel || 'gpt-4o-mini') : undefined;
  
  const elevenlabsVoiceId = hasElevenLabsVoiceId 
    ? (config.elevenlabsVoiceId || null) 
    : undefined;
  
  const elevenlabsEnabled = hasElevenLabsEnabled
    ? Boolean(config.elevenlabsEnabled)
    : undefined;

  const themeRequired = hasThemeRequired
    ? Boolean(config.themeRequired)
    : undefined;
  
  const permanentDeleteAfterDays = hasPermanentDeleteAfterDays && config.permanentDeleteAfterDays !== undefined
    ? Math.max(0, Math.floor(Number(config.permanentDeleteAfterDays)) || 0)
    : undefined;
  
  // Baue UPDATE-Query dynamisch auf, nur für gesetzte Felder
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (hasOpenAIKey) {
    updates.push(`openai_api_key = $${paramIndex}`);
    values.push(encryptedOpenAIKey);
    paramIndex++;
  }
  
  if (hasOpenAIModel) {
    updates.push(`openai_model = $${paramIndex}`);
    values.push(openaiModel);
    paramIndex++;
  }
  
  if (hasElevenLabsKey) {
    updates.push(`elevenlabs_api_key = $${paramIndex}`);
    values.push(encryptedElevenLabsKey);
    paramIndex++;
  }
  
  if (hasElevenLabsVoiceId) {
    updates.push(`elevenlabs_voice_id = $${paramIndex}`);
    values.push(elevenlabsVoiceId);
    paramIndex++;
  }
  
  if (hasElevenLabsEnabled) {
    updates.push(`elevenlabs_enabled = $${paramIndex}`);
    values.push(elevenlabsEnabled);
    paramIndex++;
  }
  
  if (hasThemeRequired) {
    updates.push(`theme_required = $${paramIndex}`);
    values.push(themeRequired);
    paramIndex++;
  }
  
  if (hasPermanentDeleteAfterDays && permanentDeleteAfterDays !== undefined) {
    updates.push(`permanent_delete_after_days = $${paramIndex}`);
    values.push(permanentDeleteAfterDays);
    paramIndex++;
  }
  
  if (hasAiProvider && aiProvider !== undefined) {
    updates.push(`ai_provider = $${paramIndex}`);
    values.push(aiProvider);
    paramIndex++;
  }
  
  if (hasGeminiKey) {
    updates.push(`gemini_api_key = $${paramIndex}`);
    values.push(encryptedGeminiKey);
    paramIndex++;
  }
  
  if (hasGeminiModel && geminiModel !== undefined) {
    updates.push(`gemini_model = $${paramIndex}`);
    values.push(geminiModel);
    paramIndex++;
  }
  
  if (updates.length === 0) {
    return; // Keine Änderungen
  }
  
  updates.push('updated_at = NOW()');
  
  const query = `
    INSERT INTO company_config (id, openai_api_key, openai_model, elevenlabs_api_key, elevenlabs_voice_id, elevenlabs_enabled, permanent_delete_after_days, ai_provider, gemini_api_key, gemini_model, updated_at)
     VALUES ('company_config', NULL, 'gpt-4o-mini', NULL, NULL, false, 0, 'openai', NULL, 'gemini-2.0-flash', NOW())
     ON CONFLICT (id) 
     DO UPDATE SET ${updates.join(', ')}
  `;
  
  console.log('Saving company config:', {
    hasOpenAIKey,
    hasElevenLabsKey,
    hasOpenAIModel,
    hasAiProvider,
    hasGeminiKey,
    hasGeminiModel,
    hasElevenLabsVoiceId,
    hasElevenLabsEnabled,
    hasThemeRequired,
    updates,
    values: values.map((v, i) => ({
      param: i + 1,
      type: typeof v,
      isNull: v === null,
      length: v ? (typeof v === 'string' ? v.length : 'N/A') : 'N/A',
    })),
  });
  
  await client.query(query, values);
  
  // Verifiziere, dass die Daten gespeichert wurden
  const verifyResult = await client.query(
    `SELECT openai_api_key, openai_model, elevenlabs_api_key, elevenlabs_voice_id, elevenlabs_enabled, theme_required, permanent_delete_after_days, ai_provider, gemini_api_key, gemini_model FROM company_config WHERE id = 'company_config'`
  );
  console.log('Verification after save:', {
    hasOpenAIKey: !!verifyResult.rows[0]?.openai_api_key,
    hasElevenLabsKey: !!verifyResult.rows[0]?.elevenlabs_api_key,
    hasGeminiKey: !!verifyResult.rows[0]?.gemini_api_key,
    openaiModel: verifyResult.rows[0]?.openai_model,
    geminiModel: verifyResult.rows[0]?.gemini_model,
    aiProvider: verifyResult.rows[0]?.ai_provider,
    elevenlabsVoiceId: verifyResult.rows[0]?.elevenlabs_voice_id,
    elevenlabsEnabled: verifyResult.rows[0]?.elevenlabs_enabled,
    themeRequired: verifyResult.rows[0]?.theme_required,
    permanentDeleteAfterDays: verifyResult.rows[0]?.permanent_delete_after_days,
  });
}

// Verschlüsselung mit AES-256-GCM (gleiche Logik wie in scc-client.ts)
function encryptApiKey(key: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-in-production-min-32-chars';
  
  if (encryptionKey.length < 32) {
    throw new Error('ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein');
  }
  
  const salt = crypto.randomBytes(64);
  const iv = crypto.randomBytes(16);
  
  // Key-Derivation mit PBKDF2
  const derivedKey = crypto.pbkdf2Sync(
    encryptionKey,
    salt,
    100000, // Iterations
    32, // keyLength (256 bits)
    'sha256',
  );
  
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Format: salt:iv:tag:encrypted
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function decryptApiKey(encryptedText: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-in-production-min-32-chars';
  const parts = encryptedText.split(':');
  
  if (parts.length !== 4) {
    throw new Error('Ungültiges Verschlüsselungsformat');
  }
  
  const [saltHex, ivHex, tagHex, encrypted] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  // Key-Derivation mit PBKDF2
  const derivedKey = crypto.pbkdf2Sync(
    encryptionKey,
    salt,
    100000, // Iterations
    32, // keyLength
    'sha256',
  );
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Validierung für API-Keys
export function validateOpenAIApiKey(apiKey: string | null | undefined): { valid: boolean; error?: string } {
  if (!apiKey) {
    return { valid: true }; // Optional
  }
  
  if (!apiKey.startsWith('sk-')) {
    return { valid: false, error: 'OpenAI API-Key muss mit "sk-" beginnen' };
  }
  
  if (apiKey.length < 20) {
    return { valid: false, error: 'OpenAI API-Key muss mindestens 20 Zeichen lang sein' };
  }
  
  return { valid: true };
}

export function validateElevenLabsApiKey(apiKey: string | null | undefined): { valid: boolean; error?: string } {
  if (!apiKey) {
    return { valid: true }; // Optional
  }
  
  // ElevenLabs API-Keys haben kein spezifisches Format, aber sollten nicht leer sein
  if (apiKey.length < 10) {
    return { valid: false, error: 'ElevenLabs API-Key muss mindestens 10 Zeichen lang sein' };
  }
  
  return { valid: true };
}

export function validateGeminiApiKey(apiKey: string | null | undefined): { valid: boolean; error?: string } {
  if (!apiKey) {
    return { valid: true }; // Optional
  }
  
  if (!apiKey.startsWith('AIza')) {
    return { valid: false, error: 'Google Gemini API-Key beginnt typischerweise mit "AIza"' };
  }
  
  if (apiKey.length < 20) {
    return { valid: false, error: 'Google Gemini API-Key muss mindestens 20 Zeichen lang sein' };
  }
  
  return { valid: true };
}

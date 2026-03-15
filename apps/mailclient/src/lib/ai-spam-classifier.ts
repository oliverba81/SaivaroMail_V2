import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import type { CompanyConfig } from './company-config';
import type { EmailDataForAutomation } from './automation-engine';
import { stripHtml } from '@/utils/signature-placeholders';

const MAX_EMAIL_BODY_LENGTH = 8000;
const SPAM_CLASSIFIER_TIMEOUT_MS = 10_000;

export interface SpamClassificationResult {
  isSpam: boolean;
  score?: number;
  reason?: string;
  provider: 'openai' | 'google';
  fromCache?: boolean;
}

function buildSpamPrompt(email: EmailDataForAutomation) {
  const subject = email.subject || '(Kein Betreff)';
  const fromEmail = email.fromEmail || '(Unbekannt)';

  let bodyText = email.body || '';
  bodyText = stripHtml(bodyText)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (bodyText.length > MAX_EMAIL_BODY_LENGTH) {
    bodyText = bodyText.substring(0, MAX_EMAIL_BODY_LENGTH) + '...';
  }

  const systemPrompt =
    'Du bist ein Assistent, der E-Mails nach Spam klassifiziert. ' +
    'Antworte ausschließlich mit einem JSON-Objekt der Form ' +
    '{"isSpam": boolean, "score": number, "reason": string} ohne zusätzlichen Text.';

  const userPrompt = `Analysiere, ob diese Nachricht Spam ist.

Betreff: ${subject}
Von: ${fromEmail}

Inhalt:
${bodyText}`;

  return { systemPrompt, userPrompt };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Spam-Check Timeout überschritten'));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function parseSpamResponse(raw: string): { isSpam: boolean; score?: number; reason?: string } {
  try {
    const trimmed = raw.trim();
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    const jsonString =
      jsonStart !== -1 && jsonEnd !== -1 ? trimmed.substring(jsonStart, jsonEnd + 1) : trimmed;

    const parsed = JSON.parse(jsonString);
    const isSpam = Boolean(parsed.isSpam);
    const score =
      typeof parsed.score === 'number'
        ? parsed.score
        : parsed.score != null
        ? Number(parsed.score)
        : undefined;
    const reason = typeof parsed.reason === 'string' ? parsed.reason : undefined;

    return { isSpam, score, reason };
  } catch (err) {
    console.error('[AI-Spam] Fehler beim Parsen der Spam-Antwort:', err, 'Raw:', raw);
    return { isSpam: false, score: undefined, reason: 'Parsing-Fehler, Standard: kein Spam' };
  }
}

export async function classifyEmailSpam(
  companyConfig: CompanyConfig,
  email: EmailDataForAutomation
): Promise<SpamClassificationResult> {
  const provider: 'openai' | 'google' =
    companyConfig.aiProvider === 'google' ? 'google' : 'openai';

  const { systemPrompt, userPrompt } = buildSpamPrompt(email);

  try {
    if (provider === 'google') {
      if (!companyConfig.geminiApiKey || !companyConfig.geminiApiKey.trim()) {
        throw new Error('Google Gemini API-Key ist nicht konfiguriert');
      }

      const ai = new GoogleGenAI({ apiKey: companyConfig.geminiApiKey });

      const response = await withTimeout(
        ai.models.generateContent({
          model: companyConfig.geminiModel || 'gemini-2.0-flash',
          contents: `${systemPrompt}\n\n${userPrompt}`,
        }) as Promise<any>,
        SPAM_CLASSIFIER_TIMEOUT_MS
      );

      const text = (response as any)?.text?.() ?? (response as any)?.text;
      const raw = typeof text === 'function' ? text() : text;
      if (!raw || typeof raw !== 'string') {
        throw new Error('Gemini hat keine gültige Spam-Antwort geliefert');
      }

      const parsed = parseSpamResponse(raw);
      return {
        isSpam: parsed.isSpam,
        score: parsed.score,
        reason: parsed.reason,
        provider,
      };
    }

    // OpenAI
    if (!companyConfig.openaiApiKey || !companyConfig.openaiApiKey.trim()) {
      throw new Error('OpenAI API-Key ist nicht konfiguriert');
    }

    const openai = new OpenAI({ apiKey: companyConfig.openaiApiKey });

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: companyConfig.openaiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      }),
      SPAM_CLASSIFIER_TIMEOUT_MS
    );

    const content = (completion as any).choices?.[0]?.message?.content;
    const raw =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
        ? content.map((c: any) => c.text ?? c).join(' ')
        : String(content ?? '');

    const parsed = parseSpamResponse(raw);

    return {
      isSpam: parsed.isSpam,
      score: parsed.score,
      reason: parsed.reason,
      provider,
    };
  } catch (error: any) {
    const message = String(error?.message || error || 'Unbekannter Fehler beim Spam-Check');
    const isQuotaError =
      message.includes('RESOURCE_EXHAUSTED') ||
      message.includes('exceeded your current quota') ||
      message.includes('429');

    console.error('[AI-Spam] Fehler beim Spam-Check:', message);

    return {
      isSpam: false,
      score: undefined,
      reason: isQuotaError
        ? 'AI-Quota/Rate-Limit erreicht, Standardentscheidung: kein Spam.'
        : 'Fehler beim Spam-Check, Standardentscheidung: kein Spam.',
      provider,
    };
  }
}


import { getCompanyDbConfig, getCompanyDbConfigBySlug } from './scc-client';

export interface CompanyFeatures {
  textToSpeech?: boolean;
  emailSummary?: boolean;
  audioFeatures?: boolean;
}

export async function getCompanyFeatures(companyId: string): Promise<CompanyFeatures> {
  const dbConfig = await getCompanyDbConfig(companyId);
  if (!dbConfig) {
    return { textToSpeech: false, emailSummary: false, audioFeatures: false };
  }
  
  // metadata kommt aus Company.metadata (wird von getCompanyDbConfig geladen)
  const metadata = dbConfig.metadata as any;
  const features = metadata?.features || {};
  
  // audioFeatures aktiviert beide Funktionen
  // Für Rückwärtskompatibilität: Wenn audioFeatures nicht gesetzt ist, prüfe die alten Flags
  const audioFeatures = features.audioFeatures ?? 
                   (features.textToSpeech && features.emailSummary ? true : false);
  
  return {
    textToSpeech: audioFeatures || (features.textToSpeech ?? false),
    emailSummary: audioFeatures || (features.emailSummary ?? false),
    audioFeatures: audioFeatures,
  };
}

export async function getCompanyFeaturesBySlug(companySlug: string): Promise<CompanyFeatures> {
  const dbConfig = await getCompanyDbConfigBySlug(companySlug);
  if (!dbConfig) {
    return { textToSpeech: false, emailSummary: false, audioFeatures: false };
  }
  
  const metadata = dbConfig.metadata as any;
  const features = metadata?.features || {};
  
  // audioFeatures aktiviert beide Funktionen
  // Für Rückwärtskompatibilität: Wenn audioFeatures nicht gesetzt ist, prüfe die alten Flags
  const audioFeatures = features.audioFeatures ?? 
                   (features.textToSpeech && features.emailSummary ? true : false);
  
  return {
    textToSpeech: audioFeatures || (features.textToSpeech ?? false),
    emailSummary: audioFeatures || (features.emailSummary ?? false),
    audioFeatures: audioFeatures,
  };
}

'use client';

import EmailThemes from '@/components/EmailThemes';

interface SettingsThemesTabProps {
  onError?: (error: string) => void;
  onBack?: () => void;
}

export default function SettingsThemesTab({
  onError: _onError,
  onBack: _onBack,
}: SettingsThemesTabProps) {
  // EmailThemes ist bereits selbstständig und benötigt keine Props
  return <EmailThemes />;
}


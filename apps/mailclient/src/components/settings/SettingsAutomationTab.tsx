'use client';

import AutomationRules from '@/components/AutomationRules';

interface SettingsAutomationTabProps {
  onError?: (error: string) => void;
  onBack?: () => void;
}

export default function SettingsAutomationTab({
  onError: _onError,
  onBack: _onBack,
}: SettingsAutomationTabProps) {
  // AutomationRules ist bereits selbstständig und benötigt keine Props
  return <AutomationRules />;
}


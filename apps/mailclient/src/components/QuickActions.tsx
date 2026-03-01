'use client';

import Button from './Button';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export default function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="flex gap-3 flex-wrap mb-6">
      {actions.map((action) => (
        <Button
          key={action.id}
          onClick={action.onClick}
          disabled={action.disabled}
          variant="primary"
          className="text-sm py-2 px-4"
          title={action.label}
        >
          <span>{action.icon}</span>
          <span>{action.label}</span>
        </Button>
      ))}
    </div>
  );
}


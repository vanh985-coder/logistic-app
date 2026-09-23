import React from 'react';
import { PackageOpen } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-surface-card rounded-2xl border border-dashed border-border-input ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-surface-subtle flex items-center justify-center text-primary mb-4 shadow-sm">
        {icon || <PackageOpen className="h-7 w-7" />}
      </div>
      <h4 className="text-base font-bold text-title">{title}</h4>
      <p className="text-xs sm:text-sm text-text-secondary max-w-sm mt-1 mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  containerClassName?: string;
  options?: Array<{ label: string; value: string | number; disabled?: boolean }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      children,
      options,
      className = '',
      containerClassName = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={`w-full space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-title tracking-tight"
          >
            {label}
            {props.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-surface-subtle flex items-center justify-center text-text-secondary pointer-events-none transition-colors">
              {leftIcon}
            </div>
          )}

          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`w-full h-11 bg-surface-card text-body text-sm rounded-xl border appearance-none transition-all duration-150 disabled:bg-surface-subtle disabled:text-text-muted disabled:cursor-not-allowed ${
              leftIcon ? 'pl-11' : 'pl-3.5'
            } pr-10 ${
              error
                ? 'border-rose-500 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20'
                : 'border-border-input hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20'
            } focus:outline-none ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>

        {error ? (
          <p className="text-xs text-rose-600 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-text-secondary">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';

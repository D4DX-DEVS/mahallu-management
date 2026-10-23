import * as React from 'react';
import Select from './Select';

export interface AppSelectOption {
  value: string;
  label: string;
}

export interface AppSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

/**
 * Value-based wrapper (`onChange(value)`) over the shared, searchable Select,
 * so every dropdown in the app looks and behaves the same.
 */
const AppSelect = React.forwardRef<HTMLSelectElement, AppSelectProps>(
  ({ value, onChange, options, placeholder, disabled = false, label, error, helperText, required }, ref) => (
    <Select
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      label={label}
      error={error}
      helperText={helperText}
      required={required}
    />
  )
);

AppSelect.displayName = 'AppSelect';

export default AppSelect;

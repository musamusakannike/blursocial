import React from 'react';

interface DurationOption {
  label: string;
  value: string;
}

interface DurationsProps {
  value: string;
  onChange: (value: string) => void;
}

const DURATION_OPTIONS: DurationOption[] = [
  { label: '1h', value: '1' },
  { label: '12h', value: '12' },
  { label: '24h', value: '24' },
  { label: '3d', value: '72' },
  { label: '1w', value: '168' },
  { label: '∞', value: '0' },
];

export const Durations: React.FC<DurationsProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[var(--text-secondary)] tracking-[-0.01em]">
        Room Duration
      </label>
      
      <div className="flex p-1 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl">
        {DURATION_OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-[var(--shadow-sm)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        {value === '0' 
          ? 'This room will never expire.' 
          : `The room and all its messages will be deleted after ${value === '168' ? '1 week' : value === '72' ? '3 days' : value + ' hours'}.`
        }
      </p>
    </div>
  );
};

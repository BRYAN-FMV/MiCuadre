import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { DateFilterPeriod, DATE_FILTER_OPTIONS } from '../../lib/dateFilter';

interface DateFilterBarProps {
  value: DateFilterPeriod;
  onChange: (period: DateFilterPeriod) => void;
  customDate?: string;
  onCustomDateChange?: (date: string) => void;
  showIcon?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  value,
  onChange,
  customDate = new Date().toISOString().split('T')[0],
  onCustomDateChange,
  showIcon = true,
  style
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.4rem',
        ...style
      }}
    >
      {showIcon && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: '#64748b',
            marginRight: '0.2rem'
          }}
        >
          <Clock size={14} />
          <span>Periodo:</span>
        </span>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.3rem',
          background: '#f1f5f9',
          padding: '0.25rem',
          borderRadius: '10px'
        }}
      >
        {DATE_FILTER_OPTIONS.map((opt) => {
          const isSelected = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.65rem',
                fontSize: '0.78rem',
                fontWeight: isSelected ? 800 : 600,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                background: isSelected ? '#059669' : 'transparent',
                color: isSelected ? '#ffffff' : '#475569',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 1px 3px rgba(5, 150, 105, 0.3)' : 'none',
                minHeight: '32px'
              }}
            >
              {opt.key === 'CUSTOM' && <Calendar size={13} />}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {value === 'CUSTOM' && onCustomDateChange && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: '#ffffff',
            border: '1px solid #059669',
            padding: '0.2rem 0.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <Calendar size={14} color="#059669" />
          <input
            type="date"
            value={customDate}
            onChange={(e) => onCustomDateChange(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#0f172a',
              background: 'transparent',
              cursor: 'pointer'
            }}
          />
        </div>
      )}
    </div>
  );
};

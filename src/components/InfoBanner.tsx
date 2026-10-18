import { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Lightbulb, X } from 'lucide-react';

interface InfoBannerProps {
  title: string;
  children: React.ReactNode;
  variant?: 'info' | 'tip' | 'legend';
  defaultOpen?: boolean;
  dismissable?: boolean;
}

export function InfoBanner({ title, children, variant = 'info', defaultOpen = true, dismissable = false }: InfoBannerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isInfo = variant === 'info';
  const isTip = variant === 'tip';

  const containerStyle: React.CSSProperties = {
    borderRadius: '8px',
    border: isInfo
      ? '1px solid #1e40af'
      : isTip
        ? '1px solid #92400e'
        : '1px solid #334155',
    backgroundColor: isInfo
      ? '#172554'
      : isTip
        ? '#451a03'
        : '#1e293b',
    overflow: 'hidden',
  };

  const iconColor = isInfo ? '#60a5fa' : isTip ? '#fbbf24' : '#94a3b8';
  const titleColor = isInfo ? '#93c5fd' : isTip ? '#fcd34d' : '#cbd5e1';
  const Icon = isTip ? Lightbulb : Info;

  return (
    <div style={containerStyle}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Icon size={14} style={{ color: iconColor, flexShrink: 0 }} />
        <span style={{ color: titleColor, fontSize: '12px', fontWeight: 500, flex: 1 }}>{title}</span>
        {dismissable && (
          <span
            onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
            style={{ padding: '2px', cursor: 'pointer', display: 'flex' }}
          >
            <X size={12} style={{ color: '#64748b' }} />
          </span>
        )}
        {open
          ? <ChevronUp size={12} style={{ color: '#64748b', flexShrink: 0 }} />
          : <ChevronDown size={12} style={{ color: '#64748b', flexShrink: 0 }} />
        }
      </div>
      {open && (
        <div style={{
          padding: '0 12px 10px',
          fontSize: '11px',
          lineHeight: '1.6',
          color: '#94a3b8',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

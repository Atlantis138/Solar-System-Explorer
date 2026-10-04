import React from 'react';
import './settings.css';

export function Section({ title, theme, children, action }: { title: string; theme: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className={`settings-section theme-${theme}`} aria-label={title}>
    <div className="settings-section-heading"><h3>{title}</h3>{action}</div>{children}
  </section>;
}

export function Toggle({ label, description, checked, onChange, disabled = false }: {
  label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  return <button type="button" className="settings-toggle" role="switch" aria-label={label} aria-checked={checked}
    disabled={disabled} onClick={() => onChange(!checked)}>
    <span className="settings-label">{label}{description && <small>{description}</small>}</span>
    <span className="settings-switch" aria-hidden="true"><span /></span>
  </button>;
}

export function Slider({ label, value, max = 3, min = 0, step = .05, display, onChange }: {
  label: string; value: number; max?: number; min?: number; step?: number; display?: string; onChange: (value: number) => void;
}) {
  const upper = Math.max(max, value);
  return <label className="settings-slider"><span className="settings-row"><span>{label}</span><output>{display ?? `${Math.round(value * 100)}%`}</output></span>
    <input aria-label={label} type="range" min={min} max={upper} step={step} value={value}
      style={{ '--progress': `${Math.max(0, Math.min(100, (value - min) / (upper - min) * 100))}%` } as React.CSSProperties}
      onChange={e => onChange(Number(e.target.value))} />
  </label>;
}

export function Segments<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly { value: T; label: string }[]; value?: string; onChange: (value: T) => void;
}) {
  return <div className="settings-options"><span className="settings-option-label">{label}</span>
    <div className="settings-segments" role="group" aria-label={label}>{options.map(option =>
      <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>
    )}</div>
  </div>;
}

export function Select({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: React.ReactNode;
}) {
  return <label className="settings-row settings-select"><span>{label}</span>
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select>
  </label>;
}

/** Inline choices retain full touch targets without one full-width row each. */
export function CompactChoice({label,ariaLabel,checked,onChange}:{
  label:string;ariaLabel:string;checked:boolean;onChange:(checked:boolean)=>void;
}) {
  return <label className="settings-compact-choice">
    <input type="checkbox" aria-label={ariaLabel} checked={checked} onChange={e=>onChange(e.target.checked)} />
    <span>{label}</span>
  </label>;
}

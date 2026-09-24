const TONES = {
  HIGH: 'bg-error-container text-error',
  CRITICAL: 'bg-error-container text-error',
  error: 'bg-error-container text-error',
  rejected: 'bg-error-container text-error',
  MEDIUM: 'bg-secondary-container/40 text-secondary',
  pending: 'bg-secondary-container/40 text-secondary',
  LOW: 'bg-tertiary-container/30 text-tertiary',
  ACTIVE: 'bg-tertiary-container/30 text-tertiary',
  routed: 'bg-tertiary-container/30 text-tertiary',
  PROTECTED: 'bg-tertiary-container/30 text-tertiary',
  HEALTHY: 'bg-tertiary-container/30 text-tertiary',
  neutral: 'bg-surface-container-highest text-on-surface-variant'
};

/** KPI-micro uppercase status badge matching the design system's severity chips (error/moderate/nominal). */
export default function Badge({ tone, children }) {
  const classes = TONES[tone] || TONES.neutral;
  return (
    <span className={`px-space-xs py-space-3xs font-kpi-micro text-kpi-micro uppercase font-bold inline-block whitespace-nowrap ${classes}`}>
      {children}
    </span>
  );
}

const TONES = {
  HIGH: 'bg-error-container/80 text-error border-error/40 shadow-[0_0_10px_rgba(255,180,171,0.2)]',
  CRITICAL: 'bg-error-container/80 text-error border-error/40 shadow-[0_0_10px_rgba(255,180,171,0.2)]',
  error: 'bg-error-container/80 text-error border-error/40 shadow-[0_0_10px_rgba(255,180,171,0.2)]',
  rejected: 'bg-error-container/80 text-error border-error/40 shadow-[0_0_10px_rgba(255,180,171,0.2)]',
  MEDIUM: 'bg-secondary-container/50 text-secondary border-secondary/30',
  pending: 'bg-secondary-container/50 text-secondary border-secondary/30',
  LOW: 'bg-tertiary/15 text-tertiary border-tertiary/30',
  ACTIVE: 'bg-tertiary/15 text-tertiary border-tertiary/30',
  routed: 'bg-tertiary/15 text-tertiary border-tertiary/30',
  PROTECTED: 'bg-tertiary/15 text-tertiary border-tertiary/30',
  HEALTHY: 'bg-tertiary/15 text-tertiary border-tertiary/30',
  neutral: 'bg-surface-container-highest/80 text-on-surface-variant border-white/[0.08]'
};

/** Rounded pill status badge matching the design system's severity chips (error/moderate/nominal). */
export default function Badge({ tone, children }) {
  const classes = TONES[tone] || TONES.neutral;
  return (
    <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold tracking-wide inline-block whitespace-nowrap ${classes}`}>
      {children}
    </span>
  );
}

const DANGER = 'bg-error/15 text-error border-error/50';
const CAUTION = 'bg-primary/10 text-primary border-primary/50';
const CLEAR = 'bg-tertiary/10 text-tertiary border-tertiary/50';

const TONES = {
  HIGH: DANGER,
  CRITICAL: DANGER,
  error: DANGER,
  rejected: DANGER,
  MEDIUM: CAUTION,
  pending: CAUTION,
  LOW: CLEAR,
  ACTIVE: CLEAR,
  routed: CLEAR,
  PROTECTED: CLEAR,
  HEALTHY: CLEAR,
  neutral: 'bg-surface-container-high text-on-surface-variant border-white/[0.12]'
};

// Stencilled status tag: square corners and a status square, so state reads by shape as well as colour.
export default function Badge({ tone, children }) {
  const classes = TONES[tone] || TONES.neutral;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border font-mono text-[10px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap ${classes}`}>
      <span className="w-1.5 h-1.5 bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

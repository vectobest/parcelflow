const DANGER = 'bg-error/15 text-error border-error/50';
const CAUTION = 'bg-caution/10 text-caution border-caution/50';
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

// Status tag with a marker next to the label, so state reads by more than colour alone.
const KIND = { [DANGER]: 'danger', [CAUTION]: 'caution', [CLEAR]: 'clear' };

export default function Badge({ tone, children }) {
  const classes = TONES[tone] || TONES.neutral;
  return (
    <span data-tone={KIND[classes] || 'neutral'} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-badge border font-mono text-[10px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap ${classes}`}>
      <span className="w-1.5 h-1.5 rounded-badge bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

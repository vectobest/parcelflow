const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-fixed-dim',
  ghost: 'bg-surface-container-highest text-on-surface hover:text-primary hover:bg-surface-container-high',
  outline: 'bg-transparent border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container',
  danger: 'bg-error-container text-error hover:bg-error hover:text-on-error'
};

const SIZES = {
  sm: 'px-space-xs py-space-3xs text-kpi-micro font-kpi-micro',
  md: 'px-space-md py-space-xs text-code-sm font-code-sm'
};

/** Flush, uppercase, mono-set button matching the design system (no rounded corners, active:translate press feedback). */
export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-space-xs uppercase font-bold transition-colors active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

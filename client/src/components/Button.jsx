const VARIANTS = {
  primary: 'bg-gradient-to-r from-primary via-[#bca1fa] to-primary text-on-primary shadow-[0_0_20px_rgba(208,188,255,0.3)] hover:shadow-[0_0_28px_rgba(208,188,255,0.5)]',
  ghost: 'bg-surface-container/90 hover:bg-surface-container-high border border-white/[0.08] hover:border-white/[0.15] text-on-surface-variant hover:text-white',
  outline: 'bg-transparent border border-white/[0.1] text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60',
  danger: 'bg-error-container/80 text-error hover:bg-error hover:text-on-error border border-error/30'
};

const SIZES = {
  sm: 'px-3 py-1.5 text-[11px] rounded-lg',
  md: 'px-4 py-2 text-[13px] rounded-xl'
};

/** Rounded, softly glowing button matching the design system (lift + scale press feedback). */
export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none disabled:transform-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

import { motion } from 'motion/react';

const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-fixed-dim',
  ghost: 'bg-surface-container hover:bg-surface-container-high border border-white/[0.1] hover:border-white/[0.2] text-on-surface',
  outline: 'bg-transparent border border-white/[0.14] text-on-surface-variant hover:text-on-surface hover:border-primary/60',
  danger: 'bg-error-container text-error hover:bg-error hover:text-on-error border border-error/40'
};

const SIZES = {
  sm: 'px-2.5 py-1 text-[11px] rounded-sm',
  md: 'px-3.5 py-1.5 text-[12px] rounded-sm'
};

const PRESS_SPRING = { type: 'spring', visualDuration: 0.15, bounce: 0 };

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={PRESS_SPRING}
      className={`inline-flex items-center justify-center gap-2 font-bold uppercase tracking-[0.06em] transition-colors disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

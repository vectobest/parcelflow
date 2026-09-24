import { motion } from 'motion/react';

const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-fixed-dim shadow-sm',
  ghost: 'bg-surface-container/90 hover:bg-surface-container-high border border-white/[0.08] hover:border-white/[0.15] text-on-surface-variant hover:text-white',
  outline: 'bg-transparent border border-white/[0.1] text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60',
  danger: 'bg-error-container/80 text-error hover:bg-error hover:text-on-error border border-error/30'
};

const SIZES = {
  sm: 'px-3 py-1.5 text-[11px] rounded-lg',
  md: 'px-4 py-2 text-[13px] rounded-xl'
};

const PRESS_SPRING = { type: 'spring', visualDuration: 0.15, bounce: 0 };

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={PRESS_SPRING}
      className={`inline-flex items-center justify-center gap-2 font-bold transition-colors disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

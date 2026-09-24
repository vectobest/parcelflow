const controlClass = 'w-full bg-surface-container/60 hover:bg-surface-container rounded-xl border border-white/[0.08] focus:border-primary/60 text-on-surface font-code-sm text-code-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 transition-all';

export function Field({ label, htmlFor, children }) {
  return (
    <div>
      {label && <label htmlFor={htmlFor} className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70 mb-1.5">{label}</label>}
      {children}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return <select className={`${controlClass} ${className}`} {...props}>{children}</select>;
}

export function TextArea({ className = '', ...props }) {
  return <textarea className={`${controlClass} ${className}`} {...props} />;
}

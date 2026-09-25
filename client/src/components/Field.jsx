const controlClass = 'field-control w-full bg-surface-container-lowest rounded-sm border border-white/[0.22] hover:border-white/[0.36] focus:border-primary text-on-surface font-mono text-[13px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 transition-colors';

export function Field({ label, htmlFor, children }) {
  return (
    <div>
      {label && <label htmlFor={htmlFor} className="block font-mono text-[10px] uppercase tracking-[0.14em] text-on-surface-variant mb-1.5">{label}</label>}
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

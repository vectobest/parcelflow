const controlClass = 'w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-code-sm text-code-sm px-space-sm py-space-xs focus:outline-none focus:border-primary disabled:opacity-50';

export function Field({ label, htmlFor, children }) {
  return (
    <div>
      {label && <label htmlFor={htmlFor} className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-space-2xs">{label}</label>}
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

import Icon from './Icon.jsx';

export default function Panel({ icon, title, meta, actions, children, className = '', bodyClassName = 'p-4' }) {
  return (
    <div className={`rounded-sm bg-surface-container-low border border-white/[0.08] flex flex-col ${className}`}>
      {(icon || title || actions) && (
        <div className="px-4 pt-3 pb-2.5 flex items-center justify-between flex-wrap gap-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <Icon name={icon} className="text-[16px] text-primary shrink-0" />}
            {title && <span className="font-display font-extrabold uppercase text-[15px] tracking-[0.02em] text-white truncate">{title}</span>}
            {meta && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-on-surface-variant px-1.5 py-0.5 rounded-sm border border-white/[0.1] shrink-0">{meta}</span>}
          </div>
          {actions && <div className="flex items-center gap-space-sm font-code-sm text-code-sm text-on-surface-variant">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

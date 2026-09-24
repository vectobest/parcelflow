import Icon from './Icon.jsx';

export default function Panel({ icon, title, meta, actions, children, className = '', bodyClassName = 'p-5' }) {
  return (
    <div className={`rounded-2xl bg-surface-container-low border border-white/[0.08] shadow-md flex flex-col ${className}`}>
      {(icon || title || actions) && (
        <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="w-7 h-7 rounded-lg bg-tertiary/15 border border-tertiary/30 text-tertiary flex items-center justify-center shrink-0">
                <Icon name={icon} className="text-[16px]" />
              </span>
            )}
            {title && <span className="font-bold text-[16px] tracking-tight text-white truncate">{title}</span>}
            {meta && <span className="font-code-sm text-code-sm text-on-surface-variant px-2 py-0.5 rounded-md bg-surface-container shrink-0">{meta}</span>}
          </div>
          {actions && <div className="flex items-center gap-space-sm font-code-sm text-code-sm text-on-surface-variant">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

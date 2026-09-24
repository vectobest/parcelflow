import Icon from './Icon.jsx';

/** Flush "brutalist" container matching the design system's stepped-surface panels: an optional bg-surface-container-high header strip over a bg-surface-container-low body, no rounded corners. */
export default function Panel({ icon, title, meta, actions, children, className = '', bodyClassName = 'p-space-sm' }) {
  return (
    <div className={`bg-surface-container-low flex flex-col ${className}`}>
      {(icon || title || actions) && (
        <div className="bg-surface-container-high px-space-md py-space-2xs flex items-center justify-between flex-wrap gap-space-2xs">
          <div className="flex items-center gap-space-xs min-w-0">
            {icon && <Icon name={icon} className="text-[16px] text-tertiary shrink-0" />}
            {title && <span className="font-headline-md text-headline-md tracking-tight text-on-surface uppercase font-bold truncate">{title}</span>}
            {meta && <span className="font-code-sm text-code-sm text-on-surface-variant px-space-2xs bg-surface-container shrink-0">{meta}</span>}
          </div>
          {actions && <div className="flex items-center gap-space-sm font-code-sm text-code-sm text-on-surface-variant">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

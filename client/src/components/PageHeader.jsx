export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-3">
      <div className="flex flex-col items-start">
        {eyebrow && (
          <span className="eyebrow inline-block bg-primary text-on-primary font-mono text-[9px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 mb-1.5 rounded-sm">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display font-black uppercase text-[22px] sm:text-[26px] leading-tight tracking-[0.01em] text-white">{title}</h1>
        {description && <p className="text-[13px] text-on-surface-variant mt-1 leading-snug max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

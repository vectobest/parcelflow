export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
      <div className="flex flex-col items-start">
        {eyebrow && (
          <span className="inline-block bg-primary text-on-primary font-mono text-[10px] font-semibold uppercase tracking-[0.16em] px-2 py-1 mb-3 rounded-sm">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display font-black uppercase text-[40px] sm:text-[52px] leading-[0.9] tracking-[0.01em] text-white">{title}</h1>
        {description && <p className="text-[15px] text-on-surface-variant mt-3 leading-relaxed max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

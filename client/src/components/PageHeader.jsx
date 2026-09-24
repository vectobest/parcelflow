export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col">
        {eyebrow && <span className="block text-[11px] font-bold uppercase tracking-widest text-tertiary mb-2">{eyebrow}</span>}
        <h1 className="text-[26px] sm:text-[30px] font-extrabold text-white tracking-tight leading-tight bg-gradient-to-r from-white via-on-surface to-on-surface-variant bg-clip-text">{title}</h1>
        {description && <p className="text-[13px] text-on-surface-variant font-medium mt-2 leading-relaxed max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

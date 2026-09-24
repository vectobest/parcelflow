export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-space-md mb-space-sm">
      <div>
        {eyebrow && <span className="block font-label-caps text-label-caps uppercase text-tertiary mb-space-3xs">{eyebrow}</span>}
        <h1 className="font-display-xl-mobile text-display-xl-mobile text-on-surface font-bold">{title}</h1>
        {description && <p className="mt-space-2xs font-body-compact text-body-compact text-on-surface-variant max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-space-sm">{actions}</div>}
    </div>
  );
}

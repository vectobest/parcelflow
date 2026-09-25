import { useEffect, useMemo, useRef, useState } from 'react';
import { tableWrap, table, thead, th, tr, td } from './table.js';

const HEIGHT = 260;
const MARGIN = { top: 14, right: 150, bottom: 30, left: 44 };
const LABEL_GAP = 14;

// Round the axis top up to 1 / 2 / 5 x 10^k so ticks land on clean numbers.
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

const formatTime = (iso, withSeconds = false) => (iso
  ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}) })
  : 'Start');
const formatCount = (n) => n.toLocaleString();

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/**
 * Running totals per series over batches: one 2px line each, end dots ringed in the surface colour,
 * a legend, direct end labels where they don't collide, and a crosshair tooltip on pointer and keyboard.
 * `series`: [{ key, label, color }]; `points`: [{ at, parcels, values: { [key]: n } }]; `chrome`: theme ink/grid colours.
 */
export default function TrendChart({ series, points, chrome, title }) {
  const [containerRef, width] = useWidth();
  const [active, setActive] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const narrow = width < 560;
  const m = narrow ? { ...MARGIN, right: 14 } : MARGIN;
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = HEIGHT - m.top - m.bottom;
  const valueAt = (point, key) => point.values[key] || 0;

  const { ticks, x, y } = useMemo(() => {
    const max = Math.max(1, ...points.flatMap((p) => series.map((s) => valueAt(p, s.key))));
    const t = niceTicks(max);
    const top = t.at(-1);
    return {
      ticks: t,
      x: (i) => m.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2),
      y: (v) => m.top + plotH - (v / top) * plotH
    };
  }, [points, series, plotW, plotH, m.left, m.top]);

  const last = points.length - 1;
  // Batches minutes apart read fine as HH:MM; a burst within a few minutes needs seconds to tell steps apart.
  const withSeconds = points.length > 2 && new Date(points[last].at) - new Date(points[1].at) < 10 * 60 * 1000;
  const time = (iso) => formatTime(iso, withSeconds);

  // Direct end labels, highest line first; a label that would collide is dropped (legend + tooltip carry it).
  const endLabels = useMemo(() => {
    if (!points.length) return [];
    const placed = [];
    [...series]
      .map((s) => ({ ...s, value: valueAt(points[last], s.key), cy: y(valueAt(points[last], s.key)) }))
      .sort((a, b) => a.cy - b.cy)
      .forEach((s) => { if (!placed.some((p) => Math.abs(p.cy - s.cy) < LABEL_GAP)) placed.push(s); });
    return placed;
  }, [series, points, last, y]);

  const xTickIndexes = useMemo(() => {
    const wanted = Math.min(points.length, Math.max(2, Math.floor(plotW / 110)));
    const indexes = [...new Set(Array.from({ length: wanted }, (_, i) => Math.round((i / Math.max(1, wanted - 1)) * last)))];
    // Never print the same time twice along the axis.
    return indexes.filter((idx, n) => n === 0 || time(points[idx].at) !== time(points[indexes[n - 1]].at));
  }, [points, plotW, last, withSeconds]);

  function indexFromPointer(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left - m.left;
    if (points.length < 2) return 0;
    return Math.min(last, Math.max(0, Math.round((px / plotW) * last)));
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowRight') setActive((i) => Math.min(last, (i ?? -1) + 1));
    else if (event.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? last + 1) - 1));
    else if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(last);
    else if (event.key === 'Escape') setActive(null);
    else return;
    event.preventDefault();
  }

  const activePoint = active === null ? null : points[active];
  const tooltipLeft = active === null ? 0 : x(active) + 14;
  const flip = tooltipLeft + 200 > width;
  const summary = `${title}. ${series.map((s) => `${s.label} ${formatCount(valueAt(points[last], s.key))}`).join(', ')}.`;

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
              <svg width="16" height="8" aria-hidden="true"><line x1="1" y1="4" x2="15" y2="4" stroke={s.color} strokeWidth="2" strokeLinecap="round" /></svg>
              {s.label}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setShowTable((v) => !v)} className="text-[12px] underline underline-offset-2 text-on-surface-variant hover:text-on-surface">
          {showTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {showTable ? (
        <div className={tableWrap}>
          <table className={table}>
            <thead><tr className={thead}><th className={th}>After batch</th>{series.map((s) => <th key={s.key} className={`${th} text-right`}>{s.label}</th>)}</tr></thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i} className={tr}>
                  <td className={td}>{time(p.at)}{p.parcels ? ` (${p.parcels} parcels)` : ''}</td>
                  {series.map((s) => <td key={s.key} className={`${td} text-right tabular-nums`}>{formatCount(valueAt(p, s.key))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative w-full" style={{ height: HEIGHT }}>
          {width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={summary}
              tabIndex={0}
              className="block outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              onPointerMove={(e) => setActive(indexFromPointer(e))}
              onPointerLeave={() => setActive(null)}
              onKeyDown={onKeyDown}
              onBlur={() => setActive(null)}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? chrome.baseline : chrome.grid} strokeWidth="1" shapeRendering="crispEdges" />
                  <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={chrome.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCount(t)}</text>
                </g>
              ))}
              {xTickIndexes.map((i) => (
                <text key={i} x={x(i)} y={HEIGHT - 8} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} fontSize="11" fill={chrome.muted}>{time(points[i].at)}</text>
              ))}

              {active !== null && <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + plotH} stroke={chrome.muted} strokeWidth="1" shapeRendering="crispEdges" />}

              {series.map((s) => (
                <path
                  key={s.key}
                  d={points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(valueAt(p, s.key)).toFixed(1)}`).join('')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}

              {series.map((s) => {
                const i = active ?? last;
                return <circle key={s.key} cx={x(i)} cy={y(valueAt(points[i], s.key))} r="4" fill={s.color} stroke={chrome.surface} strokeWidth="2" />;
              })}

              {!narrow && endLabels.map((s) => (
                <text key={s.key} x={m.left + plotW + 10} y={s.cy} dy="0.32em" fontSize="12" fill={chrome.ink}>
                  <tspan fontWeight="700">{formatCount(s.value)}</tspan>
                  <tspan fill={chrome.secondary}>{` ${s.label}`}</tspan>
                </text>
              ))}
            </svg>
          )}

          {activePoint && (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-sm border px-3 py-2 text-[12px] shadow-md"
              style={{ left: flip ? undefined : tooltipLeft, right: flip ? width - x(active) + 14 : undefined, background: chrome.surface, borderColor: chrome.grid, color: chrome.ink }}
              role="status"
            >
              <div className="mb-1.5" style={{ color: chrome.secondary }}>
                {activePoint.at ? `After the ${time(activePoint.at)} batch (${activePoint.parcels} parcels)` : 'Before the first batch'}
              </div>
              <ul className="flex flex-col gap-1">
                {[...series].sort((a, b) => valueAt(activePoint, b.key) - valueAt(activePoint, a.key)).map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <svg width="12" height="8" aria-hidden="true"><line x1="1" y1="4" x2="11" y2="4" stroke={s.color} strokeWidth="2" strokeLinecap="round" /></svg>
                    <span className="font-bold tabular-nums min-w-[2.5ch] text-right" style={{ color: chrome.ink }}>{formatCount(valueAt(activePoint, s.key))}</span>
                    <span style={{ color: chrome.secondary }}>{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

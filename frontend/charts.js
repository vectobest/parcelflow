// Dependency-free SVG charts. Colours are CSS custom properties applied through the CSSOM,
// which the strict CSP (style-src 'self') allows and which follows light/dark theme changes.
const SVG_NS = 'http://www.w3.org/2000/svg';

function applyAttributes(node, attrs, isSvg) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.setAttribute('class', value);
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') for (const [property, v] of Object.entries(value)) node.style.setProperty(property, v);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (!isSvg && key in node && typeof value === 'boolean') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
}

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  applyAttributes(node, attrs, false);
  node.append(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

export function s(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttributes(node, attrs, true);
  node.append(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

/* ---------- colour ---------- */

const FIXED_COLOURS = {
  'Mail Department': 'var(--c-mail)',
  'Regular Department': 'var(--c-regular)',
  'Heavy Department': 'var(--c-heavy)',
  'Insurance Approval': 'var(--c-pending)',
  Rejected: 'var(--c-error)',
  routed: 'var(--c-routed)',
  pending: 'var(--c-pending)',
  error: 'var(--c-error)',
  rejected: 'var(--c-rejected)'
};
const EXTRA_COLOURS = ['var(--c-extra-1)', 'var(--c-extra-2)', 'var(--c-extra-3)', 'var(--c-extra-4)'];

export function colorFor(name) {
  if (FIXED_COLOURS[name]) return FIXED_COLOURS[name];
  const hash = [...String(name)].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);
  return EXTRA_COLOURS[hash % EXTRA_COLOURS.length];
}

const DECISION_ORDER = ['Mail Department', 'Regular Department', 'Heavy Department'];
export function decisionRank(name) {
  if (name === 'Insurance Approval') return 90;
  if (name === 'Rejected') return 99;
  const index = DECISION_ORDER.indexOf(name);
  return index === -1 ? 50 : index;
}

/* ---------- tooltip ---------- */

let tooltipNode;
function tooltip() {
  tooltipNode ||= document.getElementById('chart-tooltip');
  return tooltipNode;
}

function moveTooltip(event) {
  const tip = tooltip();
  const { innerWidth, innerHeight } = window;
  const rect = tip.getBoundingClientRect();
  const left = Math.min(event.clientX + 14, innerWidth - rect.width - 8);
  const top = event.clientY + 16 + rect.height > innerHeight ? event.clientY - rect.height - 12 : event.clientY + 16;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

export function withTooltip(node, lines) {
  node.addEventListener('pointerenter', (event) => {
    const tip = tooltip();
    const content = typeof lines === 'function' ? lines() : lines;
    tip.replaceChildren(...content.map((line, index) => h(index === 0 ? 'strong' : 'span', { text: line })));
    tip.hidden = false;
    moveTooltip(event);
  });
  node.addEventListener('pointermove', moveTooltip);
  node.addEventListener('pointerleave', () => { tooltip().hidden = true; });
  return node;
}

window.addEventListener('scroll', () => { if (tooltip()) tooltip().hidden = true; }, { passive: true });

/* ---------- responsive mounting ---------- */

const renderers = new WeakMap();
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) renderers.get(entry.target)?.(false);
});

// Draws `draw(width)` into the container now and again whenever the container's width changes.
export function mount(container, draw) {
  let lastWidth = 0;
  const render = (force) => {
    const width = Math.floor(container.clientWidth);
    if (!width || (!force && width === lastWidth)) return;
    lastWidth = width;
    container.replaceChildren(draw(width));
  };
  if (!renderers.has(container)) resizeObserver.observe(container);
  renderers.set(container, render);
  render(true);
}

/* ---------- scales ---------- */

function niceStep(max, count) {
  const raw = Math.max(max, 1e-9) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  return (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
}

function niceDomain(max, count) {
  const step = niceStep(max, count);
  const domain = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let value = 0; value <= domain + step / 1000; value += step) ticks.push(Number(value.toPrecision(10)));
  return { domain, ticks };
}

function roundSignificant(value) {
  if (!value) return 0;
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

export const formatKg = (value) => `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })} kg`;
export const formatEur = (value) => `€${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const compactEur = (value) => value >= 1000 ? `€${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k` : `€${value}`;

/* ---------- sparkline ---------- */

export function sparkline(values, color) {
  return (width) => {
    const height = 38;
    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'sparkline', 'aria-hidden': 'true' });
    if (values.length < 2) {
      svg.append(s('line', { x1: 0, x2: width, y1: height - 4, y2: height - 4, class: 'spark-empty' }));
      return svg;
    }
    const max = Math.max(...values, 1);
    const step = width / (values.length - 1);
    const points = values.map((value, index) => [index * step, height - 4 - (value / max) * (height - 10)]);
    const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
    svg.append(
      s('path', { d: `${line}L${width},${height}L0,${height}Z`, class: 'spark-area', style: { fill: color } }),
      s('path', { d: line, class: 'spark-line', style: { stroke: color } }),
      s('circle', { cx: points.at(-1)[0] - 2, cy: points.at(-1)[1], r: 3, style: { fill: color } })
    );
    return svg;
  };
}

/* ---------- donut ---------- */

export function donutChart(segments, { size = 184, thickness = 22, centerValue = '', centerLabel = '' } = {}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, { value }) => sum + value, 0);
  const svg = s('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: 'donut', role: 'img', 'aria-label': segments.map(({ label, value }) => `${label}: ${value}`).join(', ') || 'No data' });
  svg.append(s('circle', { cx: size / 2, cy: size / 2, r: radius, class: 'donut-track', 'stroke-width': thickness }));
  const gap = segments.filter(({ value }) => value).length > 1 ? 2 : 0;
  let offset = 0;
  for (const segment of segments) {
    if (!segment.value || !total) continue;
    const length = (segment.value / total) * circumference;
    const arc = s('circle', {
      cx: size / 2, cy: size / 2, r: radius, class: 'donut-segment', 'stroke-width': thickness,
      'stroke-dasharray': `${Math.max(length - gap, 0.5)} ${circumference}`,
      'stroke-dashoffset': -offset,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      style: { stroke: segment.color }
    });
    withTooltip(arc, [segment.label, `${segment.value.toLocaleString('en-US')} parcels · ${((segment.value / total) * 100).toFixed(1)}%`]);
    svg.append(arc);
    offset += length;
  }
  svg.append(
    s('text', { x: size / 2, y: size / 2 - 2, class: 'donut-value', 'text-anchor': 'middle' }, String(centerValue)),
    s('text', { x: size / 2, y: size / 2 + 18, class: 'donut-label', 'text-anchor': 'middle' }, centerLabel)
  );
  return svg;
}

/* ---------- stacked bar (HTML) ---------- */

export function stackedBar(segments) {
  const total = segments.reduce((sum, { value }) => sum + value, 0);
  const bar = h('div', { class: 'stacked-bar', role: 'img', 'aria-label': segments.map(({ label, value }) => `${label}: ${value}`).join(', ') });
  if (!total) bar.append(h('span', { class: 'stacked-empty' }));
  for (const segment of segments) {
    if (!segment.value) continue;
    const part = h('span', { class: 'stacked-part', style: { width: `${(segment.value / total) * 100}%`, background: segment.color } });
    withTooltip(part, [segment.label, `${segment.value.toLocaleString('en-US')} · ${((segment.value / total) * 100).toFixed(1)}%`]);
    bar.append(part);
  }
  const legend = h('div', { class: 'legend' }, segments.map((segment) => h('span', { class: 'legend-item' },
    h('i', { style: { background: segment.color } }),
    h('span', { text: segment.label }),
    h('strong', { text: total ? `${Math.round((segment.value / total) * 100)}%` : '—' }))));
  return h('div', { class: 'stacked' }, bar, legend);
}

/* ---------- risk gauge ---------- */

function polar(cx, cy, radius, angle) {
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function arc(cx, cy, radius, start, end) {
  const [x0, y0] = polar(cx, cy, radius, start);
  const [x1, y1] = polar(cx, cy, radius, end);
  return `M${x0.toFixed(2)},${y0.toFixed(2)}A${radius},${radius} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

export function riskGauge(level) {
  const width = 200;
  const height = 116;
  const cx = width / 2;
  const cy = 104;
  const radius = 80;
  const bands = [['LOW', 'var(--c-routed)'], ['MEDIUM', 'var(--c-pending)'], ['HIGH', 'var(--c-error)']];
  const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'gauge', role: 'img', 'aria-label': `Risk level ${level}` });
  bands.forEach(([name, color], index) => {
    const start = Math.PI + (index * Math.PI) / 3 + 0.03;
    const end = Math.PI + ((index + 1) * Math.PI) / 3 - 0.03;
    svg.append(s('path', { d: arc(cx, cy, radius, start, end), class: `gauge-band ${name === level ? 'active' : ''}`, style: { stroke: color } }));
  });
  const index = bands.findIndex(([name]) => name === level);
  if (index !== -1) {
    const angle = Math.PI + ((index + 0.5) * Math.PI) / 3;
    const [x, y] = polar(cx, cy, radius - 22, angle);
    svg.append(s('line', { x1: cx, y1: cy, x2: x, y2: y, class: 'gauge-needle' }), s('circle', { cx, cy, r: 6, class: 'gauge-hub' }));
  } else {
    svg.append(s('text', { x: cx, y: cy - 18, 'text-anchor': 'middle', class: 'gauge-idle' }, 'Collecting data'));
  }
  return svg;
}

/* ---------- scatter: weight × value ---------- */

// points: [{ weight, value, color, ring, lines, data }]
// bands:  [{ from, to, label, color }] shaded weight bands
// vLines: [{ value, label, variant }] weight thresholds; hLines: [{ value, label, variant }] value thresholds
export function scatterChart({ points, bands = [], vLines = [], hLines = [], height = 300, onSelect, label = 'Weight versus declared value' }) {
  return (width) => {
    const margin = { top: 26, right: 18, bottom: 40, left: 58 };
    const plotWidth = Math.max(width - margin.left - margin.right, 40);
    const plotHeight = height - margin.top - margin.bottom;
    const maxWeight = Math.max(...points.map((point) => point.weight), ...vLines.map((line) => line.value * 1.15), 1);
    const maxValue = Math.max(...points.map((point) => point.value), ...hLines.map((line) => line.value * 1.25), 10);
    const xAxis = niceDomain(maxWeight, width < 520 ? 4 : 8);
    const yDomain = roundSignificant(maxValue * 1.04) || 10;
    const x = (value) => margin.left + (Math.min(value, xAxis.domain) / xAxis.domain) * plotWidth;
    // Square-root value scale: most parcels are low value, so a linear scale would crush them onto the axis.
    const y = (value) => margin.top + plotHeight - Math.sqrt(Math.min(Math.max(value, 0), yDomain) / yDomain) * plotHeight;

    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': label });

    for (const band of bands) {
      const x0 = x(band.from);
      const x1 = x(band.to ?? xAxis.domain);
      if (x1 <= x0) continue;
      svg.append(s('rect', { x: x0, y: margin.top, width: x1 - x0, height: plotHeight, class: 'band', style: { fill: band.color } }));
      if (x1 - x0 > 64) svg.append(s('text', { x: (x0 + x1) / 2, y: margin.top - 9, 'text-anchor': 'middle', class: 'band-label', style: { fill: band.color } }, band.label));
    }

    [0, 0.25, 0.5, 0.75, 1].map((fraction) => roundSignificant(fraction * fraction * yDomain)).forEach((tick) => {
      svg.append(
        s('line', { x1: margin.left, x2: margin.left + plotWidth, y1: y(tick), y2: y(tick), class: 'grid' }),
        s('text', { x: margin.left - 8, y: y(tick) + 4, 'text-anchor': 'end', class: 'tick' }, compactEur(tick))
      );
    });
    xAxis.ticks.forEach((tick) => svg.append(s('text', { x: x(tick), y: margin.top + plotHeight + 18, 'text-anchor': 'middle', class: 'tick' }, `${tick}`)));
    svg.append(
      s('line', { x1: margin.left, x2: margin.left + plotWidth, y1: margin.top + plotHeight, y2: margin.top + plotHeight, class: 'axis' }),
      s('text', { x: margin.left + plotWidth, y: height - 4, 'text-anchor': 'end', class: 'axis-title' }, 'Weight (kg) →'),
      s('text', { x: 12, y: margin.top + plotHeight / 2, 'text-anchor': 'middle', class: 'axis-title', transform: `rotate(-90 12 ${margin.top + plotHeight / 2})` }, 'Declared value (√ scale) →')
    );

    for (const line of hLines) {
      const lineY = y(line.value);
      if (line.variant !== 'current') svg.append(s('rect', { x: margin.left, y: margin.top, width: plotWidth, height: Math.max(lineY - margin.top, 0), class: 'zone-pending' }));
      svg.append(
        s('line', { x1: margin.left, x2: margin.left + plotWidth, y1: lineY, y2: lineY, class: `threshold ${line.variant || ''}` }),
        s('text', { x: margin.left + plotWidth - 4, y: lineY - 6, 'text-anchor': 'end', class: `threshold-label ${line.variant || ''}` }, line.label)
      );
    }
    for (const line of vLines) {
      const lineX = x(line.value);
      svg.append(
        s('line', { x1: lineX, x2: lineX, y1: margin.top, y2: margin.top + plotHeight, class: `threshold ${line.variant || ''}` }),
        s('text', { x: lineX + 4, y: margin.top + 12 + (line.variant === 'current' ? 14 : 0), class: `threshold-label ${line.variant || ''}` }, line.label)
      );
    }

    // Very large batches are sampled evenly so the chart stays responsive.
    const stride = Math.ceil(points.length / 2500);
    const layer = s('g', { class: 'points' });
    points.forEach((point, index) => {
      if (index % stride) return;
      const dot = s('circle', {
        cx: x(point.weight).toFixed(1), cy: y(point.value).toFixed(1), r: point.ring ? 4.6 : 3.6,
        class: `point ${point.ring ? 'ring' : ''} ${onSelect ? 'clickable' : ''}`,
        style: { fill: point.color }
      });
      if (point.lines) withTooltip(dot, point.lines);
      if (onSelect) dot.addEventListener('click', () => onSelect(point.data));
      layer.append(dot);
    });
    svg.append(layer);
    return svg;
  };
}

/* ---------- histogram ---------- */

export function histogramChart({ values, bands = [], markers = [], height = 220, binCount = 26 }) {
  return (width) => {
    const margin = { top: 16, right: 14, bottom: 36, left: 40 };
    const plotWidth = Math.max(width - margin.left - margin.right, 40);
    const plotHeight = height - margin.top - margin.bottom;
    const maxWeight = Math.max(...values, ...markers.map((marker) => marker.value * 1.15), 1);
    const xAxis = niceDomain(maxWeight, width < 520 ? 4 : 8);
    const binWidth = xAxis.domain / binCount;
    const bins = Array.from({ length: binCount }, () => 0);
    for (const value of values) bins[Math.min(Math.floor(value / binWidth), binCount - 1)] += 1;
    const yAxis = niceDomain(Math.max(...bins, 1), 4);
    const x = (value) => margin.left + (value / xAxis.domain) * plotWidth;
    const y = (value) => margin.top + plotHeight - (value / yAxis.domain) * plotHeight;
    const bandFor = (value) => bands.find((band) => value > (band.from ?? -Infinity) && value <= (band.to ?? Infinity)) || bands.at(-1);

    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': 'Weight distribution by department band' });
    yAxis.ticks.forEach((tick) => svg.append(
      s('line', { x1: margin.left, x2: margin.left + plotWidth, y1: y(tick), y2: y(tick), class: 'grid' }),
      s('text', { x: margin.left - 8, y: y(tick) + 4, 'text-anchor': 'end', class: 'tick' }, String(tick))
    ));
    bins.forEach((count, index) => {
      const from = index * binWidth;
      const band = bandFor(from + binWidth / 2);
      const bar = s('rect', {
        x: x(from) + 1, y: y(count), width: Math.max(x(from + binWidth) - x(from) - 2, 1), height: Math.max(y(0) - y(count), count ? 1 : 0),
        rx: 2, class: 'bar', style: { fill: band?.color || 'var(--c-routed)' }
      });
      withTooltip(bar, [`${formatKg(from)} – ${formatKg(from + binWidth)}`, `${count} parcel${count === 1 ? '' : 's'}`, band ? band.label : '']);
      svg.append(bar);
    });
    for (const marker of markers) {
      svg.append(
        s('line', { x1: x(marker.value), x2: x(marker.value), y1: margin.top - 4, y2: margin.top + plotHeight, class: 'threshold' }),
        s('text', { x: x(marker.value) + 4, y: margin.top + 8, class: 'threshold-label' }, marker.label)
      );
    }
    xAxis.ticks.forEach((tick) => svg.append(s('text', { x: x(tick), y: margin.top + plotHeight + 18, 'text-anchor': 'middle', class: 'tick' }, `${tick}`)));
    svg.append(
      s('line', { x1: margin.left, x2: margin.left + plotWidth, y1: y(0), y2: y(0), class: 'axis' }),
      s('text', { x: margin.left + plotWidth, y: height - 2, 'text-anchor': 'end', class: 'axis-title' }, 'Weight (kg) →')
    );
    return svg;
  };
}

/* ---------- flow: current decision → candidate decision ---------- */

export function flowChart(links, { height = 300 } = {}) {
  return (width) => {
    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart flow', role: 'img', 'aria-label': links.map((link) => `${link.from} to ${link.to}: ${link.count}`).join(', ') });
    const total = links.reduce((sum, link) => sum + link.count, 0);
    if (!total) return svg;
    const nodeWidth = 12;
    const gap = 12;
    const top = 8;
    const left = 4;
    const right = width - nodeWidth - 4;
    const sortNames = (names) => [...new Set(names)].sort((a, b) => decisionRank(a) - decisionRank(b) || a.localeCompare(b));
    const leftNames = sortNames(links.map((link) => link.from));
    const rightNames = sortNames(links.map((link) => link.to));
    const scale = (height - top * 2 - gap * (Math.max(leftNames.length, rightNames.length) - 1)) / total;

    const layout = (names, key) => {
      let cursor = top;
      return Object.fromEntries(names.map((name) => {
        const count = links.filter((link) => link[key] === name).reduce((sum, link) => sum + link.count, 0);
        const node = { name, count, y: cursor, height: Math.max(count * scale, 2), offset: 0 };
        cursor += node.height + gap;
        return [name, node];
      }));
    };
    const leftNodes = layout(leftNames, 'from');
    const rightNodes = layout(rightNames, 'to');
    const ordered = [...links].sort((a, b) => decisionRank(a.from) - decisionRank(b.from) || decisionRank(a.to) - decisionRank(b.to));
    const middle = (left + nodeWidth + right) / 2;

    const ribbons = s('g');
    for (const link of ordered) {
      const source = leftNodes[link.from];
      const target = rightNodes[link.to];
      const thickness = Math.max(link.count * scale, 1);
      const y0 = source.y + source.offset;
      const y1 = target.y + target.offset;
      source.offset += thickness;
      target.offset += thickness;
      const x0 = left + nodeWidth;
      const x1 = right;
      const d = `M${x0},${y0}C${middle},${y0} ${middle},${y1} ${x1},${y1}L${x1},${y1 + thickness}C${middle},${y1 + thickness} ${middle},${y0 + thickness} ${x0},${y0 + thickness}Z`;
      const changed = link.from !== link.to;
      const ribbon = s('path', { d, class: `ribbon ${changed ? 'changed' : ''}`, style: { fill: colorFor(changed ? link.to : link.from) } });
      withTooltip(ribbon, [changed ? `${link.from} → ${link.to}` : `${link.from} (unchanged)`, `${link.count.toLocaleString('en-US')} parcel${link.count === 1 ? '' : 's'}`]);
      ribbons.append(ribbon);
    }
    svg.append(ribbons);

    const drawNodes = (nodes, x, anchor, labelX) => Object.values(nodes).forEach((node) => {
      svg.append(s('rect', { x, y: node.y, width: nodeWidth, height: node.height, rx: 3, class: 'flow-node', style: { fill: colorFor(node.name) } }));
      svg.append(s('text', { x: labelX, y: node.y + node.height / 2 + 4, 'text-anchor': anchor, class: 'flow-label' }, `${node.name.replace(' Department', '')} · ${node.count}`));
    });
    drawNodes(leftNodes, left, 'start', left + nodeWidth + 8);
    drawNodes(rightNodes, right, 'end', right - 8);
    return svg;
  };
}

/* ---------- before/after comparison bars (HTML) ---------- */

export function compareBars(rows) {
  const max = Math.max(...rows.flatMap((row) => [row.before, row.after]), 1);
  return h('div', { class: 'compare' }, rows.map((row) => {
    const delta = row.after - row.before;
    return h('div', { class: 'compare-row' },
      h('div', { class: 'compare-label' }, h('i', { style: { background: row.color } }), h('span', { text: row.label })),
      h('div', { class: 'compare-bars' },
        h('span', { class: 'compare-bar before', style: { width: `${(row.before / max) * 100}%` } }),
        h('span', { class: 'compare-bar after', style: { width: `${(row.after / max) * 100}%`, background: row.color } })),
      h('div', { class: 'compare-values' },
        h('span', { text: `${row.before} → ${row.after}` }),
        h('strong', { class: `delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`, text: delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : '±0' })));
  }));
}

/* ---------- policy ruler ---------- */

export function policyRuler(policy) {
  return (width) => {
    const height = 150;
    const margin = { left: 70, right: 20 };
    const plotWidth = Math.max(width - margin.left - margin.right, 60);
    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart ruler', role: 'img', 'aria-label': 'Active routing thresholds' });
    const departments = policy.departments || {};
    const mail = Number(policy.mailWeightLimit);
    const regular = Number(policy.regularWeightLimit);
    const threshold = Number(policy.insuranceValueThreshold);

    const drawTrack = (y, label, domain, segments, ticks, format) => {
      const x = (value) => margin.left + (Math.min(value, domain) / domain) * plotWidth;
      svg.append(s('text', { x: 0, y: y + 17, class: 'ruler-title' }, label));
      for (const segment of segments) {
        const x0 = x(segment.from);
        const x1 = x(segment.to);
        svg.append(s('rect', { x: x0 + 1, y, width: Math.max(x1 - x0 - 2, 2), height: 26, rx: 6, class: 'ruler-segment', style: { fill: segment.color } }));
        if (x1 - x0 > 70) svg.append(s('text', { x: (x0 + x1) / 2, y: y + 17, 'text-anchor': 'middle', class: 'ruler-segment-label' }, segment.label));
        else withTooltip(svg.lastChild, [segment.label]);
      }
      for (const tick of ticks) svg.append(s('text', { x: x(tick), y: y + 42, 'text-anchor': 'middle', class: 'tick strong' }, format(tick)));
    };

    if (Number.isFinite(mail) && Number.isFinite(regular)) {
      const domain = Math.max(regular * 1.6, mail * 4, 1);
      drawTrack(12, 'Weight', domain, [
        { from: 0, to: mail, label: (departments.mail || 'Mail').replace(' Department', ''), color: 'var(--c-mail)' },
        { from: mail, to: regular, label: (departments.regular || 'Regular').replace(' Department', ''), color: 'var(--c-regular)' },
        { from: regular, to: domain, label: `${(departments.heavy || 'Heavy').replace(' Department', '')} →`, color: 'var(--c-heavy)' }
      ], [0, mail, regular], formatKg);
    } else {
      svg.append(s('text', { x: 0, y: 30, class: 'tick' }, 'This policy uses custom rules; see the version list for details.'));
    }
    if (Number.isFinite(threshold)) {
      const domain = Math.max(threshold * 2, 1);
      drawTrack(84, 'Value', domain, [
        { from: 0, to: threshold, label: 'Routed by weight', color: 'var(--c-neutral)' },
        { from: threshold, to: domain, label: 'Insurance approval →', color: 'var(--c-pending)' }
      ], [0, threshold], formatEur);
    }
    return svg;
  };
}

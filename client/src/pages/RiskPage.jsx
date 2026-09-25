import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Badge from '../components/Badge.jsx';
import Panel from '../components/Panel.jsx';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { tableWrap, table, thead, th, tr, td } from '../components/table.js';

const TREND_ICON = { INCREASING: '↑', STABLE: '→', DECREASING: '↓' };

export default function RiskPage() {
  const [risk, setRisk] = useState(null);
  const [dna, setDna] = useState(null);
  const handleError = useApiError();

  useEffect(() => {
    Promise.all([api('/risk'), api('/failure-dna')]).then(([r, d]) => { setRisk(r); setDna(d); }).catch((error) => handleError(error, 'Loading risk data'));
  }, [handleError]);

  if (!risk) return <p className="font-code-sm text-code-sm text-on-surface-variant">Loading...</p>;

  return (
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Intelligence" title="Risk &amp; Predictions" description="The risk level, confidence and evidence below are always a transparent heuristic over this session's data. When Gemini is configured, it only rephrases that same evidence into plain language -- it never changes the level or invents a number." />

      <Panel
        icon="monitoring"
        title="Operational Risk"
        actions={<div className="flex items-center gap-space-xs flex-wrap justify-end"><Badge tone={risk.source === 'gemini' ? 'LOW' : 'neutral'}>{risk.source === 'gemini' ? 'Gemini' : 'Heuristic'}</Badge><Badge tone={risk.level}>{`${risk.level.replaceAll('_', ' ')} · ${risk.confidence}% confidence`}</Badge></div>}
      >
        <p className="font-semibold text-[16px] text-white mb-1.5">{risk.title}</p>
        <p className="text-[13px] text-on-surface-variant leading-relaxed">{risk.message}</p>
        {risk.evidence.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {risk.evidence.map((e, i) => (
              <li key={i} className="text-[13px] text-on-surface-variant flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-primary/70 mt-2 shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 p-3.5 rounded-xl bg-surface-container/70 border border-white/[0.08] flex items-center justify-between gap-3 flex-wrap shadow-inner">
          <span className="text-[12px] text-on-surface font-bold uppercase tracking-wide">Recommendation</span>
          <span className="text-[13px] text-primary text-right font-medium">{risk.recommendation}</span>
        </div>
        <p className="mt-3 text-[11px] text-on-surface-variant/70 uppercase tracking-wide">
          {risk.source === 'gemini'
            ? 'Detection: transparent heuristic. Wording: Gemini, grounded only in the evidence above.'
            : `Methodology: transparent ${risk.methodology || 'heuristic'} over recent batches and the approval queue — not machine learning.`}
        </p>
        {risk.aiNote && (
          <p className="mt-3 flex items-start gap-2 rounded-sm border border-caution/50 bg-caution/10 px-3 py-2 text-[12px] text-on-surface" role="note">
            <Icon name="info" className="text-[16px] shrink-0" />
            <span>{risk.aiNote}</span>
          </p>
        )}
      </Panel>

      <Panel icon="fingerprint" title={`Failure DNA (${dna?.totalFailures ?? 0} failures fingerprinted)`} bodyClassName={dna?.categories.length ? '' : 'p-space-sm'}>
        {!dna || dna.categories.length === 0 ? (
          <p className="font-body-compact text-body-compact text-on-surface-variant">No validation failures recorded yet.</p>
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <thead><tr className={thead}><th className={th}>Fingerprint</th><th className={th}>Count</th><th className={th}>Share</th><th className={th}>Trend</th></tr></thead>
              <tbody>
                {dna.categories.map((c) => (
                  <tr key={c.code} className={tr}>
                    <td className={`${td} text-on-surface`}>{c.code}</td>
                    <td className={td}>{c.count}</td>
                    <td className={td}>{(c.share * 100).toFixed(0)}%</td>
                    <td className={td}>{TREND_ICON[c.trend]} {c.trend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

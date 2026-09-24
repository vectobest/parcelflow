import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Badge from '../components/Badge.jsx';

const TREND_ICON = { INCREASING: '↑', STABLE: '→', DECREASING: '↓' };

export default function RiskPage() {
  const [risk, setRisk] = useState(null);
  const [dna, setDna] = useState(null);
  const handleError = useApiError();

  useEffect(() => {
    Promise.all([api('/risk'), api('/failure-dna')]).then(([r, d]) => { setRisk(r); setDna(d); }).catch((error) => handleError(error, 'Loading risk data'));
  }, [handleError]);

  if (!risk) return <p className="muted">Loading...</p>;

  return (
    <div>
      <div className="section-head"><div><h1>Risk & predictions</h1><p>Transparent heuristics over the current session's data -- not machine learning. See methodology below.</p></div></div>

      <article className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><div><span className="eyebrow">Operational risk</span><h3>{risk.title}</h3></div><Badge tone={risk.level}>{risk.level.replaceAll('_', ' ')} &middot; {risk.confidence}% confidence</Badge></div>
        <p className="muted">{risk.message}</p>
        {risk.evidence.length > 0 && <ul className="evidence">{risk.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <p className="recommendation"><strong>Recommendation:</strong> {risk.recommendation}</p>
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>Methodology: transparent {risk.methodology} over recent batches and the approval queue -- not machine learning.</p>
      </article>

      <article className="card">
        <div className="card-head"><h3>Failure DNA ({dna?.totalFailures ?? 0} failures fingerprinted)</h3></div>
        {!dna || dna.categories.length === 0 ? <p className="muted">No validation failures recorded yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fingerprint</th><th>Count</th><th>Share</th><th>Trend</th></tr></thead>
              <tbody>
                {dna.categories.map((c) => (
                  <tr key={c.code}>
                    <td className="mono">{c.code}</td>
                    <td>{c.count}</td>
                    <td>{(c.share * 100).toFixed(0)}%</td>
                    <td>{TREND_ICON[c.trend]} {c.trend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}

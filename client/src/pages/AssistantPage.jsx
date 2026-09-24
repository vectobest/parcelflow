import { useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';

const SUGGESTIONS = ['Which policy is active?', 'Why are approvals increasing?', "What's the current risk outlook?", 'What happens if volume increases 50%?'];

export default function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const handleError = useApiError();

  async function ask(q) {
    const text = (q ?? question).trim();
    if (!text) return;
    setBusy(true);
    try {
      const answer = await api('/assistant/ask', { body: { question: text } });
      setHistory((h) => [...h, answer]);
      setQuestion('');
    } catch (error) {
      handleError(error, 'Asking the assistant');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="section-head"><div><h1>Operations Assistant</h1><p>Read-only, and only ever answers from live application data -- it cites the IDs it used, and says so when it can't answer.</p></div></div>

      <article className="card" style={{ marginBottom: 20 }}>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {SUGGESTIONS.map((s) => <button key={s} className="button ghost small" type="button" onClick={() => ask(s)}>{s}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="button-row">
          <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about a policy version, batch ID, incident ID..." style={{ flex: 1 }} />
          <button className="button primary" type="submit" disabled={busy}>Ask</button>
        </form>
      </article>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {history.slice().reverse().map((entry, i) => (
          <article className="card" key={i}>
            <p><strong>Q:</strong> {entry.question}</p>
            <p className={entry.unresolved ? 'muted' : ''}>{entry.answer}</p>
            {entry.citedIds.length > 0 && <p className="mono muted" style={{ fontSize: 12 }}>Cited: {entry.citedIds.join(', ')}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}

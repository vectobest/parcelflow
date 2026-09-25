import { useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Input } from '../components/Field.jsx';

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
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Intelligence" title="Operations Assistant" description="Read-only, and only ever answers from live application data -- it cites the IDs it used, and says so when it can't answer." />

      <Panel icon="terminal" title="Ask">
        <div className="flex flex-wrap gap-space-xs mb-space-sm">
          {SUGGESTIONS.map((s) => <Button key={s} variant="outline" size="sm" onClick={() => ask(s)}>{s}</Button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-space-sm">
          <Input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about a policy version, batch ID, incident ID..." className="flex-1" />
          <Button variant="primary" type="submit" disabled={busy}>Ask</Button>
        </form>
      </Panel>

      <div className="flex flex-col gap-space-sm">
        {history.slice().reverse().map((entry, i) => (
          <Panel key={i} icon="chat" actions={<Badge tone={entry.source === 'gemini' ? 'LOW' : 'neutral'}>{entry.source === 'gemini' ? 'Gemini' : 'Heuristic'}</Badge>}>
            <p className="font-body-compact text-body-compact text-on-surface mb-space-2xs"><span className="text-on-surface-variant font-bold">Q:</span> {entry.question}</p>
            <p className={`font-body-compact text-body-compact ${entry.unresolved ? 'text-on-surface-variant' : 'text-on-surface'}`}>{entry.answer}</p>
            {entry.aiNote && (
              <p className="mt-3 flex items-start gap-2 rounded-sm border border-caution/50 bg-caution/10 px-3 py-2 text-[12px] text-on-surface" role="note">
                <Icon name="info" className="text-[16px] shrink-0" />
                <span>{entry.aiNote}</span>
              </p>
            )}
            {entry.citedIds.length > 0 && <p className="mt-space-xs font-kpi-micro text-kpi-micro text-on-surface-variant uppercase">Cited: {entry.citedIds.join(', ')}</p>}
          </Panel>
        ))}
      </div>
    </div>
  );
}

'use client';
import { useRef, useState, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const TOOL_LABELS: Record<string, string> = {
  create_pipedrive_note: 'Criando nota no Pipedrive',
  create_pipedrive_activity: 'Agendando follow-up no Pipedrive',
  save_debrief: 'Salvando debrief no banco',
};

export default function DebriefPage() {
  const [dealId, setDealId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const dealIdRef = useRef('');
  const notesRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/agent/debrief',
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { messages, dealId: dealIdRef.current, meetingNotes: notesRef.current },
    }),
  }), []);

  const { messages, sendMessage, status, error } = useChat({ transport });

  const assistantMsgs = messages.filter(m => m.role === 'assistant');
  const lastMsg = assistantMsgs[assistantMsgs.length - 1];
  const isLoading = status === 'submitted' || status === 'streaming';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId.trim() || !notes.trim()) return;
    dealIdRef.current = dealId;
    notesRef.current = notes;
    setSubmitted(true);
    await sendMessage({ text: `Processar reunião para deal ${dealId}` });
  }

  function reset() {
    setSubmitted(false);
    setDealId('');
    setNotes('');
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-1">Debrief Pós-Reunião</h1>
        <p className="text-sm text-gray-400">Cole as notas da reunião. O agente gera o resumo e atualiza o Pipedrive automaticamente.</p>
      </div>

      {!submitted ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={dealId}
            onChange={e => setDealId(e.target.value)}
            placeholder="ID do deal (ex: 12345)"
            className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500/50"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          />
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Cole aqui as notas da reunião, transcrição, ou pontos discutidos..."
            rows={8}
            className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              disabled={!dealId.trim() || !notes.trim()}
            >
              Processar Reunião
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-400">
            Deal: <span className="text-blue-400 font-mono">{dealId}</span>
          </span>
          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            ← Novo debrief
          </button>
        </div>
      )}

      {isLoading && !lastMsg && (
        <div className="mt-6 p-4 rounded-lg flex items-center gap-3" style={{ background: 'var(--surface)' }}>
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Analisando reunião...</span>
        </div>
      )}

      {lastMsg && (
        <div className="mt-4 space-y-3">
          {lastMsg.parts.map((part, i) => {
            if (part.type === 'text' && part.text) {
              return (
                <div key={i} className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(part.text) }} />
                </div>
              );
            }
            if (part.type.startsWith('tool-')) {
              const toolName = part.type.replace('tool-', '');
              const state = (part as { state: string }).state;
              const isDone = state === 'output-available';
              const isError = state === 'output-error';
              return (
                <div key={i} className="px-4 py-2.5 rounded-lg flex items-center gap-3" style={{ background: 'var(--surface)' }}>
                  {isError ? (
                    <div className="w-3.5 h-3.5 rounded-full bg-red-500 flex-shrink-0" />
                  ) : isDone ? (
                    <div className="w-3.5 h-3.5 rounded-full bg-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  )}
                  <span className="text-xs text-gray-400">
                    {TOOL_LABELS[toolName] ?? toolName}
                    {isDone && ' ✓'}
                  </span>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          Erro: {error.message}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[huplo]|$)(.+)$/gm, '<p>$1</p>');
}

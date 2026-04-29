'use client';
import { useRef, useState, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const TOOL_LABELS: Record<string, string> = {
  create_pipedrive_note: 'Criando nota no Pipedrive',
  create_pipedrive_activity: 'Agendando follow-up no Pipedrive',
  save_debrief: 'Salvando debrief no banco',
};

const MOCK_DEBRIEF = `## 📝 Resumo da Reunião

Reunião de 47 minutos com Rodrigo Fonseca e sua esposa Ana Luísa. Lead demonstrou alto interesse no empreendimento Morada Canasvieiras. Principal objeção levantada foi a comparação com concorrente (HM Engenharia). Casal solicitou simulação de financiamento detalhada com entrada via FGTS e planilha de retorno projetado para 5 anos.

---

## ✅ Action Items

1. Enviar simulação de financiamento com FGTS até amanhã (30/04)
2. Preparar planilha de projeção de retorno (TIR 5 anos, comparativo com poupança e CDB)
3. Enviar material comparativo Seazone vs. autogestão — taxa de ocupação histórica
4. Verificar disponibilidade das unidades 204 e 308 (sul, vista parcial mar) que chamaram atenção
5. Ligar sexta-feira (03/05) às 18h para ouvir retorno do casal

---

## 🌡️ Temperatura do Lead: HOT

Lead com decisão a dois passos: simulação financeira aprovada + visita ao decorado. Alta probabilidade de fechamento em até 10 dias corridos.

---

## 💬 Script de Follow-up (WhatsApp)

*"Oi Rodrigo! Foi ótimo conversar hoje com você e a Ana Luísa. Já estou preparando a simulação completa com o uso do FGTS e a planilha de retorno dos 5 anos — te mando até amanhã. Se quiserem confirmar uma visita ao decorado antes de sexta, me avisa que já encaixo na agenda. Abraço!"*

---

## 🔄 Pipedrive Atualizado

- ✅ Nota criada no deal #303679 com resumo completo da reunião
- ✅ Atividade agendada: Ligação de retorno em 03/05 às 18h
- ✅ Debrief salvo no banco de dados`;

const MOCK_NOTES = `Reunião durou ~47min. Trouxe a esposa, Ana Luísa.
Ficaram empolgados com a parte de gestão da Seazone, especialmente a taxa de ocupação.
Rodrigo mencionou o empreendimento da HM na Cachoeira do Bom Jesus, achou o preço mais barato.
Respondi com o comparativo de localização e custo de autogestão.
Pedi confirmação de interesse: disseram que precisam ver a simulação do financiamento com FGTS.
Ana gostou muito das unidades voltadas pro sul (204 e 308).
Vou ligar sexta 18h para ouvir retorno.`;

export default function DebriefPage() {
  const [dealId, setDealId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [useMock, setUseMock] = useState(false);
  const dealIdRef = useRef('');
  const notesRef = useRef('');

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
    setUseMock(false);
    setSubmitted(true);
    await sendMessage({ text: `Processar reunião para deal ${dealId}` });
  }

  function handleMock() {
    setDealId('303679');
    setNotes(MOCK_NOTES);
    dealIdRef.current = '303679';
    notesRef.current = MOCK_NOTES;
    setUseMock(true);
    setSubmitted(true);
  }

  function reset() {
    setSubmitted(false);
    setUseMock(false);
    setDealId('');
    setNotes('');
  }

  const showContent = useMock || !!lastMsg;
  const contentText = useMock ? MOCK_DEBRIEF : (lastMsg ? lastMsg.parts.find(p => p.type === 'text' && p.text) as { text: string } | undefined : undefined);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(232, 96, 58, 0.1)', color: 'var(--coral)', border: '1px solid rgba(232, 96, 58, 0.25)' }}
          >
            Pós-Reunião
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Debrief da Reunião
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Cole as notas da reunião. O agente gera o resumo, classifica o lead e atualiza o Pipedrive automaticamente.
        </p>
      </div>

      {/* Form */}
      {!submitted ? (
        <div
          className="rounded-2xl p-5 mb-8"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono"
                style={{ color: 'var(--text-subtle)' }}
              >
                #
              </span>
              <input
                value={dealId}
                onChange={e => setDealId(e.target.value)}
                placeholder="ID do deal — ex: 303679"
                className="w-full pl-7 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(232, 96, 58, 0.4)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Cole aqui as notas da reunião, transcrição ou pontos discutidos…"
              rows={7}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-y"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                lineHeight: '1.7',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(232, 96, 58, 0.4)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!dealId.trim() || !notes.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--coral)', color: '#fff' }}
              >
                Processar Reunião
              </button>
            </div>
          </form>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <button
            onClick={handleMock}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              background: 'rgba(232, 96, 58, 0.08)',
              color: 'var(--coral)',
              border: '1px solid rgba(232, 96, 58, 0.2)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM7 4v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Ver exemplo com reunião real (mock)
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl px-5 py-3.5 mb-6 flex items-center justify-between"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: 'rgba(232, 96, 58, 0.1)', color: 'var(--coral)', border: '1px solid rgba(232, 96, 58, 0.2)' }}
            >
              #
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {useMock ? 'Rodrigo Almeida Fonseca' : `Deal ${dealId}`}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {useMock ? 'Deal #303679 · Morada Canasvieiras · Exemplo' : `Processando notas do deal #${dealId}`}
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            ← Novo debrief
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && !lastMsg && (
        <div className="space-y-3 animate-fadeUp">
          {Object.values(TOOL_LABELS).map((label, i) => (
            <div
              key={i}
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 spin"
                style={{ borderColor: 'var(--coral)', borderTopColor: 'transparent' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}…</span>
            </div>
          ))}
        </div>
      )}

      {/* Tool steps (real agent) */}
      {!useMock && lastMsg && (
        <div className="space-y-2 mb-4">
          {lastMsg.parts.map((part, i) => {
            if (!part.type.startsWith('tool-')) return null;
            const toolName = part.type.replace('tool-', '');
            const state = (part as { state: string }).state;
            const isDone = state === 'output-available';
            const isError = state === 'output-error';
            return (
              <div
                key={i}
                className="rounded-xl px-4 py-2.5 flex items-center gap-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {isError ? (
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                ) : isDone ? (
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                ) : (
                  <div
                    className="w-3 h-3 rounded-full border-2 flex-shrink-0 spin"
                    style={{ borderColor: 'var(--coral)', borderTopColor: 'transparent' }}
                  />
                )}
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {TOOL_LABELS[toolName] ?? toolName}{isDone ? ' ✓' : '…'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      {showContent && (
        <div className="animate-fadeUp rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--coral)' }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--coral)' }}>
                Debrief Gerado
              </span>
            </div>
            <button
              onClick={() => {
                const text = useMock ? MOCK_DEBRIEF : (contentText as { text: string } | undefined)?.text ?? '';
                navigator.clipboard.writeText(text);
              }}
              className="text-xs px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all"
              style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Copiar
            </button>
          </div>

          <div className="p-6" style={{ background: 'var(--surface)' }}>
            <div
              className="prose"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(useMock ? MOCK_DEBRIEF : (contentText as { text: string } | undefined)?.text ?? ''),
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          className="mt-4 p-4 rounded-xl text-sm animate-fadeUp"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          {error.message}
        </div>
      )}
    </div>
  );
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:1.25rem 0">')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^\| (.+)$/gm, (line) => {
      if (line.includes('---')) return '';
      const cells = line.split('|').filter(Boolean).map(c => c.trim());
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>)/gs, (m) => {
      const rows = m.match(/<tr>.*?<\/tr>/gs) || [];
      if (!rows.length || !rows[0]) return m;
      const head = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
      const body = rows.slice(1).join('');
      return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
    })
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[htuplob]|$)(.+)$/gm, '<p>$1</p>');
}

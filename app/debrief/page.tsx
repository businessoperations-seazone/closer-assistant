'use client';
import { useState } from 'react';

const LOADING_STEPS = [
  { label: 'Analisando notas da reunião com IA' },
  { label: 'Criando nota no Pipedrive' },
  { label: 'Agendando atividade de follow-up' },
  { label: 'Salvando debrief no banco' },
];

const MOCK_DEBRIEF = `## 📝 Resumo da Reunião

Reunião de 47 minutos com Rodrigo Fonseca e sua esposa Ana Luísa. Lead demonstrou alto interesse no empreendimento Morada Canasvieiras. Principal objeção levantada foi a comparação com concorrente (HM Engenharia). Casal solicitou simulação de financiamento detalhada com entrada via FGTS e planilha de retorno projetado para 5 anos.

---

## ✅ Action Items

1. Enviar simulação de financiamento com FGTS até amanhã (30/04)
2. Preparar planilha de projeção de retorno (TIR 5 anos, comparativo com poupança e CDB)
3. Enviar material comparativo Seazone vs. autogestão — taxa de ocupação histórica
4. Verificar disponibilidade das unidades 204 e 308 (sul, vista parcial mar)
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

const TEMP_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  hot:    { bg: 'rgba(239,68,68,0.08)',   text: '#f87171', border: 'rgba(239,68,68,0.25)',   label: '🔥 HOT' },
  warm:   { bg: 'rgba(251,146,60,0.08)',  text: '#fb923c', border: 'rgba(251,146,60,0.25)',  label: '🌤 WARM' },
  cold:   { bg: 'rgba(96,165,250,0.08)',  text: '#60a5fa', border: 'rgba(96,165,250,0.25)',  label: '❄️ COLD' },
  nurture:{ bg: 'rgba(167,139,250,0.08)', text: '#a78bfa', border: 'rgba(167,139,250,0.25)', label: '🌱 NURTURE' },
};

export default function DebriefPage() {
  const [dealId, setDealId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    briefing: string;
    follow_up_type: string;
    follow_up_script: string;
    follow_up_justification: string;
    pipedrive: { note_created: boolean; activity_created: boolean; activity_due_date: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [useMock, setUseMock] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId.trim() || !notes.trim()) return;
    setSubmitted(true);
    setIsLoading(true);
    setResult(null);
    setError(null);
    setCompletedSteps([]);
    setUseMock(false);

    // Animate step 0 immediately
    setCompletedSteps([]);
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < LOADING_STEPS.length - 1) {
        setCompletedSteps(prev => [...prev, stepIdx]);
        stepIdx++;
      }
    }, 1200);

    try {
      const res = await fetch('/api/agent/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, meetingNotes: notes }),
      });
      const data = await res.json();
      clearInterval(interval);
      setCompletedSteps(LOADING_STEPS.map((_, i) => i));
      if (!res.ok) {
        setError(data.error ?? 'Erro desconhecido');
      } else {
        setResult(data);
      }
    } catch (e) {
      clearInterval(interval);
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function handleMock() {
    setDealId('303679');
    setNotes(MOCK_NOTES);
    setUseMock(true);
    setSubmitted(true);
    setResult({
      briefing: MOCK_DEBRIEF,
      follow_up_type: 'hot',
      follow_up_script: 'Oi Rodrigo! Foi ótimo conversar hoje com você e a Ana Luísa...',
      follow_up_justification: 'Lead demonstrou alto interesse e solicitou simulação — próximo passo claro.',
      pipedrive: { note_created: true, activity_created: true, activity_due_date: '2026-05-03' },
    });
    setError(null);
    setIsLoading(false);
    setCompletedSteps([]);
  }

  function reset() {
    setSubmitted(false);
    setUseMock(false);
    setDealId('');
    setNotes('');
    setResult(null);
    setError(null);
    setIsLoading(false);
    setCompletedSteps([]);
  }

  const tempStyle = result ? (TEMP_COLORS[result.follow_up_type] ?? TEMP_COLORS.cold) : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(232,96,58,0.1)', color: 'var(--coral)', border: '1px solid rgba(232,96,58,0.25)' }}>
            Pós-Reunião
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Debrief da Reunião</h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Cole as notas da reunião. O agente gera o resumo, classifica o lead e atualiza o Pipedrive automaticamente.
        </p>
      </div>

      {/* Form */}
      {!submitted ? (
        <div className="rounded-2xl p-5 mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>#</span>
              <input value={dealId} onChange={e => setDealId(e.target.value)}
                placeholder="ID do deal — ex: 263734"
                className="w-full pl-7 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(232,96,58,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Cole aqui as notas da reunião, transcrição ou pontos discutidos…"
              rows={7} className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-y"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', lineHeight: '1.7' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(232,96,58,0.4)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
            <div className="flex justify-end">
              <button type="submit" disabled={!dealId.trim() || !notes.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--coral)', color: '#fff' }}>
                Processar Reunião
              </button>
            </div>
          </form>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <button onClick={handleMock}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
            style={{ background: 'rgba(232,96,58,0.08)', color: 'var(--coral)', border: '1px solid rgba(232,96,58,0.2)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM7 4v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Ver exemplo com reunião real (mock)
          </button>
        </div>
      ) : (
        <div className="rounded-2xl px-5 py-3.5 mb-6 flex items-center justify-between" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: 'rgba(232,96,58,0.1)', color: 'var(--coral)', border: '1px solid rgba(232,96,58,0.2)' }}>
              #
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {useMock ? 'Rodrigo Almeida Fonseca' : `Deal ${dealId}`}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {useMock ? 'Deal #303679 · Exemplo' : `Processando notas do deal #${dealId}`}
              </p>
            </div>
          </div>
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            ← Novo debrief
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2 mb-6">
          {LOADING_STEPS.map((step, i) => {
            const isDone = completedSteps.includes(i);
            const isActive = !isDone && (i === 0 || completedSteps.includes(i - 1));
            return (
              <div key={i} className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: isActive || isDone ? 1 : 0.4 }}>
                {isDone ? (
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: 'var(--coral)' }} />
                ) : isActive ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 animate-spin"
                    style={{ borderColor: 'var(--coral)', borderTopColor: 'transparent' }} />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: 'var(--border)' }} />
                )}
                <span className="text-xs" style={{ color: isDone ? 'var(--text-muted)' : isActive ? 'var(--text)' : 'var(--text-subtle)' }}>
                  {step.label}{isDone ? ' ✓' : isActive ? '…' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && !isLoading && (
        <div className="space-y-4">
          {/* Temperature badge */}
          {tempStyle && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: tempStyle.bg, border: `1px solid ${tempStyle.border}` }}>
              <span className="text-sm font-bold" style={{ color: tempStyle.text }}>{tempStyle.label}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{result.follow_up_justification}</span>
            </div>
          )}

          {/* Pipedrive status */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: result.pipedrive.note_created ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: result.pipedrive.note_created ? '#4ade80' : '#f87171', border: `1px solid ${result.pipedrive.note_created ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {result.pipedrive.note_created ? '✓' : '✗'} Nota no Pipedrive
            </span>
            <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: result.pipedrive.activity_created ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: result.pipedrive.activity_created ? '#4ade80' : '#f87171', border: `1px solid ${result.pipedrive.activity_created ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {result.pipedrive.activity_created ? '✓' : '✗'} Follow-up agendado{result.pipedrive.activity_due_date ? ` — ${result.pipedrive.activity_due_date}` : ''}
            </span>
            <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
              ✓ Salvo no banco
            </span>
          </div>

          {/* Briefing content */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--coral)' }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--coral)' }}>Debrief Gerado</span>
              </div>
              <button onClick={() => navigator.clipboard.writeText(result.briefing)}
                className="text-xs px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all"
                style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Copiar
              </button>
            </div>
            <div className="p-6" style={{ background: 'var(--surface)' }}>
              <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(result.briefing) }} />
            </div>
          </div>
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
      if (!rows.length) return m;
      const head = (rows[0] ?? '').replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
      const body = rows.slice(1).join('');
      return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
    })
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[htuploba]|$)(.+)$/gm, '<p>$1</p>');
}

'use client';
import { useState, useEffect, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DealListItem {
  deal_id: number;
  person_name: string;
  stage_name: string;
}

interface DealDetails {
  deal_id: string;
  stage_name: string;
  title: string;
  person_name: string;
  person_email: string | null;
  person_phone: string | null;
  owner_name: string;
  budget: string;
  mia_objetivo: string | null;
  mia_budget: string | null;
  mia_forma_pagamento: string | null;
  raw_empreendimento_id: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  { label: 'Buscando dados no Pipedrive', duration: 1200 },
  { label: 'Verificando conversa na MIA', duration: 900 },
  { label: 'Verificando histórico de conversões', duration: 700 },
  { label: 'Analisando leads similares', duration: 600 },
  { label: 'Gerando briefing com IA', duration: 0 },
];

const MOCK_DEAL: DealDetails = {
  deal_id: '303679',
  stage_name: 'Reunião Agendada',
  title: 'Rodrigo Almeida Fonseca',
  person_name: 'Rodrigo Almeida Fonseca',
  person_email: 'rodrigo.fonseca@gmail.com',
  person_phone: '(48) 99184-2271',
  owner_name: 'Julia Marques',
  budget: 'R$ 420K',
  mia_objetivo: 'Renda com aluguel',
  mia_budget: 'R$ 450K',
  mia_forma_pagamento: 'Financiamento + FGTS',
  raw_empreendimento_id: 'Morada Canasvieiras',
};

const MOCK_BRIEF = `## 👤 Perfil do Lead

**Nome:** Rodrigo Almeida Fonseca
**Email:** rodrigo.fonseca@gmail.com · **Telefone:** (48) 99184-2271
**Estágio atual:** Reunião Agendada · **Owner:** Julia Marques
**Budget declarado:** R$ 450K · **Budget no CRM:** R$ 420K

---

## 💬 Jornada na MIA (Pré-Deal)

- **Entrada via Lead Ads** — campanha Meta Ads, empreendimento Morada Canasvieiras
- **Objetivo declarado:** Renda com aluguel — perfil investidor claro
- **Forma de pagamento:** Financiamento + FGTS
- **Notas:** Lead bem qualificado. Confirmou imóvel próprio e capital de entrada. Perguntou sobre retorno e taxa de ocupação.
- **Link:** [Ver conversa completa](https://metabase.morada.ai/conversation/123)

---

## 📋 Histórico no CRM

- **Entrada:** 12/03/2026 via campanha Meta Ads
- **Atividades:** 2 ligações (29/03, 04/04), 1 e-mail de material, reunião marcada para hoje
- **Estágio atual:** Reunião Agendada

---

## ⚠️ Pontos de Atenção

- **Concorrente:** Mencionou empreendimento da HM Engenharia — possível objeção de preço
- **Decisão compartilhada:** Esposa precisa aprovar — trazer materiais visuais
- **Urgência moderada:** Estoque em 68% — criar senso de escassez com dados reais
- **FGTS pendente:** Confirmou uso mas não consultou saldo

---

## 🎯 Estratégia de Abordagem

1. **Abrir com projeção de retorno** — investidores respondem melhor a números (TIR 14-18% a.a.)
2. **Usar prova social** — proprietários do mesmo bairro/faixa que já converteram
3. **Tratar objeção HM diretamente** — comparativo de localização e gestão Seazone
4. **Fechar com escassez real** — 22 unidades, esgotamento projetado em 45 dias

---

## 💬 Script de Abertura Sugerido

*"Rodrigo, antes de falar do empreendimento — você me falou renda de aluguel. Quero entender: a ideia é complementar renda agora ou pensar em valorização de médio prazo? Porque dependendo disso, a estratégia de unidade muda bastante."*

---

## 📊 Leads Similares com Conversão

| Lead | Budget | Objetivo | Converteu? |
|---|---|---|---|
| Marco A. | R$ 380K | Renda aluguel | ✅ Sim |
| Fernanda L. | R$ 500K | Valorização | ✅ Sim |
| Sandro M. | R$ 420K | Renda aluguel | ✅ Sim |
| Carla B. | R$ 350K | Uso próprio | ❌ Perdido |`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function getAvatarBg(name: string) {
  const palette = ['#0d3d5e', '#0d4e6e', '#133d6e', '#0d4e4e', '#1a2d5e'];
  let h = 0;
  for (const c of name) h = ((h << 5) - h) + c.charCodeAt(0);
  return palette[Math.abs(h) % palette.length];
}

function SourceBadge({ label }: { label: string }) {
  const isMia = label === 'MIA';
  return (
    <span
      className="mt-1.5 inline-block text-xs px-1.5 py-0.5 rounded font-medium"
      style={
        isMia
          ? { background: 'rgba(6,214,192,0.08)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }
          : { background: 'var(--surface-2)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }
      }
    >
      {label}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BriefPage() {
  const [dealId, setDealId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [dealDetails, setDealDetails] = useState<DealDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [useMock, setUseMock] = useState(false);

  // Dropdown
  const [deals, setDeals] = useState<DealListItem[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropSearch, setDropSearch] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);

  // Fetch deals on mount
  useEffect(() => {
    setDealsLoading(true);
    fetch('/api/deals')
      .then(r => r.json())
      .then(d => setDeals(d.deals || []))
      .catch(() => {})
      .finally(() => setDealsLoading(false));
  }, []);

  // Click outside dropdown
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function runBriefing(id: string) {
    setSubmitted(true);
    setIsLoading(true);
    setBriefing(null);
    setError(null);
    setCompletedSteps([]);
    setUseMock(false);

    // Fetch deal details (quick, no AI)
    fetch(`/api/deals/${id}`)
      .then(r => r.json())
      .then(d => { if (d.deal) setDealDetails(d.deal); })
      .catch(() => {});

    // Animate steps
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < LOADING_STEPS.length - 1) {
        setCompletedSteps(prev => [...prev, stepIdx]);
        stepIdx++;
      }
    }, 900);

    try {
      const res = await fetch('/api/agent/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: id }),
      });
      const data = await res.json();
      clearInterval(interval);
      setCompletedSteps(LOADING_STEPS.map((_, i) => i));
      if (!res.ok) {
        setError(data.error ?? 'Erro desconhecido');
      } else {
        setBriefing(data.briefing);
      }
    } catch (e) {
      clearInterval(interval);
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId.trim()) return;
    await runBriefing(dealId.trim());
  }

  async function handleSelectDrop(deal: DealListItem) {
    setDealId(String(deal.deal_id));
    setDropOpen(false);
    setDropSearch('');
    await runBriefing(String(deal.deal_id));
  }

  function handleMock() {
    setDealId('303679');
    setUseMock(true);
    setSubmitted(true);
    setBriefing(MOCK_BRIEF);
    setDealDetails(MOCK_DEAL);
    setError(null);
    setIsLoading(false);
    setCompletedSteps([]);
  }

  function reset() {
    setSubmitted(false);
    setUseMock(false);
    setDealId('');
    setBriefing(null);
    setDealDetails(null);
    setError(null);
    setIsLoading(false);
    setCompletedSteps([]);
  }

  const filteredDeals = deals.filter(d => {
    const q = dropSearch.toLowerCase();
    return !q || d.person_name.toLowerCase().includes(q) || String(d.deal_id).includes(q);
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">

      {/* ── Header ── */}
      <div className="mb-8">
        <span
          className="inline-block text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
        >
          Pré-Reunião
        </span>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Briefing do Lead
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Insira o ID do deal ou selecione da lista para gerar inteligência comercial antes da reunião.
        </p>
      </div>

      {/* ── Input panel (only when not submitted) ── */}
      {!submitted && (
        <div
          className="rounded-2xl p-5 mb-8 max-w-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* Label */}
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
            Deal ID (Pipedrive)
          </p>

          {/* Input + Button */}
          <form onSubmit={handleSubmit} className="flex gap-2.5">
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                style={{ color: 'var(--text-subtle)' }}
              >
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                value={dealId}
                onChange={e => setDealId(e.target.value)}
                placeholder="Ex: 263734"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-border)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <button
              type="submit"
              disabled={!dealId.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--background)' }}
            >
              Buscar Deal
            </button>
          </form>

          {/* Divider */}
          <div className="my-4 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>ou selecione um deal</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Dropdown */}
          <div className="relative" ref={dropRef}>
            <button
              type="button"
              onClick={() => setDropOpen(o => !o)}
              disabled={dealsLoading}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              <span className="flex items-center gap-2">
                {dealsLoading && (
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 inline-block"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
                  />
                )}
                {dealsLoading ? 'Carregando deals…' : `${deals.length} deals em aberto`}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${dropOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {dropOpen && !dealsLoading && (
              <div
                className="absolute left-0 right-0 top-12 z-50 rounded-xl overflow-hidden shadow-2xl animate-fadeUp"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <input
                    value={dropSearch}
                    onChange={e => setDropSearch(e.target.value)}
                    placeholder="Filtrar por nome ou ID…"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredDeals.length === 0 ? (
                    <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Nenhum deal encontrado
                    </p>
                  ) : (
                    filteredDeals.map(deal => (
                      <button
                        key={deal.deal_id}
                        type="button"
                        onClick={() => handleSelectDrop(deal)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-all hover:bg-white/5"
                      >
                        <span style={{ color: 'var(--text)' }}>
                          {deal.person_name}
                          <span className="ml-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                            | #{deal.deal_id}
                          </span>
                        </span>
                        {deal.stage_name && (
                          <span className="ml-3 text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>
                            {deal.stage_name}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mock button */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>
          <button
            onClick={handleMock}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
            </svg>
            Ver exemplo com lead real (mock)
          </button>
        </div>
      )}

      {/* ── When submitted: deal header + back button ── */}
      {submitted && (
        <div className="animate-fadeUp">
          <button
            onClick={reset}
            className="mb-5 flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-all hover:bg-white/5"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Trocar lead
          </button>

          {/* Lead header */}
          {dealDetails && (
            <>
              <div
                className="rounded-2xl p-5 mb-4 flex items-start justify-between gap-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                    style={{ background: getAvatarBg(dealDetails.person_name) }}
                  >
                    {getInitials(dealDetails.person_name)}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text)' }}>
                      {dealDetails.person_name}
                    </h2>
                    <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                      Deal #{dealDetails.deal_id}
                    </p>
                    {(dealDetails.person_email || dealDetails.person_phone) && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {[dealDetails.person_email, dealDetails.person_phone].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <a
                  href={`https://seazone.pipedrive.com/deal/${dealDetails.deal_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-white/5 flex-shrink-0"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  Ver no Pipedrive
                  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>

              {/* Info cards — 3 + 3 grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  {
                    label: 'EMPREENDIMENTO',
                    value: dealDetails.raw_empreendimento_id || dealDetails.title || 'Não informado',
                    source: dealDetails.raw_empreendimento_id ? 'Pipedrive' : null,
                    accent: true,
                  },
                  {
                    label: 'BUDGET',
                    value: dealDetails.mia_budget || dealDetails.budget || 'Não informado',
                    source: dealDetails.mia_budget ? 'MIA' : 'Pipedrive',
                    accent: false,
                  },
                  {
                    label: 'OBJETIVO',
                    value: dealDetails.mia_objetivo || 'Não informado',
                    source: dealDetails.mia_objetivo ? 'MIA' : null,
                    accent: false,
                  },
                  {
                    label: 'CLOSER',
                    value: dealDetails.owner_name || 'Não informado',
                    source: null,
                    accent: false,
                  },
                  {
                    label: 'FORMA DE PAGAMENTO',
                    value: dealDetails.mia_forma_pagamento || 'Não informado',
                    source: dealDetails.mia_forma_pagamento ? 'MIA' : null,
                    accent: false,
                  },
                  {
                    label: 'ESTÁGIO',
                    value: dealDetails.stage_name || 'Não informado',
                    source: null,
                    accent: false,
                  },
                ].map(card => (
                  <div
                    key={card.label}
                    className="rounded-xl p-4"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderLeft: card.accent ? '3px solid var(--accent)' : '1px solid var(--border)',
                    }}
                  >
                    <p
                      className="text-xs font-semibold uppercase tracking-widest mb-1.5"
                      style={{ color: 'var(--text-subtle)' }}
                    >
                      {card.label}
                    </p>
                    <p
                      className="text-sm font-semibold leading-snug"
                      style={{ color: card.value === 'Não informado' ? 'var(--text-muted)' : 'var(--text)' }}
                    >
                      {card.value}
                    </p>
                    {card.source && <SourceBadge label={card.source} />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Loading steps ── */}
      {isLoading && (
        <div className="space-y-2 mb-6">
          {LOADING_STEPS.map((step, i) => {
            const isDone = completedSteps.includes(i);
            const isActive = !isDone && (i === 0 || completedSteps.includes(i - 1));
            return (
              <div
                key={i}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  opacity: isActive || isDone ? 1 : 0.35,
                }}
              >
                {isDone ? (
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                ) : isActive ? (
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
                  />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: 'var(--border)' }} />
                )}
                <span
                  className="text-xs"
                  style={{ color: isDone ? 'var(--text-muted)' : isActive ? 'var(--text)' : 'var(--text-subtle)' }}
                >
                  {step.label}{isDone ? ' ✓' : isActive ? '…' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div
          className="mt-4 p-4 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {/* ── Briefing content ── */}
      {briefing && !isLoading && (
        <div
          className="rounded-2xl overflow-hidden animate-fadeUp"
          style={{ border: '1px solid var(--border)' }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--accent)' }}>✦</span>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                Assistente IA — Briefing
              </span>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(briefing)}
              className="text-xs px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all hover:bg-white/5"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copiar
            </button>
          </div>
          <div className="p-6" style={{ background: 'var(--surface)' }}>
            <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(briefing) }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:1.25rem 0">')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--accent)">$1</a>')
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

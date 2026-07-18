import { useEffect, useMemo, useState } from "react";
import { csvUrl, daysSince, parseSheetDate, postToSheet, useSheetTable } from "./Sheets";

/* ---------------------------------------------------------
   Zafra · CRM (Prospecting)
   Structure borrowed from what current CRMs converge on
   (Attio / Pipedrive / HubSpot):
   - Board + List as tabs on the same object, not separate pages
   - A record drawer (not a full page nav) for the detail view,
     with a single unified activity timeline — Attio's signature
     pattern instead of scattered tabs
   - Deal-health / "rotting deal" indicator based on days since
     last contact — Pipedrive's activity-based-selling cue
   - Saved-view chips (Todos / Meus / Parados) above the toolbar
   - Bulk selection + bulk actions in the table, standard in
     every modern data-table (shadcn DataTable, Attio, HubSpot)

   DADOS: lê de duas abas do Google Sheets (CSV export) e escreve
   via Apps Script (Code.gs). Preencha CONFIG abaixo com os IDs
   da sua planilha — enquanto não preencher, a página continua
   funcionando com os dados de exemplo (MOCK_LEADS), só que sem
   persistir nada.
--------------------------------------------------------- */

const CONFIG = {
  SHEET_ID: "1Dsa4iFcHWfxvln2nSCoxS5vGpaLmgtPr4BErOdzG7O4",
  LEADS_GID: "0",
  ACTIVITIES_GID: "1029573554",
  WEBAPP_URL: "https://script.google.com/macros/s/AKfycbzgofha5IIfuDh2lWATB80gUncv1GsIiXf5yIPwKAPv8YbN9BCaH7rhpr2nKz8Kj4Xx/exec",
};
const IS_CONFIGURED = !CONFIG.SHEET_ID.startsWith("COLE_") && !CONFIG.WEBAPP_URL.startsWith("COLE_");
const LEADS_CSV_URL = csvUrl(CONFIG.SHEET_ID, CONFIG.LEADS_GID);
const ACTIVITIES_CSV_URL = csvUrl(CONFIG.SHEET_ID, CONFIG.ACTIVITIES_GID);

const STAGES = [
  { id: "leads", label: "Leads", dot: "#a9a9ae" },
  { id: "contacted", label: "Contacted", dot: "#c8512e" },
  { id: "proposal", label: "Proposal", dot: "#c99a2e" },
  { id: "closing", label: "Closing", dot: "#2e6fc9" },
  { id: "won", label: "Won", dot: "#2f7a52" },
];
// Fallback pra quando o valor de "stage" na planilha não bate com nenhum
// dos 5 acima (célula vazia, digitado errado, etc) — evita que a página
// inteira quebre por causa de um dado sujo numa linha.
const DEFAULT_STAGE = { id: "unknown", label: "Sem estágio", dot: "#c7c7c9" };

const SOURCES = ["Indicação", "Instagram", "Site", "Evento", "Cold outreach"];

const OWNERS = {
  "João": "#c8512e",
  "Ana": "#2e6fc9",
};

const MOCK_LEADS = [
  { id: "l1", name: "Pousada Vento Sul", contact: "Renata Alves", stage: "leads", value: 3200, source: "Indicação", daysAgo: 1, owner: "João", notes: [] },
  { id: "l2", name: "Chile Aventura Tours", contact: "Ignacio Vera", stage: "leads", value: 4800, source: "Instagram", daysAgo: 1, owner: "João", notes: [] },
  { id: "l3", name: "Explorer Club", contact: "Marcos Lima", stage: "leads", value: 2600, source: "Site", daysAgo: 2, owner: "João", notes: [] },
  { id: "l4", name: "Trilha Norte Expedições", contact: "Bianca Souza", stage: "leads", value: 3900, source: "Cold outreach", daysAgo: 8, owner: "Ana", notes: [] },
  { id: "l5", name: "Costa Azul Hospedagens", contact: "Rafael Dias", stage: "contacted", value: 5200, source: "Evento", daysAgo: 2, owner: "João", notes: [{ date: "16 jul", text: "Ligação inicial, demonstrou interesse." }] },
  { id: "l6", name: "Eco Travel", contact: "Maria Fontes", stage: "contacted", value: 4100, source: "Indicação", daysAgo: 1, owner: "João", notes: [{ date: "17 jul", text: "Enviado deck de apresentação." }] },
  { id: "l7", name: "Deserto Vivo Turismo", contact: "Pablo Rios", stage: "contacted", value: 3300, source: "Instagram", daysAgo: 9, owner: "Ana", notes: [] },
  { id: "l8", name: "Rota das Cataratas", contact: "Juliana Prado", stage: "proposal", value: 6800, source: "Site", daysAgo: 3, owner: "João", notes: [{ date: "15 jul", text: "Proposta enviada, aguardando retorno." }] },
  { id: "l9", name: "Bariloche Total", contact: "Sofía Méndez", stage: "proposal", value: 7400, source: "Evento", daysAgo: 6, owner: "Ana", notes: [] },
  { id: "l10", name: "Hotel Costa Azul", contact: "Fernando Melo", stage: "closing", value: 9200, source: "Indicação", daysAgo: 4, owner: "João", notes: [{ date: "12 jul", text: "Negociando condições de pagamento." }] },
  { id: "l11", name: "Grado Dez Turismo", contact: "Rocío Fuentes", stage: "closing", value: 8600, source: "Cold outreach", daysAgo: 10, owner: "João", notes: [] },
  { id: "l12", name: "Zerando o Atacama", contact: "Tales Barreto", stage: "won", value: 11500, source: "Indicação", daysAgo: 12, owner: "Ana", notes: [{ date: "08 jul", text: "Contrato assinado 🎉" }] },
];

/** Linha crua do CSV (tudo string) → lead tipado que o resto da página usa. */
function mapLeadRow(row) {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    stage: row.stage,
    value: Number(row.value) || 0,
    source: row.source,
    owner: row.owner,
    daysAgo: daysSince(parseSheetDate(row.last_contact_date)),
  };
}

function mapActivityRow(row) {
  return { id: row.id, leadId: row.lead_id, date: row.date, text: row.text };
}

const currency = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function healthOf(daysAgo) {
  if (daysAgo <= 2) return { level: "fresh", color: "#2f7a52", label: "Contato recente" };
  if (daysAgo <= 6) return { level: "warn", color: "#c99a2e", label: `${daysAgo}d sem contato` };
  return { level: "stale", color: "#b3402f", label: `${daysAgo}d parado` };
}

function daysAgoLabel(daysAgo) {
  if (daysAgo === 0) return "hoje";
  if (daysAgo === 1) return "há 1 dia";
  return `há ${daysAgo} dias`;
}

export default function CRMPage() {
  const leadsTable = useSheetTable(IS_CONFIGURED ? LEADS_CSV_URL : null);
  const activitiesTable = useSheetTable(IS_CONFIGURED ? ACTIVITIES_CSV_URL : null);

  const [leads, setLeads] = useState(IS_CONFIGURED ? [] : MOCK_LEADS);
  const [view, setView] = useState("kanban"); // "kanban" | "table"
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [segment, setSegment] = useState("all"); // "all" | "mine" | "stale"
  const [dragOverStage, setDragOverStage] = useState(null);
  const [sort, setSort] = useState({ key: "value", dir: "desc" });
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ name: "", contact: "", value: "", source: SOURCES[0] });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);

  // Sempre que o CSV atualiza (a cada 60s ou depois de um reload manual),
  // substitui os leads locais pela versão autoritativa da planilha.
  useEffect(() => {
    if (IS_CONFIGURED) setLeads(leadsTable.rows.map(mapLeadRow));
  }, [leadsTable.rows]);

  const activitiesByLead = useMemo(() => {
    const map = {};
    activitiesTable.rows.map(mapActivityRow).forEach((a) => {
      (map[a.leadId] = map[a.leadId] || []).push(a);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.date < b.date ? 1 : -1)));
    return map;
  }, [activitiesTable.rows]);

  const staleCount = leads.filter((l) => l.daysAgo > 6).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      const matchesQuery = !q || l.name.toLowerCase().includes(q) || l.contact.toLowerCase().includes(q);
      const matchesStage = stageFilter === "all" || l.stage === stageFilter;
      const matchesSegment = segment === "all" || (segment === "mine" && l.owner === "João") || (segment === "stale" && l.daysAgo > 6);
      return matchesQuery && matchesStage && matchesSegment;
    });
  }, [leads, query, stageFilter, segment]);

  const sortedForTable = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av = a[sort.key];
      let bv = b[sort.key];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const totals = useMemo(() => {
    const totalValue = filtered.reduce((s, l) => s + l.value, 0);
    const won = filtered.filter((l) => l.stage === "won").length;
    return { count: filtered.length, totalValue, won };
  }, [filtered]);

  const selectedLead = leads.find((l) => l.id === selectedId) || null;
  const selectedNotes = selectedLead
    ? (IS_CONFIGURED ? (activitiesByLead[selectedLead.id] || []) : (selectedLead.notes || []))
    : [];

  function moveLead(id, stage) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    if (!IS_CONFIGURED) return;
    postToSheet(CONFIG.WEBAPP_URL, "updateLead", { id, fields: { stage } }).catch((e) => {
      setErrorMsg(e.message);
      leadsTable.reload();
    });
  }

  function toggleSort(key) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  async function addLead(e) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const lead = { name: draft.name, contact: draft.contact || "—", value: Number(draft.value) || 0, source: draft.source, stage: "leads", owner: "João" };
    if (!IS_CONFIGURED) {
      const id = "l" + Math.random().toString(36).slice(2, 8);
      setLeads((prev) => [{ id, ...lead, daysAgo: 0, notes: [] }, ...prev]);
    } else {
      try {
        await postToSheet(CONFIG.WEBAPP_URL, "createLead", { lead });
        await leadsTable.reload();
      } catch (err) {
        setErrorMsg(err.message);
      }
    }
    setDraft({ name: "", contact: "", value: "", source: SOURCES[0] });
    setShowForm(false);
  }

  async function logActivity(id) {
    if (!noteDraft.trim()) return;
    const text = noteDraft.trim();
    setNoteDraft("");
    if (!IS_CONFIGURED) {
      setLeads((prev) => prev.map((l) => (l.id === id
        ? { ...l, daysAgo: 0, notes: [{ date: "hoje", text }, ...(l.notes || [])] }
        : l)));
      return;
    }
    try {
      await postToSheet(CONFIG.WEBAPP_URL, "addActivity", { activity: { lead_id: id, text, created_by: "João" } });
      await Promise.all([leadsTable.reload(), activitiesTable.reload()]);
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  function toggleRow(id) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function bulkMove(stage) {
    if (!stage) return;
    const ids = [...selectedRows];
    setLeads((prev) => prev.map((l) => (selectedRows.has(l.id) ? { ...l, stage } : l)));
    setSelectedRows(new Set());
    if (!IS_CONFIGURED) return;
    postToSheet(CONFIG.WEBAPP_URL, "bulkUpdateStage", { ids, stage }).catch((e) => {
      setErrorMsg(e.message);
      leadsTable.reload();
    });
  }

  function bulkRemove() {
    const ids = [...selectedRows];
    setLeads((prev) => prev.filter((l) => !selectedRows.has(l.id)));
    setSelectedRows(new Set());
    if (!IS_CONFIGURED) return;
    postToSheet(CONFIG.WEBAPP_URL, "bulkDelete", { ids }).catch((e) => {
      setErrorMsg(e.message);
      leadsTable.reload();
    });
  }

  function deleteLead(id) {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelectedId(null);
    setConfirmDeleteId(null);
    if (!IS_CONFIGURED) return;
    postToSheet(CONFIG.WEBAPP_URL, "deleteLead", { id }).catch((e) => {
      setErrorMsg(e.message);
      leadsTable.reload();
    });
  }

  return (
    <div className="crm">
      {!IS_CONFIGURED && (
        <div className="banner banner-info">
          Rodando com dados de exemplo — preencha o <code>CONFIG</code> no topo de <code>CRMPage.jsx</code> com os dados da sua planilha e do Apps Script pra ligar de verdade.
        </div>
      )}
      {IS_CONFIGURED && leadsTable.error && (
        <div className="banner banner-error">Erro ao carregar a planilha: {leadsTable.error}</div>
      )}
      {errorMsg && (
        <div className="banner banner-error">
          {errorMsg}
          <button onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      <header className="crm-top">
        <div>
          <h1>Prospecting CRM</h1>
          <p>{totals.count} leads · {currency(totals.totalValue)} em pipeline · {totals.won} ganhos</p>
        </div>
        <button className="primary-btn" onClick={() => setShowForm((v) => !v)}>+ Novo lead</button>
      </header>

      <div className="tabs">
        <button className={view === "kanban" ? "tab active" : "tab"} onClick={() => setView("kanban")}>Quadro</button>
        <button className={view === "table" ? "tab active" : "tab"} onClick={() => setView("table")}>Lista</button>
      </div>

      {showForm && (
        <form className="crm-form" onSubmit={addLead}>
          <input placeholder="Nome do cliente/agência" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <input placeholder="Contato" value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} />
          <input placeholder="Valor estimado (R$)" type="number" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
          <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="primary-btn" type="submit">Adicionar</button>
          <button className="ghost-btn" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
        </form>
      )}

      <div className="segments">
        <button className={segment === "all" ? "segment active" : "segment"} onClick={() => setSegment("all")}>Todos</button>
        <button className={segment === "mine" ? "segment active" : "segment"} onClick={() => setSegment("mine")}>Meus leads</button>
        <button className={segment === "stale" ? "segment active" : "segment"} onClick={() => setSegment("stale")}>
          Parados {staleCount > 0 && <span className="segment-count">{staleCount}</span>}
        </button>
      </div>

      <div className="crm-toolbar">
        <input className="search" placeholder="Buscar por cliente ou contato…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="stage-chips">
          <button className={stageFilter === "all" ? "chip active" : "chip"} onClick={() => setStageFilter("all")}>Todos os estágios</button>
          {STAGES.map((s) => (
            <button key={s.id} className={stageFilter === s.id ? "chip active" : "chip"} onClick={() => setStageFilter(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>

      {view === "kanban" ? (
        <div className="board">
          {STAGES.filter((s) => stageFilter === "all" || s.id === stageFilter).map((stage) => {
            const stageLeads = filtered.filter((l) => l.stage === stage.id);
            const stageValue = stageLeads.reduce((s, l) => s + l.value, 0);
            return (
              <div
                key={stage.id}
                className={`column${dragOverStage === stage.id ? " drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
                onDragLeave={() => setDragOverStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/lead-id");
                  if (id) moveLead(id, stage.id);
                  setDragOverStage(null);
                }}
              >
                <div className="column-head">
                  <span className="column-dot" style={{ background: stage.dot }} />
                  <span>{stage.label}</span>
                  <span className="column-count">{stageLeads.length}</span>
                </div>
                <div className="column-value">{currency(stageValue)}</div>
                <div className="column-body">
                  {stageLeads.map((lead) => {
                    const health = healthOf(lead.daysAgo);
                    return (
                      <div
                        key={lead.id}
                        className="lead-card"
                        style={{ borderLeftColor: health.color }}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
                        onClick={() => setSelectedId(lead.id)}
                      >
                        <div className="lead-card-top">
                          <span className="avatar-sm" style={{ borderColor: OWNERS[lead.owner] }}>{initials(lead.contact)}</span>
                          <strong>{lead.name}</strong>
                        </div>
                        <p className="lead-contact">{lead.contact}</p>
                        <div className="lead-meta">
                          <span>{currency(lead.value)}</span>
                          <span className="tag">{lead.source}</span>
                        </div>
                        <div className="lead-foot">
                          <span className="health" style={{ color: health.color }}>
                            <span className="health-dot" style={{ background: health.color }} />
                            {health.label}
                          </span>
                          <span className="owner-chip" style={{ color: OWNERS[lead.owner] }}>{lead.owner}</span>
                        </div>
                      </div>
                    );
                  })}
                  {stageLeads.length === 0 && <div className="column-empty">Arraste um lead para cá</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {selectedRows.size > 0 && (
            <div className="bulk-bar">
              <span>{selectedRows.size} selecionado{selectedRows.size > 1 ? "s" : ""}</span>
              <select defaultValue="" onChange={(e) => bulkMove(e.target.value)}>
                <option value="" disabled>Mover para…</option>
                {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <button className="bulk-remove" onClick={bulkRemove}>Remover</button>
              <button className="bulk-clear" onClick={() => setSelectedRows(new Set())}>Limpar seleção</button>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="th-check">
                    <input
                      type="checkbox"
                      checked={sortedForTable.length > 0 && sortedForTable.every((l) => selectedRows.has(l.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRows(new Set(sortedForTable.map((l) => l.id)));
                        else setSelectedRows(new Set());
                      }}
                    />
                  </th>
                  {[["name", "Cliente"], ["contact", "Contato"], ["stage", "Estágio"], ["value", "Valor"], ["source", "Origem"], ["daysAgo", "Último contato"], ["owner", "Dono"]].map(([key, label]) => (
                    <th key={key} onClick={() => toggleSort(key)}>
                      {label} {sort.key === key ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedForTable.map((lead) => {
                  const stage = STAGES.find((s) => s.id === lead.stage) || DEFAULT_STAGE;
                  const health = healthOf(lead.daysAgo);
                  return (
                    <tr key={lead.id} className={selectedRows.has(lead.id) ? "row-selected" : ""}>
                      <td className="th-check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedRows.has(lead.id)} onChange={() => toggleRow(lead.id)} />
                      </td>
                      <td className="clickable" onClick={() => setSelectedId(lead.id)}><strong>{lead.name}</strong></td>
                      <td className="clickable" onClick={() => setSelectedId(lead.id)}>{lead.contact}</td>
                      <td className="clickable" onClick={() => setSelectedId(lead.id)}>
                        <span className="badge"><span className="badge-dot" style={{ background: stage.dot }} />{stage.label}</span>
                      </td>
                      <td className="clickable" onClick={() => setSelectedId(lead.id)}>{currency(lead.value)}</td>
                      <td className="clickable" onClick={() => setSelectedId(lead.id)}>{lead.source}</td>
                      <td className="clickable" onClick={() => setSelectedId(lead.id)}>
                        <span className="health" style={{ color: health.color }}>
                          <span className="health-dot" style={{ background: health.color }} />
                          {daysAgoLabel(lead.daysAgo)}
                        </span>
                      </td>
                      <td className="clickable" onClick={() => setSelectedId(lead.id)}>
                        <span className="owner-chip" style={{ color: OWNERS[lead.owner] }}>{lead.owner}</span>
                      </td>
                    </tr>
                  );
                })}
                {sortedForTable.length === 0 && (
                  <tr><td colSpan={8} className="table-empty">Nenhum lead encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedLead && (
        <div className="drawer-overlay" onClick={() => setSelectedId(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <h2>{selectedLead.name}</h2>
                <p>{selectedLead.contact}</p>
              </div>
              <div className="drawer-head-actions">
                <button className="drawer-delete" onClick={() => setConfirmDeleteId(selectedLead.id)} title="Excluir lead">🗑</button>
                <button className="drawer-close" onClick={() => setSelectedId(null)}>✕</button>
              </div>
            </div>

            <div className="drawer-fields">
              <div>
                <label>Estágio</label>
                <select value={selectedLead.stage} onChange={(e) => moveLead(selectedLead.id, e.target.value)}>
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label>Valor estimado</label>
                <div className="drawer-static">{currency(selectedLead.value)}</div>
              </div>
              <div>
                <label>Origem</label>
                <div className="drawer-static">{selectedLead.source}</div>
              </div>
              <div>
                <label>Dono</label>
                <div className="drawer-static owner-chip" style={{ color: OWNERS[selectedLead.owner] }}>{selectedLead.owner}</div>
              </div>
            </div>

            <div className="drawer-health">
              <span className="health-dot" style={{ background: healthOf(selectedLead.daysAgo).color }} />
              {healthOf(selectedLead.daysAgo).label} · último contato {daysAgoLabel(selectedLead.daysAgo)}
            </div>

            <div className="drawer-log">
              <input
                placeholder="Registrar uma interação…"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && logActivity(selectedLead.id)}
              />
              <button className="primary-btn" onClick={() => logActivity(selectedLead.id)}>Registrar</button>
            </div>

            <div className="drawer-timeline">
              <h3>Linha do tempo</h3>
              {selectedNotes.length === 0 ? (
                <p className="timeline-empty">Nenhuma interação registrada ainda.</p>
              ) : (
                <ul>
                  {selectedNotes.map((n, i) => (
                    <li key={i}>
                      <span className="timeline-dot" />
                      <div>
                        <span className="timeline-date">{n.date}</span>
                        <p>{n.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <h3>Excluir lead?</h3>
            <p>Essa ação não pode ser desfeita — o lead será removido da planilha.</p>
            <div className="confirm-actions">
              <button className="ghost-btn" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
              <button className="confirm-delete-btn" onClick={() => deleteLead(confirmDeleteId)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .crm {
          --bg: #fafafa; --card: #ffffff; --ink: #131314; --ink-soft: #75757a; --ink-faint: #a9a9ae;
          --line: #e7e7e9; --accent: #c8512e; --green: #2f7a52; --green-soft: #e2f0e6; --red: #b3402f; --sand: #f2f2f0;
          color: var(--ink); font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif; font-size: 14px; position: relative;
        }
        .crm * { box-sizing: border-box; }
        .crm button, .crm input, .crm select { font-family: inherit; }
        .crm button { cursor: pointer; }

        .banner { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; padding: 9px 13px; border-radius: 8px; margin-bottom: 12px; }
        .banner code { background: rgba(0,0,0,.06); padding: 1px 5px; border-radius: 4px; font-size: 11.5px; }
        .banner-info { background: var(--sand); color: var(--ink-soft); }
        .banner-error { background: var(--red-soft, #f7e2dd); color: var(--red); }
        .banner-error button { background: none; border: none; color: inherit; font-size: 12px; }

        .crm-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
        .crm-top h1 { font-size: 22px; margin: 0 0 3px; font-weight: 700; letter-spacing: -0.3px; color: var(--ink); }
        .crm-top p { margin: 0; color: var(--ink-soft); font-size: 13px; }

        .primary-btn { background: var(--ink); color: #fff; border: none; padding: 8px 15px; border-radius: 7px; font-size: 13px; font-weight: 600; white-space: nowrap; }
        .ghost-btn { background: none; color: var(--ink-soft); border: 1px solid var(--line); padding: 8px 13px; border-radius: 7px; font-size: 13px; }

        .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 14px; }
        .tab { background: none; border: none; padding: 9px 4px; margin-right: 18px; font-size: 13.5px; font-weight: 600; color: var(--ink-faint); border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .tab:hover { color: var(--ink-soft); }
        .tab.active { color: var(--ink); border-bottom-color: var(--ink); }

        .crm-form { display: flex; flex-wrap: wrap; gap: 8px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 13px; margin-bottom: 14px; }
        .crm-form input, .crm-form select { border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; font-size: 13px; background: #fff; color: var(--ink); }
        .crm-form input[placeholder="Nome do cliente/agência"] { flex: 2; min-width: 180px; }
        .crm-form input[placeholder="Contato"] { flex: 1.4; min-width: 140px; }
        .crm-form input[type="number"] { width: 150px; }

        .segments { display: flex; gap: 6px; margin-bottom: 12px; }
        .segment { background: var(--card); border: 1px solid var(--line); color: var(--ink-soft); font-size: 12.5px; font-weight: 600; padding: 6px 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px; }
        .segment.active { background: var(--ink); border-color: var(--ink); color: #fff; }
        .segment-count { background: var(--red); color: #fff; font-size: 10px; font-weight: 700; border-radius: 20px; padding: 1px 6px; }
        .segment.active .segment-count { background: rgba(255,255,255,.25); }

        .crm-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .search { flex: 1; min-width: 220px; max-width: 320px; border: 1px solid var(--line); border-radius: 8px; padding: 8px 11px; font-size: 13px; background: var(--card); color: var(--ink); }
        .stage-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip { background: var(--card); border: 1px solid var(--line); color: var(--ink-soft); font-size: 12px; padding: 6px 12px; border-radius: 20px; }
        .chip.active { background: var(--ink); border-color: var(--ink); color: #fff; }

        /* Kanban */
        .board { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 260px)); justify-content: start; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
        .column { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; min-height: 200px; transition: background .15s, border-color .15s; }
        .column.drag-over { background: var(--sand); border-color: var(--ink-faint); }
        .column-head { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; }
        .column-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .column-count { margin-left: auto; background: var(--sand); border-radius: 20px; padding: 1px 8px; font-size: 11.5px; font-weight: 700; color: var(--ink-soft); }
        .column-value { font-size: 11px; color: var(--ink-faint); margin: 3px 0 10px 14px; }
        .column-body { display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .column-empty { font-size: 11.5px; color: var(--ink-faint); text-align: center; border: 1px dashed var(--line); border-radius: 8px; padding: 16px 6px; }

        .lead-card { background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--line); border-radius: 9px; padding: 10px; cursor: pointer; }
        .lead-card:hover { border-color: var(--ink-faint); box-shadow: 0 1px 4px rgba(0,0,0,.05); }
        .lead-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .lead-card-top strong { font-size: 12.5px; line-height: 1.25; }
        .avatar-sm { width: 20px; height: 20px; border-radius: 50%; background: var(--sand); border: 1.5px solid var(--line); color: var(--ink-soft); font-size: 9.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .lead-contact { margin: 0 0 8px; font-size: 11.5px; color: var(--ink-faint); }
        .lead-meta { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 8px; }
        .tag { background: var(--sand); color: var(--ink-soft); font-size: 10px; padding: 2px 7px; border-radius: 20px; }
        .lead-foot { display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; }
        .health { display: flex; align-items: center; gap: 5px; font-weight: 600; }
        .health-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .owner-chip { font-weight: 700; }

        /* Bulk bar */
        .bulk-bar { display: flex; align-items: center; gap: 10px; background: var(--ink); color: #fff; border-radius: 9px; padding: 9px 14px; margin-bottom: 10px; font-size: 12.5px; }
        .bulk-bar select { background: #2a2a2c; color: #fff; border: 1px solid #444; border-radius: 6px; padding: 5px 8px; font-size: 12px; }
        .bulk-remove { background: var(--red); color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; }
        .bulk-clear { background: none; border: none; color: rgba(255,255,255,.7); font-size: 12px; margin-left: auto; }
        .bulk-clear:hover { color: #fff; }

        /* Table */
        .table-wrap { background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 11px 14px; background: var(--sand); font-size: 11px; color: var(--ink-soft); font-weight: 600; text-transform: uppercase; letter-spacing: .4px; cursor: pointer; user-select: none; }
        td { padding: 11px 14px; border-top: 1px solid var(--line); }
        td.clickable { cursor: pointer; }
        tr.row-selected { background: #faf3ef; }
        .th-check { width: 34px; cursor: default; }
        .badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--ink-soft); }
        .badge-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .table-empty { text-align: center; color: var(--ink-faint); padding: 30px; }

        /* Drawer */
        .drawer-overlay { position: fixed; inset: 0; background: rgba(19,19,20,.28); display: flex; justify-content: flex-end; z-index: 40; }

        .confirm-overlay { position: fixed; inset: 0; background: rgba(19,19,20,.4); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 20px; }
        .confirm-card { background: var(--card); border-radius: 12px; padding: 22px; max-width: 340px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
        .confirm-card h3 { margin: 0 0 8px; font-size: 16px; color: var(--ink); }
        .confirm-card p { margin: 0 0 18px; font-size: 13px; color: var(--ink-soft); line-height: 1.5; }
        .confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .confirm-delete-btn { background: var(--red); color: #fff; border: none; padding: 8px 15px; border-radius: 7px; font-size: 13px; font-weight: 600; }
        .confirm-delete-btn:hover { background: #97382a; }
        .drawer { width: 380px; max-width: 92vw; height: 100%; background: var(--card); border-left: 1px solid var(--line); padding: 22px; overflow-y: auto; }
        .drawer-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
        .drawer-head h2 { font-size: 17px; margin: 0 0 2px; color: var(--ink); }
        .drawer-head p { margin: 0; font-size: 12.5px; color: var(--ink-soft); }
        .drawer-head-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .drawer-close { background: var(--sand); border: none; width: 26px; height: 26px; border-radius: 7px; font-size: 12px; color: var(--ink-soft); flex-shrink: 0; }
        .drawer-close:hover { background: var(--line); }
        .drawer-delete { background: var(--sand); border: none; width: 26px; height: 26px; border-radius: 7px; font-size: 12px; color: var(--red); flex-shrink: 0; }
        .drawer-delete:hover { background: var(--red-soft, #f7e2dd); }

        .drawer-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .drawer-fields label { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; color: var(--ink-faint); margin-bottom: 4px; font-weight: 600; }
        .drawer-fields select { width: 100%; border: 1px solid var(--line); border-radius: 7px; padding: 7px 8px; font-size: 12.5px; background: #fff; }
        .drawer-static { font-size: 13px; padding: 2px 0; }

        .drawer-health { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-soft); background: var(--sand); border-radius: 7px; padding: 8px 10px; margin-bottom: 16px; }

        .drawer-log { display: flex; gap: 6px; margin-bottom: 18px; }
        .drawer-log input { flex: 1; border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; font-size: 12.5px; }

        .drawer-timeline h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .3px; color: var(--ink-faint); margin: 0 0 10px; font-weight: 600; }
        .timeline-empty { font-size: 12.5px; color: var(--ink-faint); }
        .drawer-timeline ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
        .drawer-timeline li { display: flex; gap: 10px; }
        .timeline-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-faint); margin-top: 5px; flex-shrink: 0; }
        .timeline-date { font-size: 11px; color: var(--ink-faint); font-weight: 600; }
        .drawer-timeline p { margin: 3px 0 0; font-size: 13px; line-height: 1.4; }

        @media (max-width: 1000px) {
          .board { grid-template-columns: repeat(5, 230px); }
        }
      `}</style>
    </div>
  );
}
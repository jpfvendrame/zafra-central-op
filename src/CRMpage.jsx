import { useEffect, useMemo, useRef, useState } from "react";
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

   DADOS: Leads/Activities agora passam por webhooks autenticados
   do n8n (crm_get_leads, crm_get_activities, crm_write) — cada
   pessoa só vê/edita os próprios leads, exceto admin, que vê e
   edita tudo (inclusive reatribuir o dono de um lead).

   Tags continuam pelo caminho antigo (CSV público + Apps Script)
   — não têm dono nem informação sensível, então não precisavam
   entrar nessa migração de segurança.
--------------------------------------------------------- */

const N8N_BASE = "https://n8n-n8n.yypjz6.easypanel.host/webhook";
const LEADS_URL = `${N8N_BASE}/crm_get_leads`;
const ACTIVITIES_URL = `${N8N_BASE}/crm_get_activities`;
const WRITE_URL = `${N8N_BASE}/crm_write`;
const LIST_USERS_URL = "https://n8n-n8n.yypjz6.easypanel.host/webhook/list_users";
const LIST_USERS_CONFIGURED = !LIST_USERS_URL.startsWith("COLE_");

// Só usado pra Tags (CSV público + Apps Script) — Leads/Activities não usam mais isso.
const CONFIG = {
  SHEET_ID: "1Dsa4iFcHWfxvln2nSCoxS5vGpaLmgtPr4BErOdzG7O4",
  TAGS_GID: "1719715174",
  WEBAPP_URL: "https://script.google.com/macros/s/AKfycbxYIdI65nXKW8lZ-HoieceJg72fxqmo4q6F_ce-w62UGrx_YkZrK00_VshX9Fm_m1dF/exec",
};
const TAGS_CONFIGURED = !CONFIG.SHEET_ID.startsWith("COLE_");
const TAGS_CSV_URL = csvUrl(CONFIG.SHEET_ID, CONFIG.TAGS_GID);

const STAGES = [
  { id: "leads", label: "Leads", dot: "#c7c7c9" },
  { id: "contacted", label: "Contacted", dot: "#a3a3a6" },
  { id: "proposal", label: "Proposal", dot: "#7a7a7d" },
  { id: "closing", label: "Closing", dot: "#4d4d50" },
  { id: "won", label: "Won", dot: "#131314" },
];
// Fallback pra quando o valor de "stage" na planilha não bate com nenhum
// dos 5 acima (célula vazia, digitado errado, etc) — evita que a página
// inteira quebre por causa de um dado sujo numa linha.
const DEFAULT_STAGE = { id: "unknown", label: "Sem estágio", dot: "#c7c7c9" };

const SOURCES = ["Indicação", "Instagram", "Site", "Evento", "Cold outreach"];

// Paleta estilo ClickUp — cores prontas pra escolher ao criar uma tag nova.
const TAG_PALETTE = [
  "#e05252", "#e08a3c", "#d9b23c", "#5aa66b",
  "#3c9ea8", "#4d7fd4", "#7c5cd4", "#c15cb0",
  "#8a8a8d", "#6b5344",
];

// Cores pra distinguir donos de lead visualmente — atribuídas por hash do
// e-mail, então a mesma pessoa sempre cai na mesma cor, sem precisar de
// um mapa fixo por nome (que não escalava conforme a equipe crescia).
const OWNER_PALETTE = ["#131314", "#4a4a4d", "#75757a", "#2e6fc9", "#7c5cd4", "#3c9ea8"];
function ownerColor(email) {
  if (!email) return "#a9a9ae";
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  return OWNER_PALETTE[hash % OWNER_PALETTE.length];
}

/** Linha crua vinda do webhook → lead tipado que o resto da página usa. */
function mapLeadRow(raw) {
  return {
    id: raw.id || "",
    name: raw.name || "",
    contact: raw.contact || "",
    stage: raw.stage || "",
    value: Number(raw.value) || 0,
    source: raw.source || "",
    ownerEmail: raw.owner_email || "",
    daysAgo: daysSince(parseSheetDate(raw.last_contact_date)),
    tagIds: String(raw.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
  };
}

function mapActivityRow(raw) {
  return { date: raw.date || "", text: raw.text || "", createdBy: raw.created_by || "" };
}

function mapTagRow(row) {
  return { id: row.id, name: row.name, color: row.color || "#8a8a8d" };
}

const currency = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function initials(name) {
  if (!name) return "?";
  return String(name).split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function healthOf(daysAgo) {
  if (daysAgo <= 2) return { level: "fresh", color: "#a9a9ae", label: "Contato recente" };
  if (daysAgo <= 6) return { level: "warn", color: "#6b6b6e", label: `${daysAgo}d sem contato` };
  return { level: "stale", color: "#131314", label: `${daysAgo}d parado` };
}

function daysAgoLabel(daysAgo) {
  if (daysAgo === 0) return "hoje";
  if (daysAgo === 1) return "há 1 dia";
  return `há ${daysAgo} dias`;
}

export default function CRMPage({ token, userEmail }) {
  const tagsTable = useSheetTable(TAGS_CONFIGURED ? TAGS_CSV_URL : null);
  const [tags, setTags] = useState([]);

  const [leads, setLeads] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [leadsError, setLeadsError] = useState(null);

  const [activitiesByLead, setActivitiesByLead] = useState({});
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activitiesError, setActivitiesError] = useState(null);

  const [allUsers, setAllUsers] = useState([]); // pra reatribuição + filtro do admin
  const [ownerFilter, setOwnerFilter] = useState("all"); // só usado pelo admin

  const [view, setView] = useState("kanban"); // "kanban" | "table"
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState(new Set());
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
  const [showTagMaker, setShowTagMaker] = useState(false);
  const inFlightRef = useRef(new Set()); // trava síncrona contra clique duplo em ações destrutivas
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0]);

  useEffect(() => {
    if (TAGS_CONFIGURED) setTags(tagsTable.rows.map(mapTagRow));
  }, [tagsTable.rows]);

  const tagsById = useMemo(() => Object.fromEntries(tags.map((t) => [t.id, t])), [tags]);

  async function reloadLeads() {
    if (!token) return;
    setLoadingLeads(true);
    setLeadsError(null);
    try {
      const res = await fetch(LEADS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.sucesso) {
        setLeads(data.leads.map(mapLeadRow));
        setIsAdmin(!!data.isAdmin);
      } else {
        setLeadsError(data.error || "Não consegui carregar os leads.");
      }
    } catch (err) {
      setLeadsError("Não consegui falar com o servidor.");
    } finally {
      setLoadingLeads(false);
    }
  }

  useEffect(() => { reloadLeads(); }, [token]);

  // Lista de gente pra reatribuir/filtrar — só busca se for admin.
  useEffect(() => {
    if (!isAdmin || !LIST_USERS_CONFIGURED || !token) return;
    fetch(LIST_USERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => { if (data.sucesso) setAllUsers(data.users || []); })
      .catch(() => {});
  }, [isAdmin, token]);

  function ownerLabel(email) {
    if (!email) return "—";
    const u = allUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    return u?.name || email.split("@")[0];
  }

  // Fallback pro seletor de dono quando list_users ainda não está configurado:
  // deriva a lista de donos a partir dos próprios leads já carregados.
  const ownerOptions = useMemo(() => {
    if (allUsers.length > 0) return allUsers.map((u) => ({ email: u.email, name: u.name }));
    const seen = new Map();
    leads.forEach((l) => { if (l.ownerEmail && !seen.has(l.ownerEmail)) seen.set(l.ownerEmail, l.ownerEmail.split("@")[0]); });
    return [...seen.entries()].map(([email, name]) => ({ email, name }));
  }, [allUsers, leads]);

  async function loadActivities(leadId, force = false) {
    if (!token || (!force && activitiesByLead[leadId])) return;
    setLoadingActivities(true);
    setActivitiesError(null);
    try {
      const res = await fetch(ACTIVITIES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, lead_id: leadId }),
      });
      const data = await res.json();
      if (data.sucesso) {
        setActivitiesByLead((prev) => ({ ...prev, [leadId]: data.activities.map(mapActivityRow) }));
      } else {
        setActivitiesError(data.error || "Não consegui carregar o histórico.");
      }
    } catch (err) {
      setActivitiesError("Não consegui falar com o servidor de histórico.");
    } finally {
      setLoadingActivities(false);
    }
  }

  function openLead(id) {
    setSelectedId(id);
    loadActivities(id);
  }

  async function postWrite(action, payload) {
    const res = await fetch(WRITE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, ...payload }),
    });
    const data = await res.json();
    if (!data.sucesso) throw new Error(data.error || "Falha ao salvar.");
    return data;
  }

  const staleCount = leads.filter((l) => l.daysAgo > 6).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      const matchesQuery = !q || l.name.toLowerCase().includes(q) || l.contact.toLowerCase().includes(q);
      const matchesStage = stageFilter === "all" || l.stage === stageFilter;
      const matchesSegment = segment === "all" || (segment === "mine" && l.ownerEmail === userEmail) || (segment === "stale" && l.daysAgo > 6);
      const matchesTags = tagFilter.size === 0 || (l.tagIds || []).some((t) => tagFilter.has(t));
      const matchesOwnerFilter = !isAdmin || ownerFilter === "all" || l.ownerEmail === ownerFilter;
      return matchesQuery && matchesStage && matchesSegment && matchesTags && matchesOwnerFilter;
    });
  }, [leads, query, stageFilter, segment, tagFilter, isAdmin, ownerFilter, userEmail]);

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
  const selectedNotes = selectedLead ? (activitiesByLead[selectedLead.id] || []) : [];

  function updateLeadField(id, sheetField, localField, value) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, [localField]: value } : l)));
    postWrite("update_lead", { id, fields: { [sheetField]: value } }).catch((e) => {
      setErrorMsg(e.message);
      reloadLeads();
    });
  }

  function moveLead(id, stage) {
    updateLeadField(id, "stage", "stage", stage);
  }

  function reassignOwner(id, email) {
    if (!email.trim()) return;
    updateLeadField(id, "owner_email", "ownerEmail", email.trim());
  }

  function toggleLeadTag(lead, tagId) {
    const current = lead.tagIds || [];
    const next = current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId];
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, tagIds: next } : l)));
    postWrite("update_lead", { id: lead.id, fields: { tags: next.join(",") } }).catch((e) => {
      setErrorMsg(e.message);
      reloadLeads();
    });
  }

  function toggleTagFilter(tagId) {
    setTagFilter((prev) => {
      const next = new Set(prev);
      next.has(tagId) ? next.delete(tagId) : next.add(tagId);
      return next;
    });
  }

  async function createTag(e) {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      await postToSheet(CONFIG.WEBAPP_URL, "createTag", { tag: { name: newTagName.trim(), color: newTagColor } });
      await tagsTable.reload();
    } catch (err) {
      setErrorMsg(err.message);
    }
    setNewTagName("");
    setNewTagColor(TAG_PALETTE[0]);
  }

  function deleteTag(id) {
    setTags((prev) => prev.filter((t) => t.id !== id));
    setTagFilter((prev) => { const next = new Set(prev); next.delete(id); return next; });
    postToSheet(CONFIG.WEBAPP_URL, "deleteTag", { id }).catch((e) => {
      setErrorMsg(e.message);
      tagsTable.reload();
    });
  }

  function toggleSort(key) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  async function addLead(e) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    try {
      await postWrite("create_lead", { lead: { name: draft.name, contact: draft.contact || "—", value: Number(draft.value) || 0, source: draft.source } });
      await reloadLeads();
    } catch (err) {
      setErrorMsg(err.message);
    }
    setDraft({ name: "", contact: "", value: "", source: SOURCES[0] });
    setShowForm(false);
  }

  async function logActivity(id) {
    if (!noteDraft.trim()) return;
    const text = noteDraft.trim();
    setNoteDraft("");
    try {
      await postWrite("add_activity", { activity: { lead_id: id, text } });
      await Promise.all([reloadLeads(), loadActivities(id, true)]);
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

  async function bulkMove(stage) {
    if (!stage) return;
    const ids = [...selectedRows];
    setLeads((prev) => prev.map((l) => (selectedRows.has(l.id) ? { ...l, stage } : l)));
    setSelectedRows(new Set());
    try {
      for (const id of ids) await postWrite("update_lead", { id, fields: { stage } });
    } catch (e) {
      setErrorMsg(e.message);
    }
    reloadLeads();
  }

  async function bulkRemove() {
    if (inFlightRef.current.has("bulkRemove")) return;
    inFlightRef.current.add("bulkRemove");
    const ids = [...selectedRows];
    setLeads((prev) => prev.filter((l) => !selectedRows.has(l.id)));
    setSelectedRows(new Set());
    try {
      for (const id of ids) await postWrite("delete_lead", { id });
    } catch (e) {
      setErrorMsg(e.message);
    }
    inFlightRef.current.delete("bulkRemove");
    reloadLeads();
  }

  function deleteLead(id) {
    if (inFlightRef.current.has(`delete:${id}`)) return;
    inFlightRef.current.add(`delete:${id}`);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelectedId(null);
    setConfirmDeleteId(null);
    postWrite("delete_lead", { id })
      .catch((e) => {
        setErrorMsg(e.message);
        reloadLeads();
      })
      .finally(() => inFlightRef.current.delete(`delete:${id}`));
  }

  return (
    <div className="crm">
      {leadsError && (
        <div className="banner banner-error">Erro ao carregar os leads: {leadsError}</div>
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
          <p>
            {loadingLeads ? "Carregando…" : `${totals.count} leads · ${currency(totals.totalValue)} em pipeline · ${totals.won} ganhos`}
            {isAdmin && <span className="admin-badge">admin</span>}
          </p>
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
        {isAdmin && ownerOptions.length > 0 && (
          <select className="owner-filter" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="all">Ver leads de: todo mundo</option>
            {ownerOptions.map((o) => <option key={o.email} value={o.email}>{o.name}</option>)}
          </select>
        )}
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

      <div className="tag-toolbar">
        <div className="tag-chips">
          {tags.map((t) => (
            <button
              key={t.id}
              className={tagFilter.has(t.id) ? "tag-chip active" : "tag-chip"}
              style={tagFilter.has(t.id) ? { background: t.color, borderColor: t.color, color: "#fff" } : { borderColor: t.color, color: t.color }}
              onClick={() => toggleTagFilter(t.id)}
            >
              {t.name}
            </button>
          ))}
          {tagFilter.size > 0 && (
            <button className="tag-clear" onClick={() => setTagFilter(new Set())}>Limpar filtro de tags</button>
          )}
        </div>
        <button className="ghost-btn tag-manage-btn" onClick={() => setShowTagMaker(true)}>+ Gerenciar tags</button>
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
                        onClick={() => openLead(lead.id)}
                      >
                        <div className="lead-card-top">
                          <span className="avatar-sm" style={{ borderColor: ownerColor(lead.ownerEmail) }}>{initials(lead.contact)}</span>
                          <strong>{lead.name}</strong>
                        </div>
                        <p className="lead-contact">{lead.contact}</p>
                        {lead.tagIds && lead.tagIds.length > 0 && (
                          <div className="lead-tags">
                            {lead.tagIds.map((tid) => tagsById[tid] && (
                              <span key={tid} className="lead-tag-chip" style={{ background: tagsById[tid].color }}>{tagsById[tid].name}</span>
                            ))}
                          </div>
                        )}
                        <div className="lead-meta">
                          <span>{currency(lead.value)}</span>
                          <span className="tag">{lead.source}</span>
                        </div>
                        <div className="lead-foot">
                          <span className="health" style={{ color: health.color }}>
                            <span className="health-dot" style={{ background: health.color }} />
                            {health.label}
                          </span>
                          <span className="owner-chip" style={{ color: ownerColor(lead.ownerEmail) }}>{ownerLabel(lead.ownerEmail)}</span>
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
                  {[["name", "Cliente"], ["contact", "Contato"], ["stage", "Estágio"], ["value", "Valor"], ["source", "Origem"], ["daysAgo", "Último contato"], ["ownerEmail", "Dono"]].map(([key, label]) => (
                    <th key={key} onClick={() => toggleSort(key)}>
                      {label} {sort.key === key ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                    </th>
                  ))}
                  <th className="th-tags">Tags</th>
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
                      <td className="clickable" onClick={() => openLead(lead.id)}><strong>{lead.name}</strong></td>
                      <td className="clickable" onClick={() => openLead(lead.id)}>{lead.contact}</td>
                      <td className="clickable" onClick={() => openLead(lead.id)}>
                        <span className="badge"><span className="badge-dot" style={{ background: stage.dot }} />{stage.label}</span>
                      </td>
                      <td className="clickable" onClick={() => openLead(lead.id)}>{currency(lead.value)}</td>
                      <td className="clickable" onClick={() => openLead(lead.id)}>{lead.source}</td>
                      <td className="clickable" onClick={() => openLead(lead.id)}>
                        <span className="health" style={{ color: health.color }}>
                          <span className="health-dot" style={{ background: health.color }} />
                          {daysAgoLabel(lead.daysAgo)}
                        </span>
                      </td>
                      <td className="clickable" onClick={() => openLead(lead.id)}>
                        <span className="owner-chip" style={{ color: ownerColor(lead.ownerEmail) }}>{ownerLabel(lead.ownerEmail)}</span>
                      </td>
                      <td className="clickable" onClick={() => openLead(lead.id)}>
                        <div className="table-tags">
                          {(lead.tagIds || []).map((tid) => tagsById[tid] && (
                            <span key={tid} className="lead-tag-chip" style={{ background: tagsById[tid].color }}>{tagsById[tid].name}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedForTable.length === 0 && (
                  <tr><td colSpan={9} className="table-empty">{loadingLeads ? "Carregando…" : "Nenhum lead encontrado."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedLead && (
        <div className="drawer-overlay" onClick={() => setSelectedId(null)}>
          <div className="drawer" key={selectedLead.id} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div className="drawer-head-text">
                <input
                  className="drawer-name-input"
                  defaultValue={selectedLead.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== selectedLead.name && updateLeadField(selectedLead.id, "name", "name", e.target.value.trim())}
                />
                <input
                  className="drawer-contact-input"
                  defaultValue={selectedLead.contact}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== selectedLead.contact && updateLeadField(selectedLead.id, "contact", "contact", e.target.value.trim())}
                />
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
                <input
                  type="number"
                  className="drawer-input"
                  defaultValue={selectedLead.value}
                  onBlur={(e) => {
                    const n = Number(e.target.value) || 0;
                    if (n !== selectedLead.value) updateLeadField(selectedLead.id, "value", "value", n);
                  }}
                />
              </div>
              <div>
                <label>Origem</label>
                <select value={selectedLead.source} onChange={(e) => updateLeadField(selectedLead.id, "source", "source", e.target.value)}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>Dono</label>
                {!isAdmin ? (
                  <div className="drawer-static owner-chip" style={{ color: ownerColor(selectedLead.ownerEmail) }}>{ownerLabel(selectedLead.ownerEmail)}</div>
                ) : ownerOptions.length > 0 ? (
                  <select value={selectedLead.ownerEmail || ""} onChange={(e) => reassignOwner(selectedLead.id, e.target.value)}>
                    {ownerOptions.map((o) => <option key={o.email} value={o.email}>{o.name}</option>)}
                  </select>
                ) : (
                  <input
                    className="drawer-input"
                    placeholder="e-mail do novo dono"
                    defaultValue={selectedLead.ownerEmail || ""}
                    onBlur={(e) => e.target.value !== selectedLead.ownerEmail && reassignOwner(selectedLead.id, e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="drawer-tags-section">
              <label>Tags</label>
              <div className="drawer-tags">
                {tags.length === 0 && <p className="timeline-empty">Nenhuma tag criada ainda.</p>}
                {tags.map((t) => {
                  const active = (selectedLead.tagIds || []).includes(t.id);
                  return (
                    <button
                      key={t.id}
                      className={active ? "lead-tag-chip toggle active" : "lead-tag-chip toggle"}
                      style={active ? { background: t.color } : { background: "#fff", border: `1px solid ${t.color}`, color: t.color }}
                      onClick={() => toggleLeadTag(selectedLead, t.id)}
                    >
                      {t.name}
                    </button>
                  );
                })}
                <button className="tag-manage-inline" onClick={() => setShowTagMaker(true)}>+ Nova tag</button>
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
              {loadingActivities && selectedNotes.length === 0 ? (
                <p className="timeline-empty">Carregando…</p>
              ) : activitiesError ? (
                <p className="timeline-empty">{activitiesError}</p>
              ) : selectedNotes.length === 0 ? (
                <p className="timeline-empty">Nenhuma interação registrada ainda.</p>
              ) : (
                <ul>
                  {selectedNotes.map((n, i) => (
                    <li key={i}>
                      <span className="timeline-dot" />
                      <div>
                        <span className="timeline-date">{n.date}{n.createdBy ? ` · ${n.createdBy}` : ""}</span>
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

      {showTagMaker && (
        <div className="confirm-overlay" onClick={() => setShowTagMaker(false)}>
          <div className="tagmaker-card" onClick={(e) => e.stopPropagation()}>
            <div className="tagmaker-head">
              <h3>Gerenciar tags</h3>
              <button className="drawer-close" onClick={() => setShowTagMaker(false)}>✕</button>
            </div>
            <p className="tagmaker-sub">Tags ficam salvas pra todo mundo que usa esse CRM ver e usar.</p>

            <div className="tagmaker-list">
              {tags.length === 0 && <p className="timeline-empty">Nenhuma tag criada ainda.</p>}
              {tags.map((t) => (
                <div key={t.id} className="tagmaker-row">
                  <span className="lead-tag-chip" style={{ background: t.color }}>{t.name}</span>
                  <button className="tagmaker-delete" onClick={() => deleteTag(t.id)} title="Excluir tag">🗑</button>
                </div>
              ))}
            </div>

            <form className="tagmaker-form" onSubmit={createTag}>
              <label>Nova tag</label>
              <input placeholder="Nome da tag" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
              <div className="tagmaker-swatches">
                {TAG_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={newTagColor === c ? "swatch active" : "swatch"}
                    style={{ background: c }}
                    onClick={() => setNewTagColor(c)}
                  />
                ))}
              </div>
              <button className="primary-btn" type="submit">Criar tag</button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .crm {
          --bg: #fafafa; --card: #ffffff; --ink: #131314; --ink-soft: #75757a; --ink-faint: #a9a9ae;
          --line: #e7e7e9; --accent: #2b2b2d; --green: #4a4a4d; --green-soft: #ececec; --red: #131314; --sand: #f2f2f0;
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
        .crm-top p { margin: 0; color: var(--ink-soft); font-size: 13px; display: flex; align-items: center; gap: 8px; }
        .admin-badge { background: var(--ink); color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; padding: 2px 8px; border-radius: 20px; }

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

        .segments { display: flex; gap: 6px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
        .segment { background: var(--card); border: 1px solid var(--line); color: var(--ink-soft); font-size: 12.5px; font-weight: 600; padding: 6px 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px; }
        .segment.active { background: var(--ink); border-color: var(--ink); color: #fff; }
        .segment-count { background: var(--red); color: #fff; font-size: 10px; font-weight: 700; border-radius: 20px; padding: 1px 6px; }
        .segment.active .segment-count { background: rgba(255,255,255,.25); }
        .owner-filter { margin-left: auto; border: 1px solid var(--line); border-radius: 20px; padding: 6px 12px; font-size: 12.5px; color: var(--ink-soft); background: var(--card); }

        .crm-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .search { flex: 1; min-width: 220px; max-width: 320px; border: 1px solid var(--line); border-radius: 8px; padding: 8px 11px; font-size: 13px; background: var(--card); color: var(--ink); }
        .stage-chips { display: flex; gap: 6px; flex-wrap: wrap; }

        .tag-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .tag-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .tag-chip { background: #fff; border: 1.5px solid var(--line); font-size: 11.5px; font-weight: 600; padding: 5px 11px; border-radius: 20px; }
        .tag-chip.active { border-width: 1.5px; }
        .tag-clear { background: none; border: none; color: var(--ink-faint); font-size: 11.5px; text-decoration: underline; }
        .tag-manage-btn { white-space: nowrap; }

        .lead-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
        .lead-tag-chip { display: inline-flex; color: #fff; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
        .lead-tag-chip.toggle { cursor: pointer; border: none; }
        .table-tags { display: flex; flex-wrap: wrap; gap: 4px; max-width: 220px; }
        .th-tags { cursor: default; }
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
        tr.row-selected { background: #f0f0f0; }
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

        .tagmaker-card { background: var(--card); border-radius: 12px; padding: 22px; max-width: 380px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
        .tagmaker-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .tagmaker-head h3 { font-size: 16px; margin: 0; color: var(--ink); }
        .tagmaker-sub { font-size: 12px; color: var(--ink-faint); margin: 0 0 16px; }
        .tagmaker-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; max-height: 220px; overflow-y: auto; }
        .tagmaker-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .tagmaker-delete { background: var(--sand); border: none; width: 24px; height: 24px; border-radius: 6px; font-size: 11px; color: var(--ink-faint); flex-shrink: 0; }
        .tagmaker-delete:hover { background: var(--red-soft, #f0d8d8); color: var(--red); }
        .tagmaker-form { border-top: 1px solid var(--line); padding-top: 16px; display: flex; flex-direction: column; gap: 10px; }
        .tagmaker-form label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; color: var(--ink-faint); font-weight: 600; }
        .tagmaker-form input { border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; font-size: 13px; font-family: inherit; }
        .tagmaker-swatches { display: flex; flex-wrap: wrap; gap: 8px; }
        .swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
        .swatch.active { border-color: var(--ink); box-shadow: 0 0 0 2px #fff inset; }
        .drawer { width: 380px; max-width: 92vw; height: 100%; background: var(--card); border-left: 1px solid var(--line); padding: 22px; overflow-y: auto; }
        .drawer-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
        .drawer-head-text { flex: 1; min-width: 0; }
        .drawer-name-input {
          display: block; width: 100%; font-size: 17px; font-weight: 700; color: var(--ink);
          border: 1px solid transparent; border-radius: 6px; padding: 3px 5px; margin: 0 0 2px -5px;
          background: none; font-family: inherit;
        }
        .drawer-name-input:hover, .drawer-name-input:focus { border-color: var(--line); background: var(--sand); outline: none; }
        .drawer-contact-input {
          display: block; width: 100%; font-size: 12.5px; color: var(--ink-soft);
          border: 1px solid transparent; border-radius: 6px; padding: 2px 5px; margin-left: -5px;
          background: none; font-family: inherit;
        }
        .drawer-contact-input:hover, .drawer-contact-input:focus { border-color: var(--line); background: var(--sand); outline: none; }
        .drawer-head-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .drawer-close { background: var(--sand); border: none; width: 26px; height: 26px; border-radius: 7px; font-size: 12px; color: var(--ink-soft); flex-shrink: 0; }
        .drawer-close:hover { background: var(--line); }
        .drawer-delete { background: var(--sand); border: none; width: 26px; height: 26px; border-radius: 7px; font-size: 12px; color: var(--red); flex-shrink: 0; }
        .drawer-delete:hover { background: var(--red-soft, #f7e2dd); }

        .drawer-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .drawer-fields label { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; color: var(--ink-faint); margin-bottom: 4px; font-weight: 600; }
        .drawer-fields select { width: 100%; border: 1px solid var(--line); border-radius: 7px; padding: 7px 8px; font-size: 12.5px; background: #fff; }
        .drawer-input { width: 100%; border: 1px solid var(--line); border-radius: 7px; padding: 7px 8px; font-size: 12.5px; background: #fff; font-family: inherit; color: var(--ink); }

        .drawer-tags-section { margin-bottom: 16px; }
        .drawer-tags-section label { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; color: var(--ink-faint); margin-bottom: 7px; font-weight: 600; }
        .drawer-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        .tag-manage-inline { background: none; border: 1px dashed var(--line); color: var(--ink-faint); font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
        .tag-manage-inline:hover { color: var(--ink); border-color: var(--ink-faint); }
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
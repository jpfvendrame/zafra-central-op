import { useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------
   Zafra · AI Agents
   Cada agente agora suporta múltiplas conversas separadas
   (igual Claude/ChatGPT) — uma barra lateral lista as conversas
   passadas, com "+ Nova conversa" pra começar do zero.

   Webhooks n8n usados:
   - list_conversations: { token, agent_id } → { sucesso, conversations }
   - agent_history:      { token, conversation_id } → { sucesso, messages }
   - agent_send:         { token, agent_id, conversation_id, text }
                         → { sucesso, reply, conversation_id }
                         (conversation_id null/ausente = cria uma conversa nova)
--------------------------------------------------------- */

const LIST_CONVERSATIONS_URL = "https://n8n-n8n.yypjz6.easypanel.host/webhook/list_conversations";
const LIST_CONFIGURED = !LIST_CONVERSATIONS_URL.startsWith("COLE_");

const HISTORY_WEBHOOK_URL = "https://n8n-n8n.yypjz6.easypanel.host/webhook/agent_history";
const HISTORY_CONFIGURED = !HISTORY_WEBHOOK_URL.startsWith("COLE_");

const SEND_WEBHOOK_URL = "https://n8n-n8n.yypjz6.easypanel.host/webhook/agent_send";
const SEND_CONFIGURED = !SEND_WEBHOOK_URL.startsWith("COLE_");

const NEW_KEY = "__new__"; // chave local pra uma conversa ainda não salva (antes da primeira mensagem)

const PLACEHOLDER_AGENTS = [
  { id: "a1", name: "Agente 1", description: "Ainda não configurado." },
  { id: "a2", name: "Agente 2", description: "Ainda não configurado." },
  { id: "a3", name: "Agente 3", description: "Ainda não configurado." },
];

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Formatador leve de markdown — sem lib externa, cobre o que os agentes
 * costumam mandar: **negrito**, *itálico*, `código`, listas numeradas e
 * com marcador. Não é um parser completo, só o suficiente pra não mostrar
 * asteriscos/números crus na tela. */
function renderInline(text, keyPrefix) {
  const nodes = [];
  let remaining = text;
  let key = 0;
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/;
  while (remaining) {
    const match = remaining.match(regex);
    if (!match) { nodes.push(remaining); break; }
    const idx = match.index;
    if (idx > 0) nodes.push(remaining.slice(0, idx));
    if (match[2] !== undefined) nodes.push(<strong key={`${keyPrefix}-${key++}`}>{match[2]}</strong>);
    else if (match[3] !== undefined) nodes.push(<em key={`${keyPrefix}-${key++}`}>{match[3]}</em>);
    else if (match[4] !== undefined) nodes.push(<code key={`${keyPrefix}-${key++}`}>{match[4]}</code>);
    remaining = remaining.slice(idx + match[0].length);
  }
  return nodes;
}

function renderMarkdownLite(text) {
  if (!text) return null;
  const str = String(text);
  // Alguns agentes mandam a lista numerada "grudada" no mesmo parágrafo,
  // sem quebra de linha — isso força cada "N. " a começar um item novo.
  const segments = str.split(/(?=\d+\.\s+(?:\*\*|[A-ZÀ-Ü]))/);
  const raw = [];
  segments.forEach((seg) => {
    const listMatch = seg.match(/^(\d+)\.\s+([\s\S]*)$/);
    if (listMatch) {
      raw.push({ type: "li", content: listMatch[2].trim() });
      return;
    }
    seg.split("\n").forEach((line) => {
      const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
      if (bulletMatch) raw.push({ type: "bullet", content: bulletMatch[1].trim() });
      else if (line.trim()) raw.push({ type: "p", content: line.trim() });
    });
  });

  const blocks = [];
  let current = null;
  raw.forEach((b) => {
    if (b.type === "li" || b.type === "bullet") {
      const tag = b.type === "li" ? "ol" : "ul";
      if (!current || current.type !== tag) { current = { type: tag, items: [] }; blocks.push(current); }
      current.items.push(b.content);
    } else {
      current = null;
      blocks.push(b);
    }
  });

  return blocks.map((b, i) => {
    if (b.type === "ol") return <ol key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it, `${i}-${j}`)}</li>)}</ol>;
    if (b.type === "ul") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it, `${i}-${j}`)}</li>)}</ul>;
    return <p key={i}>{renderInline(b.content, `${i}`)}</p>;
  });
}

function formatHistoryTime(raw) {
  const d = new Date(raw);
  return isNaN(d) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function formatRelative(raw) {
  const d = new Date(raw);
  if (isNaN(d)) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Resposta simulada — usada só quando SEND_WEBHOOK_URL não está configurada. */
async function respondFor(agent, userText) {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
  return `Isso ainda é uma resposta simulada do ${agent.name} — nenhum agente de verdade está conectado ainda. Você disse: "${userText}"`;
}

export default function AIAgentsPage({ token }) {
  const [agents] = useState(PLACEHOLDER_AGENTS);
  const [openAgentId, setOpenAgentId] = useState(null);

  const [agentConversations, setAgentConversations] = useState({}); // { [agentId]: [{id,title,updated_at}] }
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [conversationsError, setConversationsError] = useState(null);

  const [activeConversationId, setActiveConversationId] = useState(null); // null = nova conversa
  const [messagesByConversation, setMessagesByConversation] = useState({}); // { [conversationId]: [{role,text,time}] }
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const scrollRef = useRef(null);

  const openAgent = agents.find((a) => a.id === openAgentId) || null;
  const convKey = activeConversationId || NEW_KEY;
  const messages = messagesByConversation[convKey] || [];
  const conversationList = openAgentId ? (agentConversations[openAgentId] || []) : [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  function appendMessage(key, msg) {
    setMessagesByConversation((prev) => ({ ...prev, [key]: [...(prev[key] || []), msg] }));
  }

  async function loadConversationMessages(conversationId) {
    if (!conversationId || messagesByConversation[conversationId] || !HISTORY_CONFIGURED || !token) return;
    setLoadingMessages(true);
    setMessagesError(null);
    try {
      const res = await fetch(HISTORY_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, conversation_id: conversationId }),
      });
      const data = await res.json();
      if (data.sucesso) {
        const history = (data.messages || []).map((m) => ({ role: m.role, text: m.text, time: formatHistoryTime(m.created_at) }));
        setMessagesByConversation((prev) => ({ ...prev, [conversationId]: history }));
      } else {
        setMessagesError(data.error || "Não consegui carregar essa conversa.");
      }
    } catch (err) {
      setMessagesError("Não consegui falar com o servidor de histórico.");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function openAgentChat(agentId) {
    setOpenAgentId(agentId);
    setActiveConversationId(null);
    setConversationsError(null);
    if (agentConversations[agentId] || !LIST_CONFIGURED || !token) return;
    setLoadingConversations(true);
    try {
      const res = await fetch(LIST_CONVERSATIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, agent_id: agentId }),
      });
      const data = await res.json();
      if (data.sucesso) {
        const list = data.conversations || [];
        setAgentConversations((prev) => ({ ...prev, [agentId]: list }));
        if (list.length > 0) {
          setActiveConversationId(list[0].id);
          loadConversationMessages(list[0].id);
        }
      } else {
        setConversationsError(data.error || "Não consegui carregar suas conversas.");
      }
    } catch (err) {
      setConversationsError("Não consegui falar com o servidor de conversas.");
    } finally {
      setLoadingConversations(false);
    }
  }

  function selectConversation(id) {
    setActiveConversationId(id);
    loadConversationMessages(id);
  }

  function startNewConversation() {
    setActiveConversationId(null);
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !openAgent || sendingRef.current) return;
    sendingRef.current = true;
    setDraft("");
    const wasNew = !activeConversationId;
    const key = activeConversationId || NEW_KEY;
    appendMessage(key, { role: "user", text, time: nowLabel() });
    setSending(true);
    try {
      let reply;
      let newConvId = activeConversationId;
      if (SEND_CONFIGURED && token) {
        const res = await fetch(SEND_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, agent_id: openAgent.id, conversation_id: activeConversationId, text }),
        });
        const data = await res.json();
        if (data.sucesso) {
          reply = data.reply;
          newConvId = data.conversation_id || activeConversationId;
        } else {
          reply = `Erro: ${data.error || "não consegui salvar essa mensagem."}`;
        }
      } else {
        reply = await respondFor(openAgent, text);
      }
      appendMessage(key, { role: "agent", text: reply, time: nowLabel() });

      if (wasNew && newConvId) {
        setMessagesByConversation((prev) => {
          const next = { ...prev };
          next[newConvId] = next[NEW_KEY] || [];
          delete next[NEW_KEY];
          return next;
        });
        setActiveConversationId(newConvId);
        setAgentConversations((prev) => {
          const list = prev[openAgent.id] || [];
          const title = text.length > 40 ? text.slice(0, 40) + "…" : text;
          return { ...prev, [openAgent.id]: [{ id: newConvId, title, updated_at: new Date().toISOString() }, ...list] };
        });
      }
    } catch (err) {
      appendMessage(key, { role: "agent", text: "Não consegui falar com o servidor agora.", time: nowLabel() });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (openAgent) {
    return (
      <div className="agents">
        <div className="chat-shell">
          <aside className="conv-sidebar">
            <button className="conv-new" onClick={startNewConversation}>+ Nova conversa</button>
            <div className="conv-list">
              {loadingConversations && <p className="conv-hint">Carregando…</p>}
              {conversationsError && <p className="conv-hint error">{conversationsError}</p>}
              {!loadingConversations && conversationList.length === 0 && !conversationsError && (
                <p className="conv-hint">Nenhuma conversa ainda.</p>
              )}
              {conversationList.map((c) => (
                <button
                  key={c.id}
                  className={c.id === activeConversationId ? "conv-item active" : "conv-item"}
                  onClick={() => selectConversation(c.id)}
                >
                  <span className="conv-item-title">{c.title || "Conversa sem título"}</span>
                  <span className="conv-item-time">{formatRelative(c.updated_at)}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="chat-main">
            <header className="chat-head">
              <button className="chat-back" onClick={() => setOpenAgentId(null)}>← Voltar</button>
              <div className="chat-head-info">
                <span className="agent-icon">✦</span>
                <div>
                  <h2>{openAgent.name}</h2>
                  <span className="chat-status">{sending ? "digitando…" : "online"}</span>
                </div>
              </div>
            </header>

            <div className="chat-messages" ref={scrollRef}>
              {loadingMessages && <div className="chat-empty"><p>Carregando conversa…</p></div>}
              {messagesError && <div className="chat-history-error">{messagesError}</div>}
              {!loadingMessages && messages.length === 0 && (
                <div className="chat-empty">
                  <p>{activeConversationId ? "Essa conversa ainda não tem mensagens." : `Comece uma conversa nova com ${openAgent.name}.`}</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`bubble-row ${m.role}`}>
                  <div className="bubble">
                    {m.role === "agent" ? <div className="bubble-md">{renderMarkdownLite(m.text)}</div> : m.text}
                    <span className="bubble-time">{m.time}</span>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="bubble-row agent">
                  <div className="bubble typing">
                    <span className="dot" /><span className="dot" /><span className="dot" />
                  </div>
                </div>
              )}
            </div>

            <form className="chat-input" onSubmit={handleSend}>
              <input
                placeholder={`Mensagem para ${openAgent.name}…`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <button type="submit" className="primary-btn" disabled={!draft.trim() || sending}>Enviar</button>
            </form>
          </div>
        </div>

        <style>{`${SHARED_STYLES}`}</style>
      </div>
    );
  }

  return (
    <div className="agents">
      <header className="agents-top">
        <div>
          <h1>AI Agents</h1>
          <p>Clique num agente pra abrir o chat com ele.</p>
        </div>
        <button className="primary-btn" disabled title="Em breve">+ Novo agente</button>
      </header>

      <div className="agents-grid">
        {agents.map((agent) => (
          <button key={agent.id} className="agent-card" onClick={() => openAgentChat(agent.id)}>
            <div className="agent-card-top">
              <span className="agent-icon">✦</span>
              <span className="agent-status">{(agentConversations[agent.id]?.length || 0) > 0 ? "Conversas salvas" : "Em breve"}</span>
            </div>
            <h3>{agent.name}</h3>
            <p>{agent.description}</p>
            <span className="agent-open-hint">Abrir chat →</span>
          </button>
        ))}
      </div>

      <style>{`${SHARED_STYLES}`}</style>
    </div>
  );
}

const SHARED_STYLES = `
  .agents {
    --bg: #fafafa; --card: #ffffff; --ink: #131314; --ink-soft: #75757a; --ink-faint: #a9a9ae;
    --line: #e7e7e9; --sand: #f2f2f0;
    color: var(--ink); font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif; font-size: 14px;
  }
  .theme-dark .agents {
    --bg: #0f0f11; --card: #19191c; --ink: #f2f2f0; --ink-soft: #a9a9ae; --ink-faint: #6f6f74;
    --line: #2a2a2e; --sand: #202024;
  }
  .agents * { box-sizing: border-box; }
  .agents button { font-family: inherit; cursor: pointer; }

  .agents-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
  .agents-top h1 { font-size: 22px; margin: 0 0 3px; font-weight: 700; letter-spacing: -0.3px; color: var(--ink); }
  .agents-top p { margin: 0; color: var(--ink-soft); font-size: 13px; }

  .primary-btn { background: var(--ink); color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; }
  .primary-btn:disabled { opacity: .45; cursor: not-allowed; }

  .agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
  .agent-card { text-align: left; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 4px; }
  .agent-card:hover { border-color: var(--ink-faint); box-shadow: 0 2px 10px rgba(0,0,0,.05); }
  .agent-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .agent-icon { width: 38px; height: 38px; border-radius: 50%; background: var(--sand); display: flex; align-items: center; justify-content: center; font-size: 16px; color: var(--ink); flex-shrink: 0; }
  .agent-status { font-size: 10.5px; font-weight: 600; color: var(--ink-faint); border: 1px solid var(--line); padding: 3px 9px; border-radius: 20px; white-space: nowrap; }
  .agent-card h3 { font-size: 15px; margin: 4px 0 2px; font-weight: 700; }
  .agent-card p { font-size: 12.5px; color: var(--ink-faint); margin: 0 0 12px; }
  .agent-open-hint { font-size: 12px; font-weight: 600; color: var(--ink); }

  /* Chat shell: sidebar + chat lado a lado */
  .chat-shell { display: flex; height: calc(100vh - 56px); max-height: 760px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }

  .conv-sidebar { width: 220px; flex-shrink: 0; border-right: 1px solid var(--line); background: var(--sand); display: flex; flex-direction: column; padding: 12px; gap: 10px; overflow-y: auto; }
  .conv-new { background: var(--ink); color: #fff; border: none; padding: 9px; border-radius: 8px; font-size: 12.5px; font-weight: 600; }
  .conv-new:hover { background: #2a2a2c; }
  .conv-list { display: flex; flex-direction: column; gap: 3px; }
  .conv-hint { font-size: 11.5px; color: var(--ink-faint); padding: 6px 4px; margin: 0; }
  .conv-hint.error { color: #b3402f; }
  .conv-item { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; background: none; border: none; text-align: left; padding: 8px 9px; border-radius: 7px; }
  .conv-item:hover { background: rgba(0,0,0,.04); }
  .conv-item.active { background: var(--card); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .conv-item-title { font-size: 12.5px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px; }
  .conv-item-time { font-size: 10.5px; color: var(--ink-faint); }

  .chat-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .chat-head { display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-bottom: 1px solid var(--line); }
  .chat-back { background: var(--sand); border: none; color: var(--ink-soft); font-size: 12.5px; font-weight: 600; padding: 7px 12px; border-radius: 7px; }
  .chat-back:hover { background: var(--line); }
  .chat-head-info { display: flex; align-items: center; gap: 10px; }
  .chat-head-info h2 { font-size: 15px; margin: 0; }
  .chat-status { font-size: 11px; color: var(--ink-faint); }

  .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
  .chat-empty { margin: auto; text-align: center; color: var(--ink-faint); font-size: 13px; }
  .chat-history-error { text-align: center; color: #b3402f; font-size: 12.5px; background: #f7e2dd; border-radius: 8px; padding: 8px 12px; margin: 0 auto; }
  .bubble-row { display: flex; }
  .bubble-row.user { justify-content: flex-end; }
  .bubble-row.agent { justify-content: flex-start; }
  .bubble { max-width: 70%; padding: 10px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.45; position: relative; }
  .bubble-row.user .bubble { background: var(--ink); color: #fff; border-bottom-right-radius: 4px; }
  .bubble-row.agent .bubble { background: var(--sand); color: var(--ink); border-bottom-left-radius: 4px; }
  .bubble-time { display: block; font-size: 10px; opacity: .55; margin-top: 4px; }
  .bubble-md p { margin: 0 0 8px; }
  .bubble-md p:last-child { margin-bottom: 0; }
  .bubble-md ol, .bubble-md ul { margin: 0 0 8px; padding-left: 20px; }
  .bubble-md ol:last-child, .bubble-md ul:last-child { margin-bottom: 0; }
  .bubble-md li { margin-bottom: 4px; }
  .bubble-md li:last-child { margin-bottom: 0; }
  .bubble-md strong { font-weight: 700; }
  .bubble-md code { background: rgba(0,0,0,.08); border-radius: 4px; padding: 1px 5px; font-size: 12px; font-family: ui-monospace, monospace; }
  .bubble.typing { display: flex; gap: 4px; align-items: center; padding: 14px; }
  .bubble.typing .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-faint); animation: typing-bounce 1.2s infinite; }
  .bubble.typing .dot:nth-child(2) { animation-delay: .15s; }
  .bubble.typing .dot:nth-child(3) { animation-delay: .3s; }
  @keyframes typing-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }

  .chat-input { display: flex; gap: 8px; padding: 14px 18px; border-top: 1px solid var(--line); }
  .chat-input input { flex: 1; border: 1px solid var(--line); border-radius: 8px; padding: 10px 13px; font-size: 13.5px; font-family: inherit; }
  .chat-input .primary-btn:disabled { opacity: .4; }

  @media (max-width: 720px) {
    .conv-sidebar { display: none; }
  }
`;
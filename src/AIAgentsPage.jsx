import { useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------
   Zafra · AI Agents
   Esboço: grade de agentes → clicar abre um chat dedicado
   pra aquele agente, carregando o histórico real do n8n
   (webhook agent_history). O ENVIO de mensagem ainda é
   simulado (ver respondFor()) — isso muda quando o webhook
   de envio (agent_send, ou nome que você escolher) estiver
   pronto, aí a mensagem enviada e a resposta passam a ser
   salvas de verdade também.
--------------------------------------------------------- */

const HISTORY_WEBHOOK_URL = "https://n8n-n8n.yypjz6.easypanel.host/webhook/agent_history";
const HISTORY_CONFIGURED = !HISTORY_WEBHOOK_URL.startsWith("COLE_");

const SEND_WEBHOOK_URL = "https://n8n-n8n.yypjz6.easypanel.host/webhook/agent_send";
const SEND_CONFIGURED = !SEND_WEBHOOK_URL.startsWith("COLE_");

const PLACEHOLDER_AGENTS = [
  { id: "a1", name: "Agente 1", description: "Ainda não configurado." },
  { id: "a2", name: "Agente 2", description: "Ainda não configurado." },
  { id: "a3", name: "Agente 3", description: "Ainda não configurado." },
];

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatHistoryTime(raw) {
  const d = new Date(raw);
  return isNaN(d) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Resposta simulada — troca isso por uma chamada real quando o webhook de envio estiver pronto. */
async function respondFor(agent, userText) {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
  return `Isso ainda é uma resposta simulada do ${agent.name} — nenhum agente de verdade está conectado ainda. Você disse: "${userText}"`;
}

export default function AIAgentsPage({ token, userEmail }) {
  const [agents] = useState(PLACEHOLDER_AGENTS);
  const [openAgentId, setOpenAgentId] = useState(null);
  const [conversations, setConversations] = useState({}); // { [agentId]: [{role, text, time}] }
  const [loadedAgents, setLoadedAgents] = useState(new Set());
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const sendingRef = useRef(false); // trava síncrona, não depende de re-render como o state "sending"

  const openAgent = agents.find((a) => a.id === openAgentId) || null;
  const messages = openAgentId ? (conversations[openAgentId] || []) : [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  function appendMessage(agentId, msg) {
    setConversations((prev) => ({ ...prev, [agentId]: [...(prev[agentId] || []), msg] }));
  }

  async function openAgentChat(agentId) {
    setOpenAgentId(agentId);
    setHistoryError(null);
    // Só busca o histórico da primeira vez que esse agente é aberto nesta
    // sessão — evita sobrescrever mensagens já trocadas localmente.
    if (loadedAgents.has(agentId) || !HISTORY_CONFIGURED || !token) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(HISTORY_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, agent_id: agentId }),
      });
      const data = await res.json();
      if (data.sucesso) {
        const history = (data.messages || []).map((m) => ({
          role: m.role,
          text: m.text,
          time: formatHistoryTime(m.created_at),
        }));
        setConversations((prev) => ({ ...prev, [agentId]: history }));
      } else {
        setHistoryError(data.error || "Não consegui carregar o histórico.");
      }
    } catch (err) {
      setHistoryError("Não consegui falar com o servidor de histórico.");
    } finally {
      setLoadingHistory(false);
      setLoadedAgents((prev) => new Set(prev).add(agentId));
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !openAgent || sendingRef.current) return;
    sendingRef.current = true;
    setDraft("");
    appendMessage(openAgent.id, { role: "user", text, time: nowLabel() });
    setSending(true);
    try {
      let reply;
      if (SEND_CONFIGURED && token) {
        const res = await fetch(SEND_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, agent_id: openAgent.id, text }),
        });
        const data = await res.json();
        reply = data.sucesso ? data.reply : `Erro: ${data.error || "não consegui salvar essa mensagem."}`;
      } else {
        reply = await respondFor(openAgent, text);
      }
      appendMessage(openAgent.id, { role: "agent", text: reply, time: nowLabel() });
    } catch (err) {
      appendMessage(openAgent.id, { role: "agent", text: "Não consegui falar com o servidor agora.", time: nowLabel() });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (openAgent) {
    return (
      <div className="agents">
        <div className="chat-shell">
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
            {loadingHistory && <div className="chat-empty"><p>Carregando histórico…</p></div>}
            {historyError && <div className="chat-history-error">{historyError}</div>}
            {!loadingHistory && messages.length === 0 && (
              <div className="chat-empty">
                <p>Comece uma conversa com {openAgent.name}.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`bubble-row ${m.role}`}>
                <div className="bubble">
                  {m.text}
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
              <span className="agent-status">{(conversations[agent.id]?.length || 0) > 0 ? "Conversa iniciada" : "Em breve"}</span>
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

  /* Chat */
  .chat-shell { display: flex; flex-direction: column; height: calc(100vh - 56px); max-height: 760px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
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
  .bubble.typing { display: flex; gap: 4px; align-items: center; padding: 14px; }
  .bubble.typing .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-faint); animation: typing-bounce 1.2s infinite; }
  .bubble.typing .dot:nth-child(2) { animation-delay: .15s; }
  .bubble.typing .dot:nth-child(3) { animation-delay: .3s; }
  @keyframes typing-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }

  .chat-input { display: flex; gap: 8px; padding: 14px 18px; border-top: 1px solid var(--line); }
  .chat-input input { flex: 1; border: 1px solid var(--line); border-radius: 8px; padding: 10px 13px; font-size: 13.5px; font-family: inherit; }
  .chat-input .primary-btn:disabled { opacity: .4; }
`;
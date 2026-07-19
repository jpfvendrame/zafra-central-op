import { Component, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import CRMPage from "./CRMpage";
import Landing from "./Landing";
import AIAgentsPage from "./AIAgentsPage";
import zafraLogo from "./zafra_logo_branca.png";

/* Rede de segurança: se qualquer página (CRM, Reports, etc.) quebrar em
   tempo de execução por causa de um dado inesperado, mostra uma mensagem
   amigável em vez de deixar a tela inteira em branco/preta. */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center", fontFamily: "-apple-system, sans-serif" }}>
          <h2 style={{ fontSize: 17, marginBottom: 8, color: "#131314" }}>Algo deu errado nesta página</h2>
          <p style={{ fontSize: 13, color: "#75757a", marginBottom: 6, lineHeight: 1.5 }}>
            {this.state.error.message || "Erro inesperado."}
          </p>
          <p style={{ fontSize: 12, color: "#a9a9ae", marginBottom: 18 }}>
            Costuma acontecer quando algum dado na planilha está num formato inesperado.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ background: "#131314", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------------------------------------------------------
   Zafra · Operations Center
   Minimalist IDV pass: monochrome surfaces, one restrained
   accent color, no external UI deps — icons are inline SVGs,
   styles are scoped via the <style> block at the bottom of
   this file, so this drops into any Vite + React app as-is.
--------------------------------------------------------- */

/* ---------------- Icons (inline, feather-style) ---------------- */
const Icon = {
  home: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bolt: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  doc: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  ),
  users: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="round" />
      <path d="M16 4.3a3.2 3.2 0 0 1 0 6.2M20.5 20c0-2.8-1.9-4.8-4.5-5.4" strokeLinecap="round" />
    </svg>
  ),
  target: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  ),
  megaphone: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M3 10v4a1 1 0 0 0 1 1h2l7 4V5L6 9H4a1 1 0 0 0-1 1Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
    </svg>
  ),
  puzzle: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M9 3.5h3a1 1 0 0 1 1 1.2 1.4 1.4 0 0 0 2.6.9 1.4 1.4 0 0 1 2.5 1.1V9a1 1 0 0 1-1.2 1 1.4 1.4 0 0 0 0 2.8 1 1 0 0 1 1.2 1v2.7a1 1 0 0 1-1 1h-2.8a1.4 1.4 0 0 0-2.7 0H9a1 1 0 0 1-1-1v-3a1.4 1.4 0 0 0-2.8 0H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1.2a1.4 1.4 0 0 0 0-2.7A1 1 0 0 1 6.2 5H8a1 1 0 0 1 1-1.5Z" strokeLinejoin="round" />
    </svg>
  ),
  workflow: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <rect x="3" y="4" width="5" height="5" rx="1" />
      <rect x="16" y="4" width="5" height="5" rx="1" />
      <rect x="9.5" y="15" width="5" height="5" rx="1" />
      <path d="M5.5 9v3.5a2 2 0 0 0 2 2H9M18.5 9v3.5a2 2 0 0 1-2 2h-1.8" strokeLinecap="round" />
    </svg>
  ),
  list: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M9 6h11M9 12h11M9 18h11" strokeLinecap="round" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  gear: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3" strokeLinecap="round" />
    </svg>
  ),
  pulse: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M3 12h4l2 6 4-14 2 8h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  alert: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3.5 21 19H3L12 3.5Z" strokeLinejoin="round" />
      <path d="M12 9.5v4.2M12 16.8v.2" strokeLinecap="round" />
    </svg>
  ),
  shield: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3.5 19 6v6c0 5-3 8.2-7 9.5-4-1.3-7-4.5-7-9.5V6l7-2.5Z" strokeLinejoin="round" />
      <path d="M12 8.5v4M12 15v.2" strokeLinecap="round" />
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M8 12.3l2.6 2.6L16.3 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="12" cy="12" r="8.7" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrow: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  refresh: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M4 12a8 8 0 0 1 13.6-5.7M20 12a8 8 0 0 1-13.6 5.7" strokeLinecap="round" />
      <path d="M17.5 3.5v3.3h-3.3M6.5 20.5v-3.3h3.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevron: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" strokeLinecap="round" />
    </svg>
  ),
  bell: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M6 10a6 6 0 0 1 12 0v4l1.8 3H4.2L6 14v-4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 19.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  ),
  sparkle: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M12 3.5c.5 3.2 1.3 5 2.6 6.3 1.3 1.3 3.1 2.1 6.3 2.6-3.2.5-5 1.3-6.3 2.6-1.3 1.3-2.1 3.1-2.6 6.3-.5-3.2-1.3-5-2.6-6.3-1.3-1.3-3.1-2.1-6.3-2.6 3.2-.5 5-1.3 6.3-2.6 1.3-1.3 2.1-3.1 2.6-6.3Z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
};

/* ---------------- Static config ---------------- */
const NAV = [
  { id: "home", label: "Home", icon: "home" },
  { id: "crm", label: "CRM", icon: "users" },
  { id: "aiagents", label: "AI Agents", icon: "sparkle" },
  { id: "settings", label: "Settings", icon: "gear" },
];

const SYSTEM_HEALTH = [
  { name: "Report Generator", status: "operational" },
  { name: "CRM Sync", status: "operational" },
  { name: "Lead Capture", status: "operational" },
  { name: "WhatsApp Sender", status: "operational" },
  { name: "Analytics Engine", status: "operational" },
  { name: "Database", status: "operational" },
  { name: "File Storage", status: "operational" },
  { name: "Notification Service", status: "operational" },
];

const INITIAL_REPORTS = [
  { client: "Hotel Aurora", time: "10:42", delivered: true },
  { client: "Ecotur Travel", time: "10:28", delivered: true },
  { client: "Andes Trips", time: "10:15", delivered: true },
  { client: "Blue Sky Tourism", time: "09:57", delivered: true },
  { client: "Lighthouse Hotel", time: "09:41", delivered: true },
  { client: "Grado Dez", time: "09:20", delivered: true },
  { client: "Zerando o Chile", time: "09:05", delivered: true },
];

const PIPELINE = [
  { stage: "Leads", value: 53, icon: "users" },
  { stage: "Contacted", value: 21, icon: "clock" },
  { stage: "Proposal", value: 8, icon: "doc" },
  { stage: "Closing", value: 3, icon: "target" },
  { stage: "Won", value: 2, icon: "check" },
];

const INITIAL_ALERTS = [
  {
    id: "a1",
    title: "Report Delivery Failed",
    client: "Andes Trips",
    lastRun: "09:42",
    error: "Webhook Timeout",
  },
];

const INITIAL_TASKS = [
  { id: "t1", label: "Follow-up with Maria (Eco Travel)", time: "11:00", done: false },
  { id: "t2", label: "Proposal for Hotel Costa Azul", time: "14:00", done: false },
  { id: "t3", label: "Review Q2 Dashboard", time: "15:30", done: false },
  { id: "t4", label: "Approve Campaign — Summer 2024", time: "16:30", done: false },
  { id: "t5", label: "Sync CRM contacts for Grado Dez", time: "17:15", done: false },
];

const INITIAL_ACTIVITY = [
  { time: "10:42", text: "Report generated for Hotel Aurora", tone: "ok" },
  { time: "10:15", text: "New lead captured: Explorer Club", tone: "ok" },
  { time: "09:57", text: "CRM synchronized successfully", tone: "ok" },
  { time: "09:43", text: "Report delivery failed: Andes Trips", tone: "bad" },
  { time: "09:30", text: 'Automation "Daily Reports" executed', tone: "ok" },
];

function todayLabel() {
  return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
}
function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/* ---------------- Small building blocks ---------------- */
function StatCard({ icon, tone, value, label, delta }) {
  return (
    <div className="card stat-card">
      <div className={`stat-icon${tone === "accent" ? " tone-accent" : ""}`}>{Icon[icon]({ width: 22, height: 22 })}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {delta && <div className={`stat-delta${tone === "accent" ? " warn" : ""}`}>{delta}</div>}
      </div>
    </div>
  );
}

function PanelHeader({ icon, title, action, onAction }) {
  return (
    <div className="panel-header">
      <div className="panel-title">
        <span className="panel-icon">{Icon[icon]({ width: 16, height: 16 })}</span>
        <h3>{title}</h3>
      </div>
      {action && (
        <button className="link-btn" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

/* ---------------- Main component ---------------- */
export default function ZafraOperationsCenter() {
  const [user, setUser] = useState({ name: "João", email: "joao.costa@zafra.com" });
  const [loggedIn, setLoggedIn] = useState(false);

  // Reseta o scroll pro topo só DEPOIS que a Landing terminou de sumir da
  // tela (a animação de saída dura 0.45s) — se resetar antes, o scroll
  // forçado mexe na posição que a própria Landing usa pra decidir o que
  // mostrar, e ela "pisca" de volta pro estado de só-o-globo no meio da
  // transição.
  useEffect(() => {
    if (!loggedIn) return;
    const id = setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" }), 480);
    return () => clearTimeout(id);
  }, [loggedIn]);

  const [activeNav, setActiveNav] = useState("home");
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [showAllReports, setShowAllReports] = useState(false);
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [rerunning, setRerunning] = useState(null);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [activity, setActivity] = useState(INITIAL_ACTIVITY);
  const [menuOpen, setMenuOpen] = useState(false);

  const pendingTasks = useMemo(() => tasks.filter((t) => !t.done).length, [tasks]);
  const deliveredReports = reports.filter((r) => r.delivered).length;
  const visibleReports = showAllReports ? reports : reports.slice(0, 5);

  function toggleTask(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function resolveAlert(alert) {
    setRerunning(alert.id);
    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      setActivity((prev) => [
        { time: nowLabel(), text: `Automation re-run succeeded: ${alert.client}`, tone: "ok" },
        ...prev,
      ]);
      setReports((prev) => [{ client: alert.client, time: nowLabel(), delivered: true }, ...prev]);
      setRerunning(null);
    }, 1100);
  }

  const totalDeals = PIPELINE.reduce((sum, s) => sum + s.value, 0);
  const pipelinePct = Math.round(((totalDeals - PIPELINE[0].value) / totalDeals) * 100);
  const criticalErrors = alerts.length;

  // Reseta o scroll pro topo ao logar — sem isso, a página do dashboard
  // "herda" a posição de scroll de onde a Landing parou (lá embaixo, no
  // formulário de login), e parece abrir já rolada pro final.
  function handleLogin(userData) {
    if (userData) setUser(userData);
    setLoggedIn(true);
  }

  return (
    <>
      <style>{`
        html, body, #root {
          width: 100%; min-height: 100vh; margin: 0; padding: 0;
          max-width: none; display: block; text-align: left; color-scheme: light;
          background: #fafafa; color: #131314;
          scrollbar-width: none; /* Firefox */
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; } /* Chrome/Safari/Edge */
      `}</style>
      <AnimatePresence mode="wait">
      {!loggedIn ? (
        <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: "easeInOut" }}>
          <Landing onLogin={handleLogin} />
        </motion.div>
      ) : (
        <motion.div key="dashboard" className="zoc" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
      <aside className="sidebar">
        <div className="brand">
          <img src={zafraLogo} alt="Zafra — marketing para turismo" className="brand-logo" />
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-item${activeNav === item.id ? " active" : ""}`}
              onClick={() => setActiveNav(item.id)}
            >
              {Icon[item.icon]({ width: 16, height: 16 })}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="status-widget">
          <div className="status-head">
            <span className="status-dot-live" />
            <span>SYSTEM STATUS</span>
          </div>
          <div className="status-line">
            <Icon.check width={15} height={15} className="ok-icon" />
            <strong>All systems operational</strong>
          </div>
          <p className="status-sub">9 automations online</p>
          <svg className="status-sparkline" viewBox="0 0 140 34" preserveAspectRatio="none">
            <polyline
              points="0,24 14,20 28,26 42,14 56,18 70,8 84,16 98,10 112,18 126,6 140,12"
              fill="none" stroke="#4a4a4d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
          <p className="status-updated">Updated just now</p>
        </div>
      </aside>

      <main className="content">
        <ErrorBoundary key={activeNav}>
        {activeNav === "crm" ? (
          <CRMPage />
        ) : activeNav === "aiagents" ? (
          <AIAgentsPage token={user.token} userEmail={user.email} />
        ) : activeNav !== "home" ? (
          <div className="stub">
            <div className="stub-icon">{Icon[NAV.find((n) => n.id === activeNav).icon]({ width: 22, height: 22 })}</div>
            <h2>{NAV.find((n) => n.id === activeNav).label}</h2>
            <p>Esta seção ainda não foi construída — a Home e o CRM já estão funcionais.</p>
            <button className="ghost-btn" onClick={() => setActiveNav("home")}>
              Voltar para a Home
            </button>
          </div>
        ) : (
          <>
            <header className="topbar">
              <div>
                <h1>{getGreeting()}, {user.name}.</h1>
                <p>{criticalErrors === 0 ? "Está tudo funcionando bem hoje." : `${criticalErrors} alerta${criticalErrors > 1 ? "s" : ""} precisa${criticalErrors > 1 ? "m" : ""} de atenção.`}</p>
              </div>
              <div className="topbar-right">
                <div className="search-box">
                  <Icon.search width={15} height={15} />
                  <input placeholder="Search…" />
                </div>
                <button className="icon-btn" aria-label="Notifications">
                  <Icon.bell width={16} height={16} />
                  {criticalErrors > 0 && <span className="icon-dot" />}
                </button>
                <div className="header-user">
                  <button className="header-user-btn" onClick={() => setMenuOpen((v) => !v)}>
                    <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
                    <span>{user.name}</span>
                    <Icon.chevron width={13} height={13} className={`user-caret${menuOpen ? " open" : ""}`} />
                  </button>
                  {menuOpen && (
                    <div className="user-menu">
                      <button>Meu perfil</button>
                      <button>Preferências</button>
                      <button className="danger">Sair</button>
                    </div>
                  )}
                </div>
                <span className="date-chip">
                  <Icon.doc width={13} height={13} />
                  {todayLabel()}
                  <Icon.chevron width={12} height={12} />
                </span>
              </div>
            </header>

            <section className="stats-grid">
              <StatCard icon="bolt" value="23" label={<>Automations<br />running</>} delta="↑ 3 since yesterday" />
              <StatCard icon="doc" value={reports.length} label={<>Reports<br />generated</>} delta="↑ 18 since yesterday" />
              <StatCard icon="users" value="12" label={<>New leads<br />today</>} delta="↑ 5 since yesterday" />
              <StatCard
                icon="shield"
                tone={criticalErrors ? "accent" : undefined}
                value={criticalErrors}
                label={<>Critical<br />errors</>}
                delta={criticalErrors ? `${criticalErrors} needs attention` : "All systems operational"}
              />
            </section>

            <section className="grid-3">
              <div className="card panel">
                <PanelHeader icon="pulse" title="System Health" />
                <div className="panel-row">
                  <span>All systems are operational</span>
                  <span className="pill">All good</span>
                </div>
                <ul className="health-list">
                  {SYSTEM_HEALTH.map((s) => (
                    <li key={s.name}>
                      <span className="dot ok" />
                      {s.name}
                      <span className="status">Operational</span>
                    </li>
                  ))}
                </ul>
                <button className="panel-view-all">
                  View all systems <Icon.arrow width={13} height={13} />
                </button>
              </div>

              <div className="card panel">
                <PanelHeader
                  icon="doc"
                  title="Client Reports"
                  action="View all"
                  onAction={() => setShowAllReports((v) => !v)}
                />
                <div className="panel-row">
                  <span>Generated Today</span>
                  <span className="pill">{deliveredReports}/{reports.length} Delivered</span>
                </div>
                <ul className="report-list">
                  {visibleReports.map((r, i) => (
                    <li key={r.client + i}>
                      <Icon.check width={15} height={15} className="ok-icon" />
                      {r.client}
                      <span className="time">{r.time}</span>
                    </li>
                  ))}
                </ul>
                <button className="panel-view-all">
                  View all reports <Icon.arrow width={13} height={13} />
                </button>
              </div>

              <div className="card panel">
                <PanelHeader icon="users" title="Prospecting CRM" />
                <p className="panel-sub">Pipeline Overview</p>
                <div className="pipeline">
                  {PIPELINE.map((s) => (
                    <div className="pipeline-stage" key={s.stage}>
                      <span className="pipeline-label">{s.stage}</span>
                      <strong>{s.value}</strong>
                      {Icon[s.icon]({ width: 14, height: 14 })}
                    </div>
                  ))}
                </div>
                <div className="panel-row">
                  <span>Total deals in pipeline: {totalDeals}</span>
                  <span className="pipeline-pct">{pipelinePct}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pipelinePct}%` }} />
                </div>
                <button className="link-btn pipeline-view-crm" onClick={() => setActiveNav("crm")}>
                  View CRM <Icon.arrow width={12} height={12} />
                </button>
              </div>
            </section>

            <section className="grid-3">
              <div className="card panel">
                <PanelHeader icon="alert" title="Automation Alerts" />
                {alerts.length === 0 ? (
                  <p className="empty-ok">
                    <Icon.check width={15} height={15} className="ok-icon" /> No active alerts.
                  </p>
                ) : (
                  alerts.map((a) => (
                    <div className="alert-box" key={a.id}>
                      <Icon.alert width={18} height={18} className="alert-icon" />
                      <div>
                        <strong>{a.title}</strong>
                        <p>
                          Client: {a.client}
                          <br />
                          Last execution: {a.lastRun}
                          <br />
                          Error: {a.error}
                        </p>
                        <button className="rerun-btn" onClick={() => resolveAlert(a)} disabled={rerunning === a.id}>
                          <Icon.refresh width={13} height={13} className={rerunning === a.id ? "spin" : ""} />
                          {rerunning === a.id ? "Re-running…" : "Run Automation Again"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <p className="panel-foot warn">
                  {alerts.length} alert{alerts.length === 1 ? "" : "s"} requires your attention
                </p>
              </div>

              <div className="card panel">
                <PanelHeader icon="list" title="Today's Tasks" />
                <ul className="task-list">
                  {tasks.map((t) => (
                    <li key={t.id}>
                      <label>
                        <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                        <span className={t.done ? "done" : ""}>{t.label}</span>
                      </label>
                      <span className="time">{t.time}</span>
                    </li>
                  ))}
                </ul>
                <p className="panel-foot">{pendingTasks} tasks pending</p>
              </div>

              <div className="card panel">
                <PanelHeader icon="clock" title="Recent Activity" />
                <ul className="activity-list">
                  {activity.slice(0, 6).map((a, i) => (
                    <li key={i}>
                      <span className="time">{a.time}</span>
                      {a.tone === "ok" ? (
                        <span className="dot ok" />
                      ) : (
                        <Icon.alert width={13} height={13} className="activity-warn" />
                      )}
                      {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        )}
        </ErrorBoundary>
      </main>

      <style>{`
        /* Reset the Vite/CRA boilerplate that fights this layout:
           #root's max-width/centering, body's flex centering, and
           the template's dark-mode default text color. */
        html, body, #root {
          width: 100%;
          min-height: 100vh;
          margin: 0;
          padding: 0;
          max-width: none;
          display: block;
          text-align: left;
          color-scheme: light;
          color: #131314;
        }
        body { background: #fafafa; }

        .zoc {
          --bg: #fafafa;
          --card: #ffffff;
          --ink: #131314;
          --ink-soft: #75757a;
          --ink-faint: #a9a9ae;
          --line: #e7e7e9;
          --accent: #2b2b2d;
          --accent-soft: #ececec;
          --green: #4a4a4d;
          --green-soft: #ececec;
          --red: #131314;
          --red-soft: #e4e4e5;
          --sand: #f2f2f0;
          font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif;
          color: var(--ink);
          background: var(--bg);
          display: grid;
          grid-template-columns: 232px 1fr;
          min-height: 100vh;
          font-size: 14px;
        }
        .zoc * { box-sizing: border-box; }
        .zoc button, .zoc input { font-family: inherit; }
        .zoc button { cursor: pointer; }

        /* Sidebar */
        .sidebar {
          background: #ffffff;
          border-right: 1px solid var(--line);
          padding: 20px 14px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .sidebar::-webkit-scrollbar { display: none; }
        .brand { display: flex; align-items: center; justify-content: center; padding: 6px 6px 16px; }
        .brand-logo {
          display: block; width: 128px; height: auto; max-width: 100%;
          filter: brightness(0); object-fit: contain;
        }

        .nav { display: flex; flex-direction: column; gap: 1px; }
        .nav-item {
          display: flex; align-items: center; gap: 10px;
          background: none; border: none; text-align: left;
          padding: 8px 10px; border-radius: 7px;
          font-size: 13.5px; color: var(--ink-soft); font-weight: 500;
        }
        .nav-item svg { flex-shrink: 0; color: var(--ink-faint); }
        .nav-item:hover { background: var(--sand); color: var(--ink); }
        .nav-item.active { background: var(--ink); color: #fff; }
        .nav-item.active svg { color: #fff; }

        .avatar {
          width: 26px; height: 26px; border-radius: 50%; background: var(--ink);
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-size: 10.5px; font-weight: 700; flex-shrink: 0;
        }

        .header-user { position: relative; }
        .header-user-btn {
          display: flex; align-items: center; gap: 8px; background: var(--card);
          border: 1px solid var(--line); border-radius: 20px; padding: 4px 12px 4px 4px;
          font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap;
        }
        .header-user-btn:hover { background: var(--sand); }
        .user-caret { transition: transform .15s; color: var(--ink-faint); flex-shrink: 0; }
        .user-caret.open { transform: rotate(180deg); }
        .user-menu {
          position: absolute; top: 46px; right: 0; width: 170px;
          background: var(--card); border: 1px solid var(--line); border-radius: 9px;
          box-shadow: 0 8px 24px rgba(0,0,0,.08); overflow: hidden; z-index: 10;
        }
        .user-menu button { display: block; width: 100%; text-align: left; padding: 9px 12px; background: none; border: none; font-size: 12.5px; color: var(--ink); }
        .user-menu button:hover { background: var(--sand); }
        .user-menu button.danger { color: var(--red); }

        .status-widget { margin-top: auto; border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
        .status-head { display: flex; align-items: center; gap: 7px; font-size: 10.5px; letter-spacing: .4px; color: var(--ink-faint); font-weight: 700; margin-bottom: 10px; }
        .status-dot-live { width: 6px; height: 6px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
        .status-line { display: flex; align-items: center; gap: 6px; font-size: 12.5px; margin-bottom: 3px; }
        .status-sub { font-size: 11.5px; color: var(--ink-soft); margin: 0 0 10px; }
        .status-sparkline { width: 100%; height: 32px; display: block; margin-bottom: 8px; }
        .status-updated { font-size: 10.5px; color: var(--ink-faint); margin: 0; }

        /* Content */
        .content { padding: 28px 36px 56px; }
        .topbar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .topbar h1 { font-size: 22px; margin: 0 0 3px; font-weight: 700; letter-spacing: -0.3px; color: var(--ink); }
        .topbar p { margin: 0; color: var(--ink-soft); font-size: 13px; }

        .topbar-right { display: flex; align-items: center; gap: 8px; }
        .search-box {
          display: flex; align-items: center; gap: 7px; background: var(--card);
          border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; color: var(--ink-faint);
        }
        .search-box input { border: none; outline: none; background: none; font-size: 12.5px; color: var(--ink); width: 140px; }
        .icon-btn { position: relative; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--ink-soft); display: flex; align-items: center; justify-content: center; }
        .icon-btn:hover { background: var(--sand); }
        .icon-dot { position: absolute; top: 6px; right: 7px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
        .date-chip { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--ink-soft); border: 1px solid var(--line); border-radius: 8px; padding: 7px 11px; white-space: nowrap; }
        .date-chip svg:last-child { color: var(--ink-faint); }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
        .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; }
        .stat-card { padding: 16px; display: flex; gap: 12px; align-items: flex-start; }
        .stat-icon {
          width: 52px; height: 52px; border-radius: 50%; background: var(--sand); border: none;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--ink);
        }
        .stat-icon.tone-accent { background: var(--red-soft); color: var(--red); }
        .stat-value { font-size: 22px; font-weight: 700; line-height: 1; letter-spacing: -0.3px; }
        .stat-label { font-size: 12px; color: var(--ink-soft); margin-top: 4px; line-height: 1.3; }
        .stat-delta { font-size: 11.5px; color: var(--green); margin-top: 6px; }
        .stat-delta.warn { color: var(--red); }

        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px; }
        .panel { padding: 18px; display: flex; flex-direction: column; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
        .panel-title { display: flex; align-items: center; gap: 7px; }
        .panel-title h3 { font-size: 14px; margin: 0; font-weight: 600; }
        .panel-icon { color: var(--ink-faint); display: flex; }
        .panel-sub { font-size: 12px; color: var(--ink-faint); margin: 0 0 12px; }
        .link-btn { background: none; border: none; color: var(--accent); font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 3px; }
        .link-btn:hover { text-decoration: underline; }

        .health-list, .report-list, .task-list, .activity-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
        .health-list li, .report-list li { display: flex; align-items: center; gap: 8px; }
        .status, .time { margin-left: auto; color: var(--ink-faint); font-size: 11.5px; }
        .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .dot.ok { background: var(--green); }
        .dot.bad { background: var(--red); }
        .ok-icon { color: var(--green); flex-shrink: 0; }

        .panel-row { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: var(--ink-soft); margin-bottom: 10px; }
        .pill { background: var(--green-soft); color: var(--green); font-size: 11px; padding: 3px 9px; border-radius: 20px; font-weight: 600; }
        .panel-foot { font-size: 12px; margin: 12px 0 0; color: var(--ink-soft); }
        .panel-foot.ok { color: var(--green); }
        .panel-foot.warn { color: var(--red); }

        .pipeline { display: flex; gap: 6px; margin-bottom: 14px; }
        .pipeline-stage { flex: 1; background: var(--sand); border: 1px solid var(--line); border-radius: 8px; padding: 9px 7px; display: flex; flex-direction: column; gap: 8px; }
        .pipeline-label { font-size: 10.5px; color: var(--ink-faint); }
        .pipeline-stage strong { font-size: 17px; }
        .pipeline-stage svg { color: var(--ink-faint); }

        .pipeline-pct { font-weight: 700; color: var(--ink); }
        .progress-track { height: 5px; background: var(--sand); border-radius: 20px; overflow: hidden; margin: 8px 0 12px; }
        .progress-fill { height: 100%; background: var(--ink); border-radius: 20px; transition: width .3s ease; }
        .pipeline-view-crm { margin: 0; }

        .panel-view-all {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%; background: none; border: 1px solid var(--line); color: var(--ink);
          font-size: 12.5px; font-weight: 600; padding: 9px; border-radius: 8px; margin-top: 12px;
        }
        .panel-view-all:hover { background: var(--sand); }
        .activity-warn { color: var(--red); flex-shrink: 0; }

        .alert-box { display: flex; gap: 11px; background: var(--red-soft); border: 1px solid #ecc3ba; border-radius: 9px; padding: 13px; }
        .alert-icon { color: var(--red); flex-shrink: 0; margin-top: 2px; }
        .alert-box strong { font-size: 13px; color: var(--red); }
        .alert-box p { font-size: 12px; color: var(--ink-soft); margin: 5px 0 9px; line-height: 1.5; }
        .rerun-btn { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; background: var(--ink); border: none; color: #fff; font-size: 12.5px; font-weight: 600; padding: 10px; border-radius: 8px; }
        .rerun-btn:hover { background: #2a2a2c; }
        .rerun-btn:disabled { opacity: .65; cursor: default; }
        .empty-ok { display: flex; align-items: center; gap: 8px; color: var(--green); font-size: 13px; }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .task-list li { display: flex; align-items: center; gap: 8px; }
        .task-list label { display: flex; align-items: center; gap: 9px; flex: 1; }
        .task-list input { width: 14px; height: 14px; accent-color: var(--ink); }
        .task-list .done { text-decoration: line-through; color: var(--ink-faint); }

        .activity-list li { display: flex; align-items: center; gap: 9px; }

        .stub { max-width: 380px; margin: 80px auto 0; text-align: center; }
        .stub-icon { width: 46px; height: 46px; border-radius: 10px; border: 1px solid var(--line); color: var(--ink-soft); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
        .stub h2 { margin: 0 0 8px; font-size: 17px; color: var(--ink); }
        .stub p { color: var(--ink-soft); font-size: 13px; margin: 0 0 18px; }
        .ghost-btn { background: var(--ink); color: #fff; border: none; padding: 8px 16px; border-radius: 7px; font-size: 13px; font-weight: 600; }

        @media (max-width: 1100px) {
          .grid-3 { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 720px) {
          .zoc { grid-template-columns: 1fr; }
          .sidebar { flex-direction: row; flex-wrap: wrap; }
          .nav { flex-direction: row; flex-wrap: wrap; }
          .status-widget { display: none; }
          .header-user-btn span:not(.avatar) { display: none; }
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .content { padding: 20px 16px 36px; }
          .search-box input { width: 90px; }
        }
      `}</style>
    </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
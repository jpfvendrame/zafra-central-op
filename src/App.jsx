import { Component, useState, useMemo } from "react";
import CRMPage from "./CRMpage";
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
};

/* ---------------- Static config ---------------- */
const NAV = [
  { id: "home", label: "Home", icon: "home" },
  { id: "automations", label: "Automations", icon: "bolt" },
  { id: "reports", label: "Reports", icon: "doc" },
  { id: "crm", label: "CRM", icon: "users" },
  { id: "leads", label: "Leads", icon: "target" },
  { id: "campaigns", label: "Campaigns", icon: "megaphone" },
  { id: "integrations", label: "Integrations", icon: "puzzle" },
  { id: "workflows", label: "Workflows", icon: "workflow" },
  { id: "logs", label: "Logs", icon: "list" },
  { id: "settings", label: "Settings", icon: "gear" },
];

const SYSTEM_HEALTH = [
  { name: "Report Generator", status: "operational" },
  { name: "CRM Sync", status: "operational" },
  { name: "Lead Capture", status: "operational" },
  { name: "WhatsApp Sender", status: "operational" },
  { name: "Analytics Engine", status: "operational" },
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

/* ---------------- Small building blocks ---------------- */
function StatCard({ icon, tone, value, label, delta }) {
  return (
    <div className="card stat-card">
      <div className={`stat-icon${tone === "accent" ? " tone-accent" : ""}`}>{Icon[icon]({ width: 18, height: 18 })}</div>
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
export default function ZafraOperationsCenter({ userName = "João", userEmail = "joao.costa@zafra.com" }) {
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
  const criticalErrors = alerts.length;

  return (
    <div className="zoc">
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

        <div className="user-box">
          <button className="user-btn" onClick={() => setMenuOpen((v) => !v)}>
            <span className="avatar">{userName.slice(0, 2).toUpperCase()}</span>
            <span className="user-meta">
              <strong>{userName} Costa</strong>
              <small>{userEmail}</small>
            </span>
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
      </aside>

      <main className="content">
        <ErrorBoundary key={activeNav}>
        {activeNav === "crm" ? (
          <CRMPage />
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
                <h1>Good morning, {userName}.</h1>
                <p>{criticalErrors === 0 ? "Everything is running smoothly today." : `${criticalErrors} issue needs your attention.`}</p>
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
                <span className="date-chip">{todayLabel()}</span>
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
                <p className="panel-sub">All systems are operational</p>
                <ul className="health-list">
                  {SYSTEM_HEALTH.map((s) => (
                    <li key={s.name}>
                      <span className="dot ok" />
                      {s.name}
                      <span className="status">Operational</span>
                    </li>
                  ))}
                </ul>
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
                <p className="panel-foot ok">All reports delivered successfully</p>
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
                  <button className="link-btn" onClick={() => setActiveNav("crm")}>
                    View CRM <Icon.arrow width={12} height={12} />
                  </button>
                </div>
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
                        <button className="outline-btn" onClick={() => resolveAlert(a)} disabled={rerunning === a.id}>
                          <Icon.refresh width={13} height={13} className={rerunning === a.id ? "spin" : ""} />
                          {rerunning === a.id ? "Re-running…" : "Re-run Automation"}
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
                      <span className={`dot ${a.tone === "ok" ? "ok" : "bad"}`} />
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
          --accent: #c8512e;
          --accent-soft: #f6e3db;
          --green: #2f7a52;
          --green-soft: #e2f0e6;
          --red: #b3402f;
          --red-soft: #f7e2dd;
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
        }
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

        .user-box { margin-top: auto; position: relative; border-top: 1px solid var(--line); padding-top: 12px; }
        .user-btn { width: 100%; display: flex; align-items: center; gap: 9px; background: none; border: none; padding: 4px; border-radius: 8px; }
        .user-btn:hover { background: var(--sand); }
        .avatar {
          width: 28px; height: 28px; border-radius: 50%; background: var(--ink);
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; flex-shrink: 0;
        }
        .user-meta { display: flex; flex-direction: column; text-align: left; flex: 1; min-width: 0; }
        .user-meta strong { font-size: 12.5px; font-weight: 600; }
        .user-meta small { font-size: 11px; color: var(--ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .user-caret { transition: transform .15s; color: var(--ink-faint); flex-shrink: 0; }
        .user-caret.open { transform: rotate(180deg); }
        .user-menu {
          position: absolute; bottom: 54px; left: 4px; right: 4px;
          background: var(--card); border: 1px solid var(--line); border-radius: 9px;
          box-shadow: 0 8px 24px rgba(0,0,0,.08); overflow: hidden;
        }
        .user-menu button { display: block; width: 100%; text-align: left; padding: 9px 12px; background: none; border: none; font-size: 12.5px; color: var(--ink); }
        .user-menu button:hover { background: var(--sand); }
        .user-menu button.danger { color: var(--red); }

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
        .date-chip { font-size: 12px; color: var(--ink-soft); border: 1px solid var(--line); border-radius: 8px; padding: 7px 11px; white-space: nowrap; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
        .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; }
        .stat-card { padding: 16px; display: flex; gap: 12px; align-items: flex-start; }
        .stat-icon {
          width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--line);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--ink-soft);
        }
        .stat-icon.tone-accent { border-color: var(--red); color: var(--red); }
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

        .alert-box { display: flex; gap: 11px; background: var(--red-soft); border: 1px solid #ecc3ba; border-radius: 9px; padding: 13px; }
        .alert-icon { color: var(--red); flex-shrink: 0; margin-top: 2px; }
        .alert-box strong { font-size: 13px; color: var(--red); }
        .alert-box p { font-size: 12px; color: var(--ink-soft); margin: 5px 0 9px; line-height: 1.5; }
        .outline-btn { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid var(--red); color: var(--red); font-size: 12px; font-weight: 600; padding: 6px 11px; border-radius: 7px; }
        .outline-btn:hover { background: var(--red); color: #fff; }
        .outline-btn:disabled { opacity: .65; cursor: default; }
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
          .user-box { display: none; }
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .content { padding: 20px 16px 36px; }
          .search-box input { width: 90px; }
        }
      `}</style>
    </div>
  );
}
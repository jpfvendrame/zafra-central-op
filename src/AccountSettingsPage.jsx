import { useState } from "react";

/* ---------------------------------------------------------
   Zafra · Settings (pra todo mundo, não só admin)
   Duas abas: Conta (editar nome/senha da própria conta) e
   Aparência (modo claro/escuro — o estado de verdade mora no
   App.jsx, aqui só reflete e alterna).
--------------------------------------------------------- */

const USER_WRITE_URL = "https://n8n-n8n.yypjz6.easypanel.host/webhook/user_write";

export default function AccountSettingsPage({ token, userName, userEmail, theme, onToggleTheme }) {
  const [tab, setTab] = useState("conta");
  const [name, setName] = useState(userName || "");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);

  async function saveAccount(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    const fields = {};
    if (name.trim() && name.trim() !== userName) fields.name = name.trim();
    if (newPassword.trim()) fields.password = newPassword.trim();
    if (Object.keys(fields).length === 0) {
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(USER_WRITE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "update_own_account", fields }),
      });
      const data = await res.json();
      if (!data.sucesso) throw new Error(data.error || "Não consegui salvar.");
      setNewPassword("");
      setSaveOk(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="acc-settings">
      <header className="acc-top">
        <h1>Settings</h1>
        <p>Sua conta e preferências.</p>
      </header>

      <div className="acc-tabs">
        <button className={tab === "conta" ? "acc-tab active" : "acc-tab"} onClick={() => setTab("conta")}>Conta</button>
        <button className={tab === "aparencia" ? "acc-tab active" : "acc-tab"} onClick={() => setTab("aparencia")}>Aparência</button>
      </div>

      {tab === "conta" && (
        <div className="acc-card">
          <form onSubmit={saveAccount} className="acc-form">
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />

            <label>E-mail</label>
            <input value={userEmail || ""} disabled className="acc-input-disabled" />

            <label>Nova senha</label>
            <input type="password" placeholder="Deixe em branco pra não alterar" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />

            {saveError && <p className="acc-error">{saveError}</p>}
            {saveOk && <p className="acc-ok">Salvo com sucesso.</p>}

            <button className="primary-btn" type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button>
          </form>
        </div>
      )}

      {tab === "aparencia" && (
        <div className="acc-card">
          <label className="acc-section-label">Tema</label>
          <div className="theme-options">
            <button className={theme === "light" ? "theme-option active" : "theme-option"} onClick={() => theme !== "light" && onToggleTheme()}>
              <span className="theme-swatch light" />
              Claro
            </button>
            <button className={theme === "dark" ? "theme-option active" : "theme-option"} onClick={() => theme !== "dark" && onToggleTheme()}>
              <span className="theme-swatch dark" />
              Escuro
            </button>
          </div>
        </div>
      )}

      <style>{`
        .acc-settings {
          color: var(--ink); font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif; font-size: 14px;
        }
        .acc-settings * { box-sizing: border-box; }
        .acc-settings button, .acc-settings input { font-family: inherit; }
        .acc-settings button { cursor: pointer; }

        .acc-top { margin-bottom: 18px; }
        .acc-top h1 { font-size: 22px; margin: 0 0 3px; font-weight: 700; letter-spacing: -0.3px; color: var(--ink); }
        .acc-top p { margin: 0; color: var(--ink-soft); font-size: 13px; }

        .acc-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 18px; }
        .acc-tab { background: none; border: none; padding: 9px 4px; margin-right: 18px; font-size: 13.5px; font-weight: 600; color: var(--ink-faint); border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .acc-tab:hover { color: var(--ink-soft); }
        .acc-tab.active { color: var(--ink); border-bottom-color: var(--ink); }

        .acc-card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 20px; max-width: 420px; }
        .acc-form { display: flex; flex-direction: column; gap: 6px; }
        .acc-form label, .acc-section-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; color: var(--ink-faint); font-weight: 600; margin-top: 10px; }
        .acc-form label:first-child { margin-top: 0; }
        .acc-form input { border: 1px solid var(--line); border-radius: 7px; padding: 9px 11px; font-size: 13px; color: var(--ink); background: var(--bg); }
        .acc-input-disabled { color: var(--ink-faint); cursor: not-allowed; }
        .acc-error { color: #b3402f; font-size: 12.5px; margin: 4px 0 0; }
        .acc-ok { color: var(--ink-soft); font-size: 12.5px; margin: 4px 0 0; }
        .primary-btn { background: var(--ink); color: var(--bg); border: none; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-top: 16px; align-self: flex-start; }
        .primary-btn:disabled { opacity: .5; cursor: not-allowed; }

        .theme-options { display: flex; gap: 10px; margin-top: 8px; }
        .theme-option { display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: 1px solid var(--line); border-radius: 10px; padding: 12px 20px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
        .theme-option.active { border-color: var(--ink); color: var(--ink); }
        .theme-swatch { display: block; width: 44px; height: 30px; border-radius: 6px; border: 1px solid var(--line); }
        .theme-swatch.light { background: #fafafa; }
        .theme-swatch.dark { background: #0f0f11; }
      `}</style>
    </div>
  );
}
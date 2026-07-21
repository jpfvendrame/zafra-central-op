import { useEffect, useState } from "react";

/* ---------------------------------------------------------
   Zafra · Settings — Gestão de Usuários
   Só admin acessa essa tela (checado em App.jsx antes de
   renderizar esse componente). Reaproveita list_users (leitura)
   e user_write (escrita: criar/editar/desativar/reativar).
--------------------------------------------------------- */

const LIST_USERS_URL = "https://n8n-n8n.yypjz6.easypanel.host/webhook/list_users";
const USER_WRITE_URL = "https://n8n-n8n.yypjz6.easypanel.host/webhook/user_write";

const ROLES = ["admin", "comerciante"];

function isTrue(v) {
  return String(v || "").trim().toUpperCase() === "TRUE";
}
function isInactive(v) {
  return String(v || "").trim().toUpperCase() === "FALSE";
}
function initials(name) {
  if (!name) return "?";
  return String(name).split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function SettingsPage({ token, userEmail }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", password: "", role: "comerciante", access_crm: false, access_agents: false });
  const [creating, setCreating] = useState(false);

  const [editingEmail, setEditingEmail] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(LIST_USERS_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await res.json();
      if (data.sucesso) setUsers(data.users || []);
      else setLoadError(data.error || "Não consegui carregar os usuários.");
    } catch (err) {
      setLoadError("Não consegui falar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [token]);

  async function postWrite(action, payload) {
    const res = await fetch(USER_WRITE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, ...payload }),
    });
    const data = await res.json();
    if (!data.sucesso) throw new Error(data.error || "Falha ao salvar.");
    return data;
  }

  async function createUser(e) {
    e.preventDefault();
    setActionError(null);
    setCreating(true);
    try {
      await postWrite("create_user", {
        user: {
          name: draft.name.trim(),
          email: draft.email.trim(),
          password: draft.password,
          role: draft.role,
          access_crm: draft.access_crm ? "TRUE" : "FALSE",
          access_agents: draft.access_agents ? "TRUE" : "FALSE",
        },
      });
      setDraft({ name: "", email: "", password: "", role: "comerciante", access_crm: false, access_agents: false });
      setShowCreate(false);
      await reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function openEdit(u) {
    setEditingEmail(u.email);
    setEditDraft({
      role: u.role || "comerciante",
      access_crm: isTrue(u.access_crm),
      access_agents: isTrue(u.access_agents),
      newPassword: "",
    });
    setActionError(null);
  }

  async function saveEdit() {
    if (!editDraft) return;
    setSaving(true);
    setActionError(null);
    const fields = {
      role: editDraft.role,
      access_crm: editDraft.access_crm ? "TRUE" : "FALSE",
      access_agents: editDraft.access_agents ? "TRUE" : "FALSE",
    };
    if (editDraft.newPassword.trim()) fields.password = editDraft.newPassword.trim();
    try {
      await postWrite("update_user", { email: editingEmail, fields });
      setUsers((prev) => prev.map((u) => (u.email === editingEmail ? { ...u, ...fields } : u)));
      setEditingEmail(null);
      setEditDraft(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u) {
    const action = isInactive(u.active) ? "enable_user" : "disable_user";
    setActionError(null);
    setUsers((prev) => prev.map((x) => (x.email === u.email ? { ...x, active: action === "enable_user" ? "TRUE" : "FALSE" } : x)));
    try {
      await postWrite(action, { email: u.email });
    } catch (err) {
      setActionError(err.message);
      reload();
    }
  }

  const editingUser = users.find((u) => u.email === editingEmail);

  return (
    <div className="settings">
      {loadError && <div className="banner banner-error">{loadError}</div>}
      {actionError && (
        <div className="banner banner-error">
          {actionError}
          <button onClick={() => setActionError(null)}>✕</button>
        </div>
      )}

      <header className="settings-top">
        <div>
          <h1>Usuários</h1>
          <p>{loading ? "Carregando…" : `${users.length} conta${users.length === 1 ? "" : "s"} cadastrada${users.length === 1 ? "" : "s"}`}</p>
        </div>
        <button className="primary-btn" onClick={() => setShowCreate(true)}>+ Novo usuário</button>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Cargo</th>
              <th>CRM</th>
              <th>Agents</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="clickable" onClick={() => openEdit(u)}>
                <td>
                  <span className="user-cell">
                    <span className="avatar-sm">{initials(u.name)}</span>
                    <strong>{u.name}</strong>
                  </span>
                </td>
                <td>{u.email}</td>
                <td><span className={u.role === "admin" ? "role-badge admin" : "role-badge"}>{u.role || "—"}</span></td>
                <td>{isTrue(u.access_crm) || u.role === "admin" ? <span className="dot ok" /> : <span className="dot off" />}</td>
                <td>{isTrue(u.access_agents) || u.role === "admin" ? <span className="dot ok" /> : <span className="dot off" />}</td>
                <td>
                  <span className={isInactive(u.active) ? "status-badge inactive" : "status-badge active"}>
                    {isInactive(u.active) ? "Desativado" : "Ativo"}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr><td colSpan={6} className="table-empty">Nenhum usuário cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="confirm-overlay" onClick={() => setShowCreate(false)}>
          <div className="user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="user-modal-head">
              <h3>Novo usuário</h3>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={createUser} className="user-form">
              <label>Nome</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
              <label>E-mail</label>
              <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required />
              <label>Senha inicial</label>
              <input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} required />
              <label>Cargo</label>
              <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {draft.role !== "admin" && (
                <div className="user-form-checks">
                  <label className="checkline">
                    <input type="checkbox" checked={draft.access_crm} onChange={(e) => setDraft({ ...draft, access_crm: e.target.checked })} />
                    Acesso ao CRM
                  </label>
                  <label className="checkline">
                    <input type="checkbox" checked={draft.access_agents} onChange={(e) => setDraft({ ...draft, access_agents: e.target.checked })} />
                    Acesso aos AI Agents
                  </label>
                </div>
              )}
              <button className="primary-btn" type="submit" disabled={creating}>{creating ? "Criando…" : "Criar usuário"}</button>
            </form>
          </div>
        </div>
      )}

      {editingUser && editDraft && (
        <div className="drawer-overlay" onClick={() => { setEditingEmail(null); setEditDraft(null); }}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <h2>{editingUser.name}</h2>
                <span className="drawer-email">{editingUser.email}</span>
              </div>
              <button className="drawer-close" onClick={() => { setEditingEmail(null); setEditDraft(null); }}>✕</button>
            </div>

            <label className="field-label">Cargo</label>
            <select value={editDraft.role} onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            {editDraft.role !== "admin" && (
              <div className="user-form-checks">
                <label className="checkline">
                  <input type="checkbox" checked={editDraft.access_crm} onChange={(e) => setEditDraft({ ...editDraft, access_crm: e.target.checked })} />
                  Acesso ao CRM
                </label>
                <label className="checkline">
                  <input type="checkbox" checked={editDraft.access_agents} onChange={(e) => setEditDraft({ ...editDraft, access_agents: e.target.checked })} />
                  Acesso aos AI Agents
                </label>
              </div>
            )}

            <label className="field-label">Nova senha (opcional)</label>
            <input
              type="password"
              placeholder="Deixe em branco pra não alterar"
              className="drawer-input"
              value={editDraft.newPassword}
              onChange={(e) => setEditDraft({ ...editDraft, newPassword: e.target.value })}
            />

            <button className="primary-btn save-btn" onClick={saveEdit} disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button>

            <div className="drawer-danger">
              {editingUser.email === userEmail ? (
                <p className="danger-hint">Você não pode desativar a própria conta.</p>
              ) : (
                <button className={isInactive(editingUser.active) ? "toggle-active-btn enable" : "toggle-active-btn disable"} onClick={() => toggleActive(editingUser)}>
                  {isInactive(editingUser.active) ? "Reativar usuário" : "Desativar usuário"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .settings {
          --bg: #fafafa; --card: #ffffff; --ink: #131314; --ink-soft: #75757a; --ink-faint: #a9a9ae;
          --line: #e7e7e9; --sand: #f2f2f0; --red: #b3402f; --red-soft: #f7e2dd; --green: #4a4a4d;
          color: var(--ink); font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif; font-size: 14px;
        }
        .theme-dark .settings {
          --bg: #0f0f11; --card: #19191c; --ink: #f2f2f0; --ink-soft: #a9a9ae; --ink-faint: #6f6f74;
          --line: #2a2a2e; --sand: #202024; --red: #e08a7a; --red-soft: #3a2320; --green: #a9a9ae;
        }
        .settings * { box-sizing: border-box; }
        .settings button, .settings input, .settings select { font-family: inherit; }
        .settings button { cursor: pointer; }

        .banner { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; padding: 9px 13px; border-radius: 8px; margin-bottom: 12px; }
        .banner-error { background: var(--red-soft); color: var(--red); }
        .banner-error button { background: none; border: none; color: inherit; font-size: 12px; }

        .settings-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
        .settings-top h1 { font-size: 22px; margin: 0 0 3px; font-weight: 700; letter-spacing: -0.3px; color: var(--ink); }
        .settings-top p { margin: 0; color: var(--ink-soft); font-size: 13px; }
        .primary-btn { background: var(--ink); color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; }
        .primary-btn:disabled { opacity: .5; cursor: not-allowed; }

        .table-wrap { background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 11px 14px; background: var(--sand); font-size: 11px; color: var(--ink-soft); font-weight: 600; text-transform: uppercase; letter-spacing: .4px; }
        td { padding: 11px 14px; border-top: 1px solid var(--line); }
        tr.clickable { cursor: pointer; }
        tr.clickable:hover { background: var(--sand); }
        .table-empty { text-align: center; color: var(--ink-faint); padding: 30px; }

        .user-cell { display: flex; align-items: center; gap: 9px; }
        .avatar-sm { width: 26px; height: 26px; border-radius: 50%; background: var(--sand); color: var(--ink-soft); font-size: 10.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .role-badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; background: var(--sand); color: var(--ink-soft); text-transform: capitalize; }
        .role-badge.admin { background: var(--ink); color: #fff; }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
        .dot.ok { background: var(--green); }
        .dot.off { background: var(--line); }
        .status-badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
        .status-badge.active { background: #ececec; color: var(--ink-soft); }
        .status-badge.inactive { background: var(--red-soft); color: var(--red); }

        .confirm-overlay { position: fixed; inset: 0; background: rgba(19,19,20,.32); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 20px; }
        .user-modal { background: var(--card); border-radius: 12px; padding: 22px; max-width: 380px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
        .user-modal-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .user-modal-head h3 { font-size: 16px; margin: 0; }
        .modal-close { background: var(--sand); border: none; width: 26px; height: 26px; border-radius: 7px; font-size: 12px; color: var(--ink-soft); }
        .user-form { display: flex; flex-direction: column; gap: 6px; }
        .user-form label, .field-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; color: var(--ink-faint); font-weight: 600; margin-top: 8px; }
        .user-form input, .user-form select, .settings .drawer select { border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; font-size: 13px; font-family: inherit; color: var(--ink); background: #fff; }
        .user-form-checks { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 2px; }
        .checkline { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink); text-transform: none; letter-spacing: 0; font-weight: 500; }
        .user-form .primary-btn { margin-top: 14px; }

        .drawer-overlay { position: fixed; inset: 0; background: rgba(19,19,20,.28); display: flex; justify-content: flex-end; z-index: 40; }
        .drawer { width: 360px; max-width: 92vw; height: 100%; background: var(--card); border-left: 1px solid var(--line); padding: 22px; overflow-y: auto; display: flex; flex-direction: column; }
        .drawer-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
        .drawer-head h2 { font-size: 17px; margin: 0 0 2px; }
        .drawer-email { font-size: 12px; color: var(--ink-faint); }
        .drawer-close { background: var(--sand); border: none; width: 26px; height: 26px; border-radius: 7px; font-size: 12px; color: var(--ink-soft); flex-shrink: 0; }
        .settings .drawer select { width: 100%; margin-bottom: 6px; }
        .drawer-input { width: 100%; border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; font-size: 13px; font-family: inherit; color: var(--ink); }
        .save-btn { margin-top: 16px; }
        .drawer-danger { margin-top: auto; padding-top: 20px; }
        .danger-hint { font-size: 12px; color: var(--ink-faint); margin: 0; }
        .toggle-active-btn { width: 100%; border: 1px solid var(--line); background: none; padding: 9px; border-radius: 8px; font-size: 12.5px; font-weight: 600; }
        .toggle-active-btn.disable { color: var(--red); border-color: var(--red-soft); }
        .toggle-active-btn.disable:hover { background: var(--red-soft); }
        .toggle-active-btn.enable { color: var(--green); }
        .toggle-active-btn.enable:hover { background: var(--sand); }
      `}</style>
    </div>
  );
}
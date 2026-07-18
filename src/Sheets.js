import { useCallback, useEffect, useState } from "react";

/* ---------------------------------------------------------
   sheets.js — leitura e escrita no Google Sheets

   LEITURA: mesmo método usado no dashboard do ManyChat —
   a planilha é exportada como CSV público e lida com fetch().
   Não precisa de Apps Script pra isso, é só GET.

   ESCRITA: como CSV export é só-leitura, toda escrita
   (criar lead, mover estágio, registrar atividade) passa
   pelo Apps Script Web App (Code.gs) via POST.
--------------------------------------------------------- */

/**
 * Monta a URL de export CSV de uma aba específica da planilha.
 * @param {string} sheetId - o ID da planilha (fica na URL entre /d/ e /edit)
 * @param {string|number} gid - o ID da aba (fica na URL depois de #gid=)
 */
export function csvUrl(sheetId, gid) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/** Parser de CSV simples, respeitando aspas e vírgulas dentro de campos. */
export function parseCSV(text) {
  const lines = text.trim().replace(/\r\n|\r/g, "\n").split("\n");
  if (lines.length === 0 || !lines[0]) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const vals = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] ?? "").replace(/^"|"$/g, "").trim();
    });
    return obj;
  });
}

/**
 * Aceita "2026-07-17" (ISO, recomendado) ou "17/07/2026" (BR).
 * Formate as colunas de data na planilha como texto simples
 * nesses formatos pra evitar ambiguidade de fuso/localização.
 */
export function parseSheetDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

/** Quantos dias inteiros se passaram desde essa data. */
export function daysSince(date) {
  if (!date) return 0;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/**
 * Hook de leitura: busca o CSV, reconsulta a cada `intervalMs`
 * (padrão 60s — mais responsivo que dashboard, já que aqui tem
 * gente escrevendo direto no CRM o dia todo).
 */
export function useSheetTable(url, intervalMs = 60_000) {
  const [state, setState] = useState({ rows: [], loading: true, error: null, lastSync: null });

  const load = useCallback(async () => {
    if (!url) {
      setState((s) => ({ ...s, loading: false, error: "URL do CSV não configurada" }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = parseCSV(await res.text());
      setState({ rows, loading: false, error: null, lastSync: new Date() });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [url]);

  useEffect(() => {
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { ...state, reload: load };
}

/**
 * Envia uma ação de escrita pro Apps Script Web App.
 * Content-Type "text/plain" de propósito: evita o preflight
 * OPTIONS que o Apps Script não responde bem, mas o corpo
 * continua sendo JSON de verdade — o Code.gs faz JSON.parse().
 */
export async function postToSheet(webAppUrl, action, payload = {}) {
  if (!webAppUrl) throw new Error("URL do Apps Script não configurada");
  const res = await fetch(webAppUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Falha ao salvar na planilha");
  return json.data;
}
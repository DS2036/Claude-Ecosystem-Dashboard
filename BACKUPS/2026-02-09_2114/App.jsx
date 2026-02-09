import { useState, useCallback, useEffect, useMemo, createContext, useContext } from "react";

// ─── DEVICE CONTEXT ───
// Elimineert isPhone prop drilling door 21+ componenten
const DeviceContext = createContext({ isPhone: false, S: {}, reducedMotion: false });
function useDevice() { return useContext(DeviceContext); }

// ─── WORKER API CONFIGURATION ───
const WORKER_API = "https://claude-control-center.franky-f29.workers.dev";

// API Helper
const api = {
  async log(action, detail, type = "action", source = "Dashboard", mac = "MBA") {
    try {
      await fetch(`${WORKER_API}/api/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, detail, type, source, mac }),
      });
    } catch (e) { console.error("Log failed:", e); }
  },
  async getLogs(limit = 100) {
    try {
      const r = await fetch(`${WORKER_API}/api/logs?limit=${limit}`);
      return (await r.json()).logs || [];
    } catch (e) { console.error("Get logs failed:", e); return []; }
  },
  async createSnapshot(name, project, commit) {
    try {
      const r = await fetch(`${WORKER_API}/api/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, project, commit, type: "manual" }),
      });
      return await r.json();
    } catch (e) { console.error("Snapshot failed:", e); return null; }
  },
  async getSnapshots(project = null) {
    try {
      const url = project ? `${WORKER_API}/api/snapshots?project=${project}` : `${WORKER_API}/api/snapshots`;
      const r = await fetch(url);
      return (await r.json()).snapshots || [];
    } catch (e) { console.error("Get snapshots failed:", e); return []; }
  },
  async askAI(messages) {
    try {
      const r = await fetch(`${WORKER_API}/api/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      return await r.json();
    } catch (e) { console.error("AI request failed:", e); return null; }
  },
  async getDump() {
    try {
      const r = await fetch(WORKER_API + "/api/dump");
      return await r.json();
    } catch (e) { console.error("Get dump failed:", e); return { items: [] }; }
  },
  async saveDump(items, source) {
    try {
      await fetch(WORKER_API + "/api/dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items, source: source || "unknown" }),
      });
    } catch (e) { console.error("Save dump failed:", e); }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE CONTROL CENTER v4.23.0
// Complete Dashboard: 21 tabs voor volledig ecosysteem beheer
//
// CLOUDFLARE: https://claude-ecosystem-dashboard.pages.dev
// LOCATION: /Users/franky13m3/Projects/Claude-Ecosystem-Dashboard/
// REGEL: NOOIT nieuw project maken - ALTIJD features TOEVOEGEN hier!
// REGEL: GEEN muziek referenties - dit is SOFTWARE DEVELOPMENT
// REGEL: Bij elke update: versienummer verhogen
// ═══════════════════════════════════════════════════════════════════════════════
// VERSION HISTORY:
// v3.0 - Original merged version (Ecosystem + Memory + Git + Deploy)
// v3.1 - Added Cross-Sync, InfraNodus, Agents tabs
// v3.5 - Added Knowledge Base, Cloudflare deployment, version tracking
// v3.6 - Added Claude Updates + OpenClaw Bot monitoring (14 tabs total)
// v3.7 - Advisor met vraag-historie + Responsive menu + iPhone device + Advisor prominent
// v3.8 - Advisor multi-turn conversatie + Fullscreen mode + Chat thread
// v3.9 - Device auto-detect + Persistent Q&A log + Delete vragen + Navigatie links
// v3.9.1 - FIX: MBA default + GEEN auto-opgelost + Antwoorden zichtbaar in Alle Vragen
// v3.9.5 - Device selectie popup: Eenmalig kiezen, daarna voor altijd opgeslagen
// v3.9.6 - Advisor standaard ingeklapt + Lichter donker thema + Betere randen
// v3.9.7 - Sessions Archive toegevoegd aan Memory tab (11 actieve sessies ~240MB)
// v4.0.0 - SDK-HRM Knowledge Hub toegevoegd in Knowledge tab
// v4.1.0 - SDK-HRM als EIGEN tab met expandable/collapsible volledige uitleg teksten
// v4.2.0 - SDK-HRM alle secties verrijkt met InfraNodus detail
// v4.3.0 - Training & Benchmarks tab (ARC + LFM2 resultaten, commercial readiness)
// v4.4.0 - Crypto Intelligence Hub (scam/legit classificatie, regulatory, expertise profile)
// v4.5.0 - Session Notes & Insights (derde laags backup, copy/paste, export JSON/MD)
// v4.6.0 - Live Training Charts in Benchmarks (SVG grafieken, Loss/Accuracy/LR curves)
// v4.7.0 - Session Notes auto-split (grote documenten → gelinkte delen) + opslag indicator
// v4.8.0 - Revenue Intelligence tab (5 streams, Chrome roadmap, build-up checklist, projections)
// v4.9.0 - Perplexity API Live Intelligence Feed (8 topics, auto-refresh, cost tracking)
// v4.12.0 - Scan Now knoppen + Local API integratie + Live status indicator
// v4.11.0 - Section date prop: datums als aparte metadata rechts van header (niet in titel)
// v4.12.0 - Datums bij ALLE collapsible secties: Benchmarks (4), Revenue (5), Crypto (6)
// v4.13.0 - "Laatst bijgewerkt" datum onder elke tab-button voor referentie
// v4.14.0 - Use Cases tab: roadmap (A→B→C→D), 6 use cases, USPs, revenue targets (20 tabs)
// v4.15.0 - Blokken-layout: Ecosystem grid, Issues cards, InfraNodus 22 graphs, Staging fix BFW
// v4.16.0 - Issues filter fix: alle knoppen werken, OK klikbaar, collectAllItems, visuele feedback
// v4.18.0 - Dump cloud sync: items syncen tussen iPhone en Mac Mini via Cloudflare Worker KV
// v4.17.0 - Dump tab vervangt Notes: snelle inbox met auto-categorisatie + opmerkingen + migratie
// v4.19.0 - All Tools tab (tooling overzicht) + iPhone responsive scaling + Vercel Agent Skills
// v4.23.0 - GDPR Artes Tab + Vercel Skills Audit: DeviceContext, aria-labels, semantic buttons, URL hash, useMemo, focus-visible, reduced-motion
// v4.23.0 - Lichter thema: alle achtergronden en borders opgehelderd, lijnen→blokken in Updates/OpenClaw/Agents, Activity tab switch logging
// ═══════════════════════════════════════════════════════════════════════════════

// ─── DEVICE DETECTION ───
// iPhone = automatisch via user agent
// Mac (MBA/MM4/MM2) = eerste keer popup kiezen, daarna VOOR ALTIJD opgeslagen in localStorage
function detectDevice() {
  const ua = navigator.userAgent.toLowerCase();

  // iPhone detectie - automatisch
  if (/iphone|ipod/.test(ua) || (/mobile/.test(ua) && /safari/.test(ua))) {
    return 'iPhone';
  }

  // Mac: check localStorage (gebruiker heeft eerder gekozen - blijft voor altijd)
  const storedDevice = localStorage.getItem('ccc-device');
  if (storedDevice && ['MBA', 'MM4', 'MM2'].includes(storedDevice)) {
    return storedDevice;
  }

  // Nog niet gekozen - return null zodat popup getoond wordt
  return null;
}

// Check of gebruiker nog een Mac device moet kiezen
function needsDeviceSelection() {
  const ua = navigator.userAgent.toLowerCase();
  // iPhone = automatisch, geen selectie nodig
  if (/iphone|ipod|mobile/.test(ua)) return false;
  // Mac: check of al gekozen in localStorage
  return !localStorage.getItem('ccc-device');
}

// Sla gekozen device PERMANENT op (voor altijd in deze browser)
function setDeviceChoice(device) {
  localStorage.setItem('ccc-device', device);
}

// ─── ACTIVITY LOGGER ───
function logActivity(action, detail, device) {
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    action,
    detail,
    device: device || detectDevice(),
  };

  try {
    const existing = JSON.parse(localStorage.getItem('ccc-activity-log') || '[]');
    existing.unshift(entry);
    localStorage.setItem('ccc-activity-log', JSON.stringify(existing.slice(0, 500))); // Keep 500 entries
  } catch(e) {}

  // Also send to API for central logging
  api.log(action, detail, 'activity', 'Dashboard', device || detectDevice());

  return entry;
}

// ─── STATUS DEFINITIONS ───
const STATUS = {
  OK: { label: "OK", color: "#22c55e", bg: "#052e16", border: "#166534", icon: "●" },
  WARN: { label: "Waarschuwing", color: "#f59e0b", bg: "#1a1400", border: "#854d0e", icon: "▲" },
  ERROR: { label: "Probleem", color: "#ef4444", bg: "#1a0000", border: "#991b1b", icon: "✖" },
  INFO: { label: "Info", color: "#60a5fa", bg: "#001a33", border: "#1e40af", icon: "ℹ" },
  PENDING: { label: "Wachtend", color: "#a78bfa", bg: "#0f0033", border: "#5b21b6", icon: "◌" },
  DEAD: { label: "Inactief", color: "#6b7280", bg: "#1e1e2e", border: "#454d60", icon: "○" },
  SYNCING: { label: "Syncing", color: "#06b6d4", bg: "#001a1a", border: "#0e7490", icon: "↻" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// V1 ECOSYSTEM DATA - COMPLETE TREE STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════════
const ECOSYSTEM = [
  {
    id: "hardware", name: "Hardware & Machines", icon: "🖥️", status: STATUS.WARN,
    detail: "3 Macs, 1 actief — 2 nog niet gesynchroniseerd",
    children: [
      { id: "mba", name: "MacBook Air M3", icon: "💻", status: STATUS.OK, detail: "Primaire dev machine", tags: ["Syncthing ✓", "Claude-Mem ✓", "CLI ✓"] },
      { id: "mm4", name: "Mac Mini M4", icon: "🖥️", status: STATUS.PENDING, detail: "Scripts klaar, nog niet uitgevoerd", recommendation: "Voer setup-new-mac.sh uit" },
      { id: "mm2", name: "Mac Mini M2", icon: "🖥️", status: STATUS.PENDING, detail: "Scripts klaar, nog niet gekoppeld", recommendation: "Voer setup-new-mac.sh uit" },
      { id: "mbp", name: "MacBook Pro (nieuw)", icon: "💻", status: STATUS.PENDING, detail: "Toekomstig — setup repliceerbaar via GitHub" },
    ],
  },
  {
    id: "interfaces", name: "Claude Interfaces", icon: "🔮", status: STATUS.OK,
    detail: "Chat + CLI operationeel",
    children: [
      { id: "claude-ai", name: "Claude.ai (Chat)", icon: "💬", status: STATUS.OK, children: [
        { id: "ai-mem", name: "Memory System", icon: "🧠", status: STATUS.OK },
        { id: "ai-proj", name: "Projects", icon: "📁", status: STATUS.OK },
        { id: "ai-art", name: "Artifacts", icon: "🎨", status: STATUS.OK },
        { id: "ai-search", name: "Web Search", icon: "🔍", status: STATUS.OK },
        { id: "ai-code", name: "Code Execution", icon: "⚡", status: STATUS.OK },
        { id: "ai-research", name: "Deep Research", icon: "📚", status: STATUS.OK },
      ]},
      { id: "claude-code", name: "Claude Code CLI v2.1.32", icon: "⌨️", status: STATUS.OK, children: [
        { id: "cc-bash", name: "Bash Permissions", icon: "🔧", status: STATUS.OK, detail: "echo, ls, cat, mkdir, cp, git, npm, node, npx, python3, pip3" },
        { id: "cc-file", name: "File Ops", icon: "📄", status: STATUS.OK },
        { id: "cc-web", name: "WebSearch", icon: "🌐", status: STATUS.OK, detail: "Beperkt tot: 'claude ai'" },
      ]},
      { id: "cowork", name: "Cowork (Desktop Beta)", icon: "🤝", status: STATUS.PENDING },
    ],
  },
  {
    id: "mcp", name: "MCP Servers", icon: "🔌", status: STATUS.WARN, detail: "8 actief, 1 verdwenen (Serena)", children: [
      { id: "mcp-cli", name: "CLI MCP Servers", icon: "⌨️", status: STATUS.WARN, detail: "Serena ontbreekt — 4/5 actief", children: [
        { id: "mcp-obsidian", name: "Obsidian Vault", icon: "📓", status: STATUS.OK, tags: ["Inbox","Projects","Ideas","Brain-App"] },
        { id: "mcp-infranodus", name: "InfraNodus", icon: "🕸️", status: STATUS.OK },
        { id: "mcp-perplexity", name: "Perplexity", icon: "🔍", status: STATUS.OK },
        { id: "mcp-memory", name: "Memory Server", icon: "💾", status: STATUS.OK },
        { id: "mcp-serena", name: "Serena (IDE)", icon: "🔧", status: STATUS.ERROR, detail: "NIET geconfigureerd", recommendation: "Herinstalleer of verwijder /serena-herstel" },
      ]},
      { id: "mcp-chat", name: "Claude.ai MCP Servers", icon: "💬", status: STATUS.OK, children: [
        { id: "mcp-screen", name: "ScreenApp", icon: "📹", status: STATUS.OK },
        { id: "mcp-mac", name: "Mac-Hub", icon: "🍎", status: STATUS.OK },
        { id: "mcp-chrome", name: "Chrome Extension", icon: "🌐", status: STATUS.OK },
        { id: "mcp-office", name: "Office Add-in", icon: "📊", status: STATUS.OK },
      ]},
    ],
  },
  {
    id: "plugins", name: "Plugins", icon: "🧩", status: STATUS.WARN, detail: "Dubbele commands + hook conflicts", children: [
      { id: "claude-mem", name: "Claude-Mem v9.0.16", icon: "🧠", status: STATUS.OK, children: [
        { id: "cm-worker", name: "Worker Service", icon: "⚙️", status: STATUS.OK, tags: ["Active"] },
        { id: "cm-db", name: "SQLite DB", icon: "🗄️", status: STATUS.OK, detail: "40 observations, ~0.5MB" },
        { id: "cm-vector", name: "Vector DB", icon: "🧬", status: STATUS.OK },
        { id: "cm-hooks", name: "Hooks", icon: "🪝", status: STATUS.WARN, detail: "CONFLICT met settings.json", recommendation: "Verwijder echo-hooks uit settings.json" },
        { id: "cm-cmds", name: "/do, /make-plan", icon: "⚡", status: STATUS.WARN, detail: "Dubbel in cache + marketplace" },
        { id: "cm-modes", name: "30 Taal-Modes", icon: "🌍", status: STATUS.OK },
        { id: "cm-brain", name: "Brain Saves (12)", icon: "🧠", status: STATUS.OK },
      ]},
      { id: "marketplace", name: "Official Marketplace", icon: "🏪", status: STATUS.INFO, children: [
        { id: "mp-feature", name: "/feature-dev", icon: "🚀", status: STATUS.INFO },
        { id: "mp-review", name: "/code-review", icon: "🔍", status: STATUS.INFO },
        { id: "mp-md", name: "/revise-claude-md", icon: "📝", status: STATUS.INFO },
        { id: "mp-plugin", name: "/create-plugin", icon: "🧩", status: STATUS.INFO },
        { id: "mp-pr", name: "/review-pr", icon: "📋", status: STATUS.INFO },
        { id: "mp-sdk", name: "/new-sdk-app", icon: "📦", status: STATUS.INFO },
        { id: "mp-commit", name: "/commit-push-pr", icon: "📤", status: STATUS.INFO },
        { id: "mp-ralph", name: "/ralph-loop", icon: "🔁", status: STATUS.INFO },
        { id: "mp-hookify", name: "/hookify", icon: "🪝", status: STATUS.INFO },
        { id: "mp-stripe", name: "Stripe", icon: "💳", status: STATUS.INFO },
      ]},
      { id: "dup-cmds", name: "⚠️ Dubbele Commands", icon: "⚠️", status: STATUS.WARN, detail: "Commands in cache én marketplace — kan conflicten geven", children: [
        { id: "dup-do", name: "do.md (2×)", icon: "📄", status: STATUS.WARN, detail: "Eén in claude-mem, één in marketplace", recommendation: "Verwijder duplicate uit cache" },
        { id: "dup-plan", name: "make-plan.md (2×)", icon: "📄", status: STATUS.WARN, detail: "Eén in claude-mem, één in marketplace", recommendation: "Verwijder duplicate uit cache" },
        { id: "dup-help", name: "help.md (2×)", icon: "📄", status: STATUS.WARN, detail: "Eén in claude-mem, één in marketplace", recommendation: "Verwijder duplicate uit cache" },
      ]},
    ],
  },
  {
    id: "commands", name: "Custom Slash Commands (11)", icon: "⚡", status: STATUS.OK, children: [
      { id: "c-start", name: "/start", icon: "▶️", status: STATUS.OK },
      { id: "c-franky", name: "/franky", icon: "👤", status: STATUS.OK },
      { id: "c-health", name: "/health-check", icon: "🩺", status: STATUS.OK },
      { id: "c-work", name: "/workstatus", icon: "📊", status: STATUS.OK },
      { id: "c-project", name: "/project-init", icon: "🏗️", status: STATUS.OK },
      { id: "c-seo", name: "/seo-check", icon: "🔎", status: STATUS.OK },
      { id: "c-video", name: "/analyze-video", icon: "🎬", status: STATUS.OK },
      { id: "c-ide", name: "/ide-setup", icon: "💻", status: STATUS.OK },
      { id: "c-smart", name: "/smart-tools", icon: "🛠️", status: STATUS.OK },
      { id: "c-wiggins", name: "/wiggins-loop", icon: "🔄", status: STATUS.OK },
      { id: "c-serena", name: "/serena-herstel", icon: "🔧", status: STATUS.WARN, recommendation: "Verwijder of herinstalleer Serena" },
    ],
  },
  {
    id: "agents", name: "Sub-Agents", icon: "🤖", status: STATUS.OK, children: [
      { id: "a-qa", name: "qa-tester", icon: "🧪", status: STATUS.OK },
      { id: "a-review", name: "code-reviewer", icon: "👁️", status: STATUS.OK },
      { id: "a-explore", name: "Explore", icon: "🗺️", status: STATUS.OK },
      { id: "a-plan", name: "Plan", icon: "📋", status: STATUS.OK },
      { id: "a-general", name: "general-purpose", icon: "🔧", status: STATUS.OK },
    ],
  },
  {
    id: "memory", name: "Memory & Context", icon: "💾", status: STATUS.WARN, children: [
      { id: "m-ai", name: "Claude.ai Memory", icon: "🧠", status: STATUS.OK },
      { id: "m-mem", name: "Claude-Mem DB", icon: "🗄️", status: STATUS.OK },
      { id: "m-bridge", name: "Memory Bridge", icon: "🌉", status: STATUS.OK, detail: "Chat → claude-mem injection", tags: ["NEW"] },
      { id: "m-mcp", name: "MCP Memory Server", icon: "💾", status: STATUS.WARN, detail: "OVERLAP met claude-mem", recommendation: "Kies één of definieer rollen" },
      { id: "m-global", name: "Global CLAUDE.md", icon: "📜", status: STATUS.OK },
      { id: "m-project", name: "Project CLAUDE.md's", icon: "📄", status: STATUS.WARN, detail: "10 projecten missen CLAUDE.md" },
      { id: "m-obsidian", name: "Obsidian Vault", icon: "📓", status: STATUS.OK },
      { id: "m-backlog", name: "Session Backlogs", icon: "📝", status: STATUS.OK },
    ],
  },
  {
    id: "sync", name: "Sync Infrastructure", icon: "🔄", status: STATUS.WARN, children: [
      { id: "s-gh", name: "GitHub (DS2036)", icon: "🐙", status: STATUS.WARN, detail: "5 repos met dirty files", children: [
        { id: "s-d1", name: "Econation", icon: "📂", status: STATUS.WARN, detail: "10 uncommitted bestanden", recommendation: "git add + commit of .gitignore" },
        { id: "s-d2", name: "HRM-Core-Brain", icon: "📂", status: STATUS.WARN, detail: "4 uncommitted + geen CLAUDE.md", recommendation: "Commit of reset" },
        { id: "s-d3", name: "CLAUDE-CODE-MASTERY", icon: "📂", status: STATUS.WARN, detail: "1 uncommitted bestand", recommendation: "Commit of .gitignore" },
        { id: "s-d4", name: "claude-setup", icon: "📂", status: STATUS.WARN, detail: "1 uncommitted bestand", recommendation: "Commit of .gitignore" },
        { id: "s-d5", name: "mac-automation-hub", icon: "📂", status: STATUS.WARN, detail: "1 uncommitted bestand", recommendation: "Commit of .gitignore" },
      ]},
      { id: "s-sync", name: "Syncthing", icon: "🔗", status: STATUS.WARN, detail: "Alleen MBA", recommendation: "Koppel MM4/MM2" },
      { id: "s-cf", name: "Cloudflare Pages", icon: "☁️", status: STATUS.OK, detail: "Auto-deploy via GitHub Actions", tags: ["NEW"] },
      { id: "s-scripts", name: "Setup Scripts", icon: "📜", status: STATUS.OK },
    ],
  },
  {
    id: "projects", name: "Projects (40)", icon: "📂", status: STATUS.WARN, children: [
      { id: "p-active", name: "Actieve Projecten", icon: "🟢", status: STATUS.OK, children: [
        { id: "p-eco", name: "Econation", icon: "♻️", status: STATUS.WARN, detail: "10 dirty files", tags: ["CLAUDE.md","Git","Brain"] },
        { id: "p-bfw", name: "BlackFuelWhiskey", icon: "🥃", status: STATUS.OK, tags: ["CLAUDE.md","Git","Brain"], detail: "Business rules: geen #001, #666" },
        { id: "p-hrm", name: "HRM-Core-Brain", icon: "🧠", status: STATUS.WARN, detail: "4 dirty, geen CLAUDE.md" },
        { id: "p-klui", name: "Kluizenkerk Lier", icon: "⛪", status: STATUS.WARN, detail: "DUPLICATE folders" },
        { id: "p-clawdbot", name: "ClawdBot Rewind", icon: "🤖", status: STATUS.OK, tags: ["Git","Brain"] },
        { id: "p-idgs", name: "IDGS-Constructions", icon: "🏗️", status: STATUS.OK },
        { id: "p-beau", name: "beaufuel-platform", icon: "⛽", status: STATUS.OK },
        { id: "p-sapi", name: "Sapienthinc-HRM-SDK-1", icon: "📦", status: STATUS.OK },
        { id: "p-dbo", name: "DEEP BLUE OCEAN", icon: "🌊", status: STATUS.OK },
        { id: "p-solar", name: "Solar-Sales-App", icon: "☀️", status: STATUS.OK },
        { id: "p-dash", name: "Claude-Ecosystem-Dashboard", icon: "📊", status: STATUS.OK, tags: ["Cloudflare","Git","NEW"] },
      ]},
      { id: "p-dups", name: "⚠️ Duplicaten & Lege Folders", icon: "⚠️", status: STATUS.ERROR, detail: "8 folders nemen schijfruimte in beslag en veroorzaken verwarring", children: [
        { id: "dup-klui2", name: "Kluizenkerk (2×)", icon: "📂", status: STATUS.ERROR, detail: "2 folders met zelfde projectnaam", recommendation: "Merge naar 1 folder" },
        { id: "dup-mon2", name: "Claude Live Mon (2×)", icon: "📂", status: STATUS.ERROR, detail: "2 monitoring folders actief", recommendation: "Merge naar 1 folder" },
        { id: "dup-mem2", name: "MEM start + Memory folder", icon: "📂", status: STATUS.ERROR, detail: "Verlaten memory setup bestanden", recommendation: "Verwijder na backup" },
        { id: "e1", name: "FrankySolar", icon: "📭", status: STATUS.DEAD },
        { id: "e2", name: "Last30days", icon: "📭", status: STATUS.DEAD },
        { id: "e3", name: "Solarnation", icon: "📭", status: STATUS.DEAD },
        { id: "e4", name: "Lidarus", icon: "📭", status: STATUS.DEAD },
        { id: "e5", name: "Suikerrui Antwerpen", icon: "📭", status: STATUS.DEAD },
      ]},
    ],
  },
  {
    id: "hooks", name: "Hooks", icon: "🪝", status: STATUS.WARN, detail: "CONFLICT: settings.json & claude-mem overlappen", children: [
      { id: "h-global", name: "Global (settings.json)", icon: "⚙️", status: STATUS.WARN, children: [
        { id: "h-g1", name: "SessionStart → echo", icon: "▶️", status: STATUS.WARN, detail: "Echo hook in settings.json conflicteert met claude-mem hook", recommendation: "Verwijder uit settings.json" },
        { id: "h-g2", name: "PostToolUse → echo", icon: "📝", status: STATUS.WARN, detail: "Echo hook in settings.json conflicteert met claude-mem hook", recommendation: "Verwijder uit settings.json" },
      ]},
      { id: "h-mem", name: "Claude-Mem Hooks", icon: "🧠", status: STATUS.OK, children: [
        { id: "h-m1", name: "Setup", icon: "🔧", status: STATUS.OK },
        { id: "h-m2", name: "SessionStart (4 hooks)", icon: "▶️", status: STATUS.OK },
        { id: "h-m3", name: "UserPromptSubmit", icon: "💬", status: STATUS.OK },
        { id: "h-m4", name: "PostToolUse", icon: "🔍", status: STATUS.OK },
        { id: "h-m5", name: "Stop → summarize", icon: "⏹️", status: STATUS.OK },
      ]},
    ],
  },
  {
    id: "rules", name: "User Rules & Preferences", icon: "📋", status: STATUS.OK, children: [
      { id: "r-priv", name: "Privacy: Alles standaard PRIVÉ", icon: "🔒", status: STATUS.OK, detail: "Geen publieke deploys zonder toestemming", tags: ["REGEL"] },
      { id: "r-mem", name: "Memory: Nooit herhalen", icon: "🧠", status: STATUS.OK, detail: "Correcties direct opslaan in claude-mem", tags: ["REGEL"] },
      { id: "r-auto", name: "Doel: Volledige autonomie", icon: "🤖", status: STATUS.INFO, detail: "Nu fundatie bouwen voor later autonoom werken" },
      { id: "r-bfw", name: "BlackFuelWhiskey: Geen #001/#666", icon: "🥃", status: STATUS.OK, detail: "Business rule voor fles nummering", tags: ["PROJECT"] },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function countByStatus(nodes) {
  const counts = { OK: 0, WARN: 0, ERROR: 0, INFO: 0, PENDING: 0, DEAD: 0 };
  function walk(list) {
    for (const n of list) {
      const key = Object.keys(STATUS).find(k => STATUS[k] === n.status);
      if (key) counts[key]++;
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return counts;
}

function collectIssues(nodes, path = []) {
  const issues = [];
  for (const n of nodes) {
    const cp = [...path, n.name];
    if (n.status === STATUS.ERROR || n.status === STATUS.WARN) issues.push({ ...n, path: cp.join(" → ") });
    if (n.children) issues.push(...collectIssues(n.children, cp));
  }
  return issues;
}

function collectAllItems(nodes, path = []) {
  const items = [];
  for (const n of nodes) {
    const cp = [...path, n.name];
    if (n.status && !n.children?.length) items.push({ ...n, path: cp.join(" → ") });
    if (n.children) items.push(...collectAllItems(n.children, cp));
  }
  return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// V1 COMPONENT: TREE NODE
// ═══════════════════════════════════════════════════════════════════════════════
function TreeNode({ node, depth = 0, searchTerm }) {
  const [open, setOpen] = useState(depth < 1);
  const has = node.children?.length > 0;
  const s = node.status || STATUS.INFO;
  const match = searchTerm ? (node.name + (node.detail || "")).toLowerCase().includes(searchTerm.toLowerCase()) : true;
  const childMatch = searchTerm && has ? node.children.some(function chk(c) {
    if ((c.name + (c.detail || "")).toLowerCase().includes(searchTerm.toLowerCase())) return true;
    return c.children ? c.children.some(chk) : false;
  }) : false;

  useEffect(() => { if (searchTerm && childMatch) setOpen(true); }, [searchTerm, childMatch]);
  if (searchTerm && !match && !childMatch) return null;

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      <div role={has ? "button" : undefined} tabIndex={has ? 0 : undefined} aria-expanded={has ? open : undefined} aria-label={has ? `Open/sluit ${node.name}` : undefined} onKeyDown={has ? (e => (e.key === "Enter" || e.key === " ") && setOpen(!open)) : undefined} onClick={() => has && setOpen(!open)} style={{
        display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 10px", borderRadius: 8,
        cursor: has ? "pointer" : "default", border: `1px solid ${s.border}22`,
        background: match && searchTerm ? s.bg : "transparent", marginBottom: 2, transition: "background 0.15s, border-color 0.15s",
      }}
        onMouseEnter={e => e.currentTarget.style.background = s.bg}
        onMouseLeave={e => e.currentTarget.style.background = match && searchTerm ? s.bg : "transparent"}
      >
        <span style={{ fontSize: 13, color: "#555", width: 16, textAlign: "center", flexShrink: 0, marginTop: 2 }}>{has ? (open ? "▾" : "▸") : " "}</span>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{node.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "#e5e5e5" }}>{node.name}</span>
            <span style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.icon}</span>
            {node.tags?.map((t, i) => <span key={i} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#22c55e22", color: "#4ade80", border: "1px solid #166534" }}>{t}</span>)}
          </div>
          {node.detail && <div style={{ fontSize: 11, color: "#888", marginTop: 2, lineHeight: 1.4 }}>{node.detail}</div>}
          {node.recommendation && <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 4, padding: "4px 8px", borderRadius: 4, background: "#1a1400", border: "1px solid #854d0e44", lineHeight: 1.4 }}>💡 {node.recommendation}</div>}
        </div>
      </div>
      {open && has && <div style={{ borderLeft: `1px solid ${s.border}33`, marginLeft: 18 }}>{node.children.map(c => <TreeNode key={c.id} node={c} depth={depth + 1} searchTerm={searchTerm} />)}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V3.9 COMPONENT: AI ADVISOR - Persistent Q&A log + Delete + Navigation links
// ═══════════════════════════════════════════════════════════════════════════════
function AIAdvisor({ issues, compact = false, onExpand, onNavigate, currentDevice }) {
  const { isPhone, S, reducedMotion } = useDevice();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [question, setQuestion] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  // v3.9.6: Start ingeklapt - gebruiker moet expliciet openen
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Chat thread for multi-turn conversations - PERSISTED
  const [chatThread, setChatThread] = useState(() => {
    try {
      const saved = localStorage.getItem("advisor-current-thread");
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });

  // ALL questions ever asked - PERSISTENT LOG
  const [allQuestions, setAllQuestions] = useState(() => {
    try {
      const saved = localStorage.getItem("advisor-all-questions");
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });

  // Saved sessions history
  const [savedSessions, setSavedSessions] = useState(() => {
    try {
      const saved = localStorage.getItem("advisor-sessions");
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });

  const summary = issues.filter(i => i.status === STATUS.ERROR || i.status === STATUS.WARN).map(i => `[${i.status === STATUS.ERROR ? "ERR" : "WARN"}] ${i.path}: ${i.detail || i.name}${i.recommendation ? " | Fix: " + i.recommendation : ""}`).join("\n");

  // Save everything to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("advisor-current-thread", JSON.stringify(chatThread));
    } catch(e) {}
  }, [chatThread]);

  useEffect(() => {
    try {
      localStorage.setItem("advisor-all-questions", JSON.stringify(allQuestions.slice(0, 200))); // Keep 200
    } catch(e) {}
  }, [allQuestions]);

  useEffect(() => {
    try {
      localStorage.setItem("advisor-sessions", JSON.stringify(savedSessions.slice(0, 20)));
    } catch(e) {}
  }, [savedSessions]);

  // Detect tab references in answer text
  const detectTabLinks = (text) => {
    const tabKeywords = {
      ecosystem: ["ecosystem", "boomstructuur", "hardware", "machines", "mcp"],
      issues: ["issues", "problemen", "waarschuwingen", "errors", "kritiek"],
      memory: ["memory", "geheugen", "claude-mem", "observations"],
      git: ["git", "repository", "commit", "push", "dirty"],
      versions: ["versions", "snapshots", "rollback", "versie"],
      activity: ["activity", "log", "activiteit", "geschiedenis"],
      staging: ["staging", "deploy", "cloudflare", "productie"],
      sync: ["sync", "syncthing", "synchronisatie", "devices"],
      infranodus: ["infranodus", "knowledge graph", "seo"],
      agents: ["agents", "orchestrator", "worker", "hiërarchie"],
      knowledge: ["knowledge", "base", "kennis"],
      updates: ["updates", "claude", "anthropic", "nieuw"],
      openbot: ["openclaw", "telegram", "bot", "clawdbot", "moldbot"],
    };

    const foundTabs = [];
    const lowerText = text.toLowerCase();

    for (const [tabId, keywords] of Object.entries(tabKeywords)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        foundTabs.push(tabId);
      }
    }

    return [...new Set(foundTabs)]; // Remove duplicates
  };

  // Build conversation context from thread
  const buildMessages = useCallback((newQuestion) => {
    const systemContext = `Je bent een EXPERT ADVISOR voor Franky's Claude ecosystem.
Je kunt helpen met: problemen analyseren, Cloud Control Center verbeteren, issues oplossen, SDK-HRM/InfraNodus/sync adviseren.

Huidige systeem issues:
${summary}

BELANGRIJK: Als je verwijst naar een specifiek onderdeel (Ecosystem, Memory, Git, etc.), vermeld dit duidelijk zodat de gebruiker ernaar kan navigeren.

Antwoord in het Nederlands. Wees kort maar actionable. Bij vervolgvragen, bouw voort op de conversatie.`;

    const messages = [{ role: "user", content: systemContext }];

    chatThread.forEach(turn => {
      messages.push({ role: "user", content: turn.question });
      messages.push({ role: "assistant", content: turn.answer });
    });

    if (newQuestion) {
      messages.push({ role: "user", content: newQuestion });
    }

    return messages;
  }, [chatThread, summary]);

  const ask = useCallback(async (q, isAnalysis = false) => {
    setLoading(true); setError(null);
    const timestamp = new Date().toISOString();
    const questionText = isAnalysis ? "Geef een volledige analyse: 1) TOP 5 acties NU 2) Lange termijn 3) Risico's" : q;

    try {
      const messages = buildMessages(questionText);
      const r = await api.askAI(messages);
      if (!r) throw new Error("Geen verbinding met AI backend");
      if (r.error) throw new Error(r.error?.message || "API fout");
      const answer = r.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "Geen antwoord.";

      // Detect linked tabs
      const linkedTabs = detectTabLinks(answer);

      // Add to chat thread
      const newTurn = {
        id: Date.now(),
        timestamp,
        question: questionText,
        answer,
        type: isAnalysis ? "analysis" : (agentMode ? "agent" : "question"),
        linkedTabs,
        device: currentDevice || detectDevice(),
        resolved: false,
      };
      setChatThread(prev => [...prev, newTurn]);

      // Also add to ALL questions log
      setAllQuestions(prev => [newTurn, ...prev]);

      // Log activity
      logActivity("advisor_question", questionText.substring(0, 100), currentDevice);

    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [buildMessages, agentMode, currentDevice]);

  const deleteTurn = (turnId) => {
    setChatThread(prev => prev.filter(t => t.id !== turnId));
    setAllQuestions(prev => prev.filter(t => t.id !== turnId));
    logActivity("advisor_delete", `Vraag ${turnId} verwijderd`, currentDevice);
  };

  const markResolved = (turnId) => {
    setAllQuestions(prev => prev.map(t => t.id === turnId ? { ...t, resolved: true } : t));
    logActivity("advisor_resolved", `Vraag ${turnId} opgelost`, currentDevice);
  };

  const startNewSession = () => {
    if (chatThread.length > 0) {
      const session = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        turns: chatThread,
        summary: chatThread[0]?.question.substring(0, 50) + "...",
        device: currentDevice || detectDevice(),
      };
      setSavedSessions(prev => [session, ...prev]);
      logActivity("advisor_new_session", `Sessie opgeslagen: ${session.summary}`, currentDevice);
    }
    setChatThread([]);
  };

  const loadSession = (session) => {
    setChatThread(session.turns);
    setShowHistory(false);
  };

  const deleteSession = (sessionId) => {
    setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const clearAllSessions = () => {
    setSavedSessions([]);
    localStorage.removeItem("advisor-sessions");
  };

  const toggleExpand = () => {
    setExpanded(!expanded);
    if (onExpand) onExpand(!expanded);
  };

  // Tab navigation handler
  const navigateToTab = (tabId) => {
    if (onNavigate) {
      onNavigate(tabId);
      if (expanded) setExpanded(false);
    }
  };

  // Tab label map
  const tabLabels = {
    ecosystem: "🗺️ Ecosystem", issues: "⚠️ Issues", memory: "🧠 Memory", git: "📂 Git",
    versions: "📸 Versions", activity: "📜 Activity", staging: "🌐 Staging", sync: "🔄 Sync",
    infranodus: "🕸️ InfraNodus", agents: "👥 Agents", knowledge: "🧠 Knowledge",
    updates: "📡 Updates", openbot: "🤖 OpenClaw"
  };

  // v3.9.6: INGEKLAPT - alleen titel + open knop
  if (compact && isCollapsed && !expanded) {
    return (
      <div style={{ background: "#1a1a2e", border: "1px solid #312e81", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 16 }}>🤖</span>
            <span style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa" }}>AI Advisor</span>
            {chatThread.length > 0 && <span style={{ fontSize: 10, color: "#6b7280", background: "#2d2a5e", padding: "2px 6px", borderRadius: 4 }}>{chatThread.length} in gesprek</span>}
            {allQuestions.length > 0 && <span style={{ fontSize: 10, color: "#6b7280" }}>• {allQuestions.length} vragen totaal</span>}
          </div>
          <button onClick={() => setIsCollapsed(false)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #5b21b6", background: "#312e81", color: "#c4b5fd", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            Open ▼
          </button>
        </div>
      </div>
    );
  }

  // Compact mode for header bar (OPEN)
  if (compact && !expanded) {
    return (
      <div style={{ background: "#1a1a2e", border: "1px solid #312e81", borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa" }}>Advisor</span>
          <input type="text" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && question.trim() && (ask(question), setQuestion(""))} placeholder="Stel een vraag of geef een opdracht..." style={{ flex: 1, minWidth: 200, padding: "6px 10px", borderRadius: 6, border: "1px solid #454d60", background: "#1e1e30", color: "#e5e5e5", fontSize: 11, outline: "none" }} />
          <button onClick={() => setAgentMode(!agentMode)} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${agentMode ? "#22c55e" : "#5b21b6"}`, background: agentMode ? "#052e16" : "#2d2a5e", color: agentMode ? "#4ade80" : "#c4b5fd", fontSize: 10, cursor: "pointer" }}>{agentMode ? "🤖 Agent" : "💬 Vraag"}</button>
          <button onClick={() => { if (question.trim()) { ask(question); setQuestion(""); } }} disabled={loading || !question.trim()} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #5b21b6", background: "#312e81", color: "#c4b5fd", fontSize: 10, cursor: "pointer" }}>{loading ? "⏳" : "→"}</button>
          <button onClick={toggleExpand} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #454d60", background: "#1e1e30", color: "#9ca3af", fontSize: 10, cursor: "pointer" }} title="Open fullscreen">⛶</button>
          <button onClick={() => setShowAllQuestions(!showAllQuestions)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #454d60", background: "#1e1e30", color: "#9ca3af", fontSize: 10, cursor: "pointer" }} title="Alle vragen">📋 {allQuestions.length}</button>
          <button onClick={() => setIsCollapsed(true)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #454d60", background: "#1e1e30", color: "#9ca3af", fontSize: 10, cursor: "pointer" }} title="Inklappen">▲</button>
          {chatThread.length > 0 && <span style={{ fontSize: 9, color: "#6b7280" }}>({chatThread.length} in gesprek)</span>}
        </div>
        {error && <div style={{ color: "#f87171", fontSize: 10, padding: "6px 0" }}>❌ {error}</div>}

        {/* Show last response + linked tabs */}
        {chatThread.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ background: "#1e1e34", border: "1px solid #2d2a5e", borderRadius: 6, padding: 10, fontSize: 11, color: "#d1d5db", lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: "#6b7280" }}>💬 {chatThread[chatThread.length - 1].question.substring(0, 50)}...</span>
                <button onClick={() => deleteTurn(chatThread[chatThread.length - 1].id)} style={{ fontSize: 9, color: "#ef4444", background: "transparent", border: "none", cursor: "pointer" }}>🗑️</button>
              </div>
              {chatThread[chatThread.length - 1].answer}
            </div>
            {/* Linked tabs */}
            {chatThread[chatThread.length - 1].linkedTabs?.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, color: "#6b7280" }}>Ga naar:</span>
                {chatThread[chatThread.length - 1].linkedTabs.map(tabId => (
                  <button key={tabId} onClick={() => navigateToTab(tabId)} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "1px solid #5b21b6", background: "#2d2a5e", color: "#c4b5fd", cursor: "pointer" }}>{tabLabels[tabId] || tabId}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={startNewSession} style={{ fontSize: 9, padding: "4px 8px", borderRadius: 4, border: "1px solid #454d60", background: "#1a1a2e", color: "#9ca3af", cursor: "pointer" }}>🔄 Nieuw</button>
              <button onClick={toggleExpand} style={{ fontSize: 9, padding: "4px 8px", borderRadius: 4, border: "1px solid #5b21b6", background: "#2d2a5e", color: "#c4b5fd", cursor: "pointer" }}>⛶ Volledig</button>
            </div>
          </div>
        )}

        {/* All questions panel (compact) */}
        {showAllQuestions && (
          <div style={{ background: "#1e1e34", border: "1px solid #2d2a5e", borderRadius: 6, padding: 10, marginTop: 8, maxHeight: 250, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>📋 Alle vragen ({allQuestions.length})</span>
              <span style={{ fontSize: 9, color: "#6b7280" }}>{allQuestions.filter(q => q.resolved).length} opgelost</span>
            </div>
            {allQuestions.slice(0, 15).map(q => (
              <div key={q.id} style={{ padding: 6, borderBottom: "1px solid #2d3748", opacity: q.resolved ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#e5e5e5", flex: 1 }}>{q.resolved ? "✅ " : ""}{q.question.substring(0, 40)}...</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {!q.resolved && <button onClick={() => markResolved(q.id)} style={{ fontSize: 8, color: "#4ade80", background: "transparent", border: "none", cursor: "pointer" }} title="Markeer als opgelost">✓</button>}
                    <button onClick={() => deleteTurn(q.id)} style={{ fontSize: 8, color: "#ef4444", background: "transparent", border: "none", cursor: "pointer" }} title="Verwijder">🗑️</button>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: "#6b7280" }}>{new Date(q.timestamp).toLocaleDateString("nl-BE")} • {q.device}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Expanded/Fullscreen mode OR Full tab mode
  const containerStyle = expanded ? {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "#1a1a2e",
    zIndex: 1000,
    padding: 20,
    overflow: "auto"
  } : {
    background: "#1a1a2e",
    border: "1px solid #312e81",
    borderRadius: 12,
    padding: 16
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🤖</span>
          <div>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#a78bfa" }}>AI Ecosystem Advisor</span>
            {chatThread.length > 0 && <span style={{ marginLeft: 10, fontSize: 11, color: "#6b7280" }}>({chatThread.length} berichten)</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setAgentMode(!agentMode)} style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${agentMode ? "#22c55e" : "#5b21b6"}`, background: agentMode ? "#052e16" : "#2d2a5e", color: agentMode ? "#4ade80" : "#c4b5fd", fontSize: 12, cursor: "pointer" }}>{agentMode ? "🤖 Agent" : "💬 Vraag"}</button>
          <button onClick={() => setShowAllQuestions(!showAllQuestions)} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #f59e0b", background: "#1a1400", color: "#fbbf24", fontSize: 12, cursor: "pointer" }}>📋 Alle vragen ({allQuestions.length})</button>
          <button onClick={() => setShowHistory(!showHistory)} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #454d60", background: "#1e1e30", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>📜 Sessies ({savedSessions.length})</button>
          {chatThread.length > 0 && <button onClick={startNewSession} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #10b981", background: "#052e16", color: "#4ade80", fontSize: 12, cursor: "pointer" }}>🔄 Nieuw gesprek</button>}
          {expanded && <button onClick={toggleExpand} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #ef4444", background: "#1a0000", color: "#f87171", fontSize: 12, cursor: "pointer" }}>✕ Sluiten</button>}
        </div>
      </div>

      {agentMode && (
        <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <p style={{ color: "#4ade80", fontSize: 12, margin: 0 }}>🤖 <strong>Agent Mode actief</strong> — De Advisor bouwt voort op het gesprek en kan concrete acties voorstellen.</p>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => ask(null, true)} disabled={loading} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #5b21b6", background: "#2d2a5e", color: "#c4b5fd", fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer" }}>{loading ? "⏳..." : "🔍 Volledige Analyse"}</button>
      </div>

      {/* ALL QUESTIONS Panel - Toont VRAAG + ANTWOORD */}
      {showAllQuestions && (
        <div style={{ background: "#1e1e34", border: "1px solid #f59e0b", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: "#fbbf24", fontSize: 14 }}>📋 Alle Gestelde Vragen ({allQuestions.length})</span>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{allQuestions.filter(q => q.resolved).length} opgelost</span>
              <button onClick={() => setAllQuestions(prev => prev.filter(q => !q.resolved))} style={{ fontSize: 10, color: "#ef4444", background: "transparent", border: "1px solid #991b1b", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>🗑️ Opgeloste wissen</button>
            </div>
          </div>
          <div style={{ maxHeight: expanded ? "calc(100vh - 350px)" : 500, overflow: "auto" }}>
            {allQuestions.map(q => (
              <div key={q.id} style={{ padding: 14, marginBottom: 12, background: q.resolved ? "#1a1a2e55" : "#1a1a2e", borderRadius: 10, border: `1px solid ${q.resolved ? "#454d60" : "#f59e0b44"}` }}>
                {/* Header met acties */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: q.type === "agent" ? "#4ade80" : "#a78bfa" }}>{q.type === "agent" ? "🤖 Agent" : "💬 Vraag"}</span>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>{new Date(q.timestamp).toLocaleDateString("nl-BE")} {new Date(q.timestamp).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#454d6055", color: "#9ca3af" }}>{q.device}</span>
                    {q.resolved && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#16653455", color: "#4ade80" }}>✅ Opgelost</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!q.resolved && <button onClick={() => markResolved(q.id)} style={{ fontSize: 10, color: "#4ade80", background: "transparent", border: "1px solid #166534", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>✓ Opgelost</button>}
                    <button onClick={() => deleteTurn(q.id)} style={{ fontSize: 10, color: "#ef4444", background: "transparent", border: "1px solid #991b1b", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>

                {/* VRAAG */}
                <div style={{ background: "#262644", border: "1px solid #312e81", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>👤 Vraag:</div>
                  <div style={{ fontSize: 12, color: "#e5e5e5" }}>{q.question}</div>
                </div>

                {/* ANTWOORD */}
                <div style={{ background: "#1a2640", border: "1px solid #1e40af", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>🤖 Antwoord:</div>
                  <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{q.answer}</div>
                </div>

                {/* Linked tabs */}
                {q.linkedTabs?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>📍 Ga naar:</span>
                    {q.linkedTabs.map(tabId => (
                      <button key={tabId} onClick={() => navigateToTab(tabId)} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: "1px solid #5b21b6", background: "#2d2a5e", color: "#c4b5fd", cursor: "pointer" }}>{tabLabels[tabId]}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Thread - Conversation history */}
      {chatThread.length > 0 && !showAllQuestions && (
        <div style={{ background: "#1e1e34", border: "1px solid #2d2a5e", borderRadius: 10, padding: 16, marginBottom: 16, maxHeight: expanded ? "calc(100vh - 400px)" : 350, overflow: "auto" }}>
          {chatThread.map((turn, idx) => (
            <div key={turn.id} style={{ marginBottom: idx < chatThread.length - 1 ? 16 : 0 }}>
              {/* User question */}
              <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>👤</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>
                      {turn.type === "agent" ? "🤖 Agent" : turn.type === "analysis" ? "🔍 Analyse" : "💬 Vraag"} • {new Date(turn.timestamp).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <button onClick={() => deleteTurn(turn.id)} style={{ fontSize: 9, color: "#ef4444", background: "transparent", border: "none", cursor: "pointer" }}>🗑️</button>
                  </div>
                  <div style={{ background: "#262644", border: "1px solid #312e81", borderRadius: 8, padding: 10, fontSize: 12, color: "#e5e5e5" }}>{turn.question}</div>
                </div>
              </div>
              {/* Advisor response */}
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 16 }}>🤖</span>
                <div style={{ flex: 1 }}>
                  <div style={{ background: "#1a2640", border: "1px solid #1e40af", borderRadius: 8, padding: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{turn.answer}</div>
                  {/* Linked tabs navigation */}
                  {turn.linkedTabs?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#6b7280" }}>📍 Ga naar:</span>
                      {turn.linkedTabs.map(tabId => (
                        <button key={tabId} onClick={() => navigateToTab(tabId)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid #5b21b6", background: "#2d2a5e", color: "#c4b5fd", cursor: "pointer", transition: "background 0.15s, color 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "#312e81"} onMouseLeave={e => e.currentTarget.style.background = "#2d2a5e"}>{tabLabels[tabId]}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input for new/follow-up question */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && question.trim() && (ask(question), setQuestion(""))}
          placeholder={chatThread.length > 0 ? "Stel een vervolgvraag..." : (agentMode ? "Geef een opdracht..." : "Stel een vraag...")}
          style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: `1px solid ${agentMode ? "#166534" : "#454d60"}`, background: "#1e1e30", color: "#e5e5e5", fontSize: 13, outline: "none" }}
        />
        <button onClick={() => { if (question.trim()) { ask(question); setQuestion(""); } }} disabled={loading || !question.trim()} style={{ padding: "12px 24px", borderRadius: 10, border: `1px solid ${agentMode ? "#166534" : "#5b21b6"}`, background: agentMode ? "#052e16" : "#312e81", color: agentMode ? "#4ade80" : "#c4b5fd", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>{loading ? "⏳" : (chatThread.length > 0 ? "Vervolg →" : "Vraag")}</button>
      </div>

      {error && <div style={{ color: "#f87171", fontSize: 12, padding: "10px 0" }}>❌ {error}</div>}

      {/* Saved Sessions Panel */}
      {showHistory && (
        <div style={{ background: "#1e1e34", border: "1px solid #2d2a5e", borderRadius: 10, padding: 16, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: "#a78bfa", fontSize: 14 }}>📜 Opgeslagen Sessies</span>
            <button onClick={clearAllSessions} style={{ fontSize: 11, color: "#ef4444", background: "transparent", border: "1px solid #991b1b", borderRadius: 4, padding: "6px 10px", cursor: "pointer" }}>🗑️ Wis alles</button>
          </div>
          {savedSessions.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 12 }}>Geen opgeslagen sessies. Start een gesprek en klik "Nieuw gesprek" om de huidige sessie op te slaan.</p>
          ) : (
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              {savedSessions.map(session => (
                <div key={session.id} onClick={() => loadSession(session)} style={{ padding: 12, borderBottom: "1px solid #2d3748", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "#1a1a2e"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ color: "#e5e5e5", fontSize: 13 }}>{session.summary}</span>
                      <span style={{ marginLeft: 8, fontSize: 10, color: "#6b7280" }}>({session.turns.length} berichten)</span>
                    </div>
                    <span style={{ color: "#6b7280", fontSize: 11 }}>{new Date(session.timestamp).toLocaleDateString("nl-BE")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V2 TAB: MEMORY CENTER
// ═══════════════════════════════════════════════════════════════════════════════
function MemoryCenter() {
  const { isPhone, S } = useDevice();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [injectForm, setInjectForm] = useState({ project: "general", type: "discovery", title: "", text: "" });

  const searchMemory = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setSearchResults([
        { id: 1, title: "[CHAT] Dashboard deployed to Cloudflare", project: "Claude-Ecosystem-Dashboard", type: "feature", date: "2026-02-06" },
        { id: 2, title: "[CHAT] Privacy regel: altijd privé", project: "general", type: "decision", date: "2026-02-06" },
        { id: 3, title: "[ABSORBED] Multi-Mac Setup", project: "general", type: "discovery", date: "2026-02-06" },
        { id: 4, title: "[BRAIN] Econation context", project: "Econation", type: "discovery", date: "2026-02-05" },
      ].filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.project.toLowerCase().includes(searchQuery.toLowerCase())));
      setLoading(false);
    }, 300);
  };

  useEffect(() => {
    setStats({ total: 40, bySource: { CHAT: 10, CLI: 17, BRAIN: 12, COWORK: 0, SYNC: 1 }, byType: { discovery: 31, decision: 4, feature: 4, change: 1 } });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {stats && (
        <div style={{ background: "#1e1e34", border: "1px solid #2d2a5e", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>🧠 Memory Stats</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ background: "#1a1a2e", padding: "12px 20px", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e" }}>{stats.total}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Total</div>
            </div>
            {Object.entries(stats.bySource).map(([src, count]) => (
              <div key={src} style={{ background: "#1a1a2e", padding: "8px 14px", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: count > 0 ? "#60a5fa" : "#454d60" }}>{count}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>{src}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>🔍 Search Memory</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchMemory()} placeholder="Zoek in observations..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #454d60", background: "#1e1e30", color: "#e5e5e5", fontSize: 13, outline: "none" }} />
          <button onClick={searchMemory} disabled={loading} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #3b82f6", background: "#1e3a8a", color: "#93c5fd", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{loading ? "..." : "Zoek"}</button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {searchResults.map(r => (
              <div key={r.id} style={{ background: "#1a1a2e", border: "1px solid #454d60", borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 13 }}>{r.title}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#22c55e22", color: "#4ade80" }}>{r.project}</span>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#3b82f622", color: "#60a5fa" }}>{r.type}</span>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>{r.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", marginBottom: 12 }}>➕ Quick Inject</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={injectForm.project} onChange={e => setInjectForm({ ...injectForm, project: e.target.value })} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #454d60", background: "#1e1e30", color: "#e5e5e5", fontSize: 12 }}>
              <option value="general">general</option>
              <option value="Claude-Ecosystem-Dashboard">Claude-Ecosystem-Dashboard</option>
              <option value="BlackFuelWhiskey">BlackFuelWhiskey</option>
              <option value="Econation">Econation</option>
            </select>
            <select value={injectForm.type} onChange={e => setInjectForm({ ...injectForm, type: e.target.value })} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #454d60", background: "#1e1e30", color: "#e5e5e5", fontSize: 12 }}>
              <option value="discovery">discovery</option>
              <option value="decision">decision</option>
              <option value="feature">feature</option>
              <option value="bugfix">bugfix</option>
              <option value="change">change</option>
            </select>
          </div>
          <input type="text" value={injectForm.title} onChange={e => setInjectForm({ ...injectForm, title: e.target.value })} placeholder="Titel..." style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #454d60", background: "#1e1e30", color: "#e5e5e5", fontSize: 13, outline: "none" }} />
          <textarea value={injectForm.text} onChange={e => setInjectForm({ ...injectForm, text: e.target.value })} placeholder="Beschrijving..." rows={3} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #454d60", background: "#1e1e30", color: "#e5e5e5", fontSize: 13, outline: "none", resize: "vertical" }} />
          <button style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #166534", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>💾 Inject naar Claude-Mem</button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          SESSIONS ARCHIVE - v3.9.7 ADDITION
          Toont alle actieve Claude Code sessies op deze machine
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <SessionsArchive />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS ARCHIVE COMPONENT - v3.9.7
// Toont alle actieve Claude Code CLI sessies met import mogelijkheid
// ═══════════════════════════════════════════════════════════════════════════════
function SessionsArchive() {
  // Hardcoded session data - wordt later vervangen door live API
  // Data van: 2026-02-06 15:30 MBA scan
  const sessions = [
    { id: "econation", project: "Econation", size: "112M", messages: 3476, date: "2026-02-05", status: "massive", priority: "high", topics: ["website", "cloudflare", "zonnepanelen", "deployment"] },
    { id: "kluizenkerk", project: "Kluizenkerk-Lier", size: "42M", messages: 2058, date: "2026-02-05", status: "large", priority: "medium", topics: ["monument", "website", "history"] },
    { id: "clawdbot", project: "ClawdBot-Rewind", size: "34M", messages: 1077, date: "2026-02-05", status: "large", priority: "high", topics: ["mold bot", "automation", "rewind"] },
    { id: "bfw1", project: "BlackFuelWhiskey", size: "18M", messages: 1953, date: "2026-02-05", status: "large", priority: "high", topics: ["whiskey", "brand", "e-commerce", "WIP2"] },
    { id: "bfw2", project: "BlackFuelWhiskey", size: "15M", messages: 1694, date: "2026-02-06", status: "large", priority: "high", topics: ["whiskey", "brand", "continuation"] },
    { id: "bfw3", project: "BlackFuelWhiskey", size: "1.8M", messages: 421, date: "2026-02-05", status: "medium", priority: "medium", topics: ["whiskey", "updates"] },
    { id: "hrm", project: "HRM-Core-Brain", size: "14M", messages: 2692, date: "2026-02-06", status: "large", priority: "critical", topics: ["HRM v2.1", "SDK", "model", "Mac mini setup"] },
    { id: "sdk", project: "Sapienthinc-HRM-SDK-1", size: "412K", messages: 66, date: "2026-02-06", status: "small", priority: "medium", topics: ["SDK", "transfer"] },
    { id: "claude-sdk", project: "Claude-Code-SDK", size: "300K", messages: 83, date: "2026-02-05", status: "small", priority: "medium", topics: ["SDK", "claude", "tools"] },
    { id: "claude-mem", project: "Claude-MEM-start", size: "388K", messages: 243, date: "2026-02-06", status: "active", priority: "critical", topics: ["memory", "install", "activation", "DEZE SESSIE"] },
    { id: "autoclaude", project: "AutoClaude-Test-1", size: "1.4M", messages: 191, date: "2026-01-25", status: "archived", priority: "low", topics: ["testing", "automation"] },
  ];

  const totalSize = "~240MB";
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages, 0);

  const statusColors = {
    massive: { bg: "#1a0000", border: "#991b1b", color: "#ef4444" },
    large: { bg: "#1a1400", border: "#854d0e", color: "#f59e0b" },
    medium: { bg: "#001a33", border: "#1e40af", color: "#60a5fa" },
    small: { bg: "#0f0f23", border: "#454d60", color: "#9ca3af" },
    active: { bg: "#052e16", border: "#166534", color: "#4ade80" },
    archived: { bg: "#111", border: "#454d60", color: "#6b7280" },
  };

  const priorityColors = {
    critical: "#ef4444",
    high: "#f59e0b",
    medium: "#60a5fa",
    low: "#6b7280",
  };

  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #5b21b6", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", display: "flex", alignItems: "center", gap: 8 }}>
            <span>📚</span> Active Sessions Archive
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#5b21b622", color: "#a78bfa" }}>v3.9.7</span>
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
            {sessions.length} sessies • {totalMessages.toLocaleString()} berichten • {totalSize} totaal
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #166534", background: "#052e16", color: "#4ade80", fontSize: 11, cursor: "pointer" }}>
            🔄 Refresh
          </button>
          <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #854d0e", background: "#1a1400", color: "#fbbf24", fontSize: 11, cursor: "pointer" }}>
            📥 Export All
          </button>
        </div>
      </div>

      {/* Warning banner */}
      <div style={{ background: "#1a1400", border: "1px solid #854d0e", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ color: "#fbbf24", fontSize: 12, fontWeight: 600 }}>⚠️ BELANGRIJK: Deze sessies bevatten kritieke project informatie!</div>
        <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>
          HRM v2.1 • Mac Mini setup • ClawdBot • BlackFuel WIP2 • Alle technische beslissingen
        </div>
        <div style={{ color: "#6b7280", fontSize: 10, marginTop: 4 }}>
          💡 Tip: Gebruik session-absorber.py om sessies naar claude-mem te importeren
        </div>
      </div>

      {/* Sessions grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.map(session => {
          const sc = statusColors[session.status] || statusColors.small;
          return (
            <div key={session.id} style={{
              background: sc.bg,
              border: `1px solid ${sc.border}`,
              borderRadius: 8,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: priorityColors[session.priority]
                  }} />
                  <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 13 }}>
                    {session.project}
                  </span>
                  {session.status === "active" && (
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#4ade8022", color: "#4ade80", animation: "pulse 2s infinite" }}>
                      ● LIVE
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {session.topics.slice(0, 4).map((topic, i) => (
                    <span key={i} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#2d3748", color: "#9ca3af" }}>
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: sc.color, fontSize: 14, fontWeight: 700 }}>{session.size}</div>
                  <div style={{ color: "#6b7280", fontSize: 10 }}>{session.messages.toLocaleString()} msgs</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#9ca3af", fontSize: 11 }}>{session.date}</div>
                  <div style={{ color: "#4b5563", fontSize: 9 }}>{session.status}</div>
                </div>
                <button style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #454d60",
                  background: "#1a1a2e",
                  color: "#93c5fd",
                  fontSize: 10,
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}>
                  📥 Absorb
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CLI Commands reference */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 8, padding: 12, marginTop: 16 }}>
        <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 8 }}>🖥️ CLI Commands</div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#4ade80", lineHeight: 1.8 }}>
          <div># Absorbeer sessie van clipboard:</div>
          <div style={{ color: "#93c5fd" }}>python3 ~/Projects/Claude-Ecosystem-Dashboard/bridge/session-absorber.py --from-clipboard --project "ProjectNaam"</div>
          <div style={{ marginTop: 8 }}># Bekijk memory stats:</div>
          <div style={{ color: "#93c5fd" }}>python3 ~/Projects/Claude-Ecosystem-Dashboard/bridge/claude-mem-bridge.py stats</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V2 TAB: GIT & DEPLOY CENTER
// ═══════════════════════════════════════════════════════════════════════════════
function GitDeployCenter() {
  const { isPhone, S } = useDevice();
  const [repos] = useState([
    { name: "Claude-Ecosystem-Dashboard", status: "clean", branch: "main", lastPush: "now", cloudflare: "claude-ecosystem-dashboard.pages.dev" },
    { name: "Claude-Code-Mac-Sync", status: "clean", branch: "main", lastPush: "1 day ago", cloudflare: null },
    { name: "Econation", status: "dirty", branch: "main", lastPush: "3 days ago", dirtyFiles: 10, cloudflare: null },
    { name: "BlackFuelWhiskey", status: "clean", branch: "main", lastPush: "5 days ago", cloudflare: "blackfuel-whiskey.franky-f29.workers.dev" },
    { name: "HRM-Core-Brain", status: "dirty", branch: "main", lastPush: "1 week ago", dirtyFiles: 4, cloudflare: null },
  ]);
  const [actionLog, setActionLog] = useState([]);
  const addLog = (msg) => setActionLog(prev => [{ time: new Date().toLocaleTimeString(), msg }, ...prev].slice(0, 20));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {repos.map(repo => (
          <div key={repo.name} style={{ background: repo.status === "dirty" ? "#1a1400" : "#0f0f0f", border: `1px solid ${repo.status === "dirty" ? "#854d0e" : "#2d3748"}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#e5e5e5" }}>📂 {repo.name}</div>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: repo.status === "clean" ? "#22c55e22" : "#f59e0b22", color: repo.status === "clean" ? "#4ade80" : "#fbbf24" }}>{repo.status === "clean" ? "✓ clean" : `⚠ ${repo.dirtyFiles} dirty`}</span>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>🌿 {repo.branch} • ⏱️ {repo.lastPush}</div>
            {repo.cloudflare && <div style={{ fontSize: 11, color: "#06b6d4", marginBottom: 8 }}>☁️ <a href={`https://${repo.cloudflare}`} target="_blank" rel="noopener noreferrer" style={{ color: "#06b6d4" }}>{repo.cloudflare}</a></div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => addLog(`🔽 git pull ${repo.name}`)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #454d60", background: "#1a1a2e", color: "#93c5fd", fontSize: 11, cursor: "pointer" }}>🔽 Pull</button>
              <button onClick={() => addLog(`🔼 git push ${repo.name}`)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #454d60", background: "#1a1a2e", color: "#93c5fd", fontSize: 11, cursor: "pointer" }}>🔼 Push</button>
              {repo.cloudflare && <button onClick={() => addLog(`☁️ Deploy ${repo.name}`)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #0e7490", background: "#001a1a", color: "#22d3ee", fontSize: 11, cursor: "pointer" }}>☁️ Deploy</button>}
            </div>
          </div>
        ))}
      </div>
      {actionLog.length > 0 && (
        <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>📋 Action Log</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af", maxHeight: 150, overflow: "auto" }}>
            {actionLog.map((log, i) => <div key={i}><span style={{ color: "#4b5563" }}>{log.time}</span> {log.msg}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V2 TAB: VERSION SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════════════
function VersionSnapshots() {
  const { isPhone, S } = useDevice();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSnapshot, setNewSnapshot] = useState({ name: "", project: "Claude-Ecosystem-Dashboard" });

  const fetchSnapshots = useCallback(async () => {
    try {
      const data = await api.getSnapshots();
      setSnapshots(data);
    } catch (e) { console.error("Failed to load snapshots:", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  const createSnapshot = async () => {
    if (!newSnapshot.name.trim()) return;
    const result = await api.createSnapshot(newSnapshot.name, newSnapshot.project, "manual");
    if (result?.success) {
      setNewSnapshot({ ...newSnapshot, name: "" });
      fetchSnapshots();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#1e1e34", border: "1px solid #2d2a5e", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>📸 Create Snapshot</div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={newSnapshot.project} onChange={e => setNewSnapshot({ ...newSnapshot, project: e.target.value })} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #454d60", background: "#1e1e30", color: "#e5e5e5", fontSize: 12 }}>
            <option>Claude-Ecosystem-Dashboard</option>
            <option>BlackFuelWhiskey</option>
            <option>Econation</option>
          </select>
          <input type="text" value={newSnapshot.name} onChange={e => setNewSnapshot({ ...newSnapshot, name: e.target.value })} placeholder="Snapshot naam (bv: v1.2.0 - Feature X)" style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #454d60", background: "#1e1e30", color: "#e5e5e5", fontSize: 13, outline: "none" }} />
          <button onClick={createSnapshot} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #5b21b6", background: "#2d2a5e", color: "#c4b5fd", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📸 Save</button>
        </div>
      </div>
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>🕐 Snapshot History</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>⏳ Laden...</div>
          ) : snapshots.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>Nog geen snapshots</div>
          ) : snapshots.map(snap => {
            const d = snap.timestamp ? new Date(snap.timestamp).toLocaleString("nl-BE") : snap.date || "?";
            return (
              <div key={snap.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1a2e", border: "1px solid #454d60", borderRadius: 8, padding: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ minWidth: 150 }}>
                  <div style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 13 }}>{snap.name}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>{d}</span>
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#22c55e22", color: "#4ade80" }}>{snap.project}</span>
                    {snap.commit && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#3b82f622", color: "#60a5fa", fontFamily: "monospace" }}>{snap.commit}</span>}
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: snap.type === "auto" ? "#f59e0b22" : "#8b5cf622", color: snap.type === "auto" ? "#fbbf24" : "#c4b5fd" }}>{snap.type}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #166534", background: "#052e16", color: "#4ade80", fontSize: 11, cursor: "pointer" }}>🔄 Restore</button>
                  <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #454d60", background: "#1a1a2e", color: "#9ca3af", fontSize: 11, cursor: "pointer" }}>👁️ View</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V2 TAB: ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════════
function ActivityLog() {
  const { isPhone, S } = useDevice();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  
  const fetchLogs = useCallback(async () => {
    try {
      const logs = await api.getLogs(50);
      setActivities(logs);
    } catch (e) { console.error("Failed to load logs:", e); }
    finally { setLoading(false); }
  }, []);
  
  useEffect(() => { fetchLogs(); const interval = setInterval(fetchLogs, 15000); return () => clearInterval(interval); }, [fetchLogs]);
  
  const typeColors = { change: { bg: "#22c55e22", color: "#4ade80" }, deploy: { bg: "#06b6d422", color: "#22d3ee" }, git: { bg: "#a78bfa22", color: "#c4b5fd" }, file: { bg: "#3b82f622", color: "#60a5fa" }, config: { bg: "#f59e0b22", color: "#fbbf24" }, session: { bg: "#ec489922", color: "#f472b6" }, memory: { bg: "#8b5cf622", color: "#a78bfa" }, snapshot: { bg: "#8b5cf622", color: "#a78bfa" }, ai_request: { bg: "#a78bfa22", color: "#c4b5fd" }, ai_response: { bg: "#a78bfa22", color: "#c4b5fd" }, action: { bg: "#3b82f622", color: "#60a5fa" }, restore: { bg: "#f59e0b22", color: "#fbbf24" } };
  const filtered = filter === "All" ? activities : activities.filter(a => a.source === filter);

  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f472b6" }}>📜 Activity Log</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={fetchLogs} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #454d60", background: "#1e1e30", color: "#6b7280", fontSize: 11, cursor: "pointer" }}>🔄</button>
          {["All", "Chat", "CLI", "Dashboard"].map(f => <button key={f} onClick={() => setFilter(f)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #454d60", background: filter === f ? "#2d2a5e" : "#111", color: filter === f ? "#c4b5fd" : "#6b7280", fontSize: 11, cursor: "pointer" }}>{f}</button>)}
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>⏳ Laden...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>Geen activiteiten gevonden</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(act => {
            const t = act.timestamp ? new Date(act.timestamp) : null;
            const time = t ? t.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" }) : "??:??";
            const tc = typeColors[act.type] || { bg: "#454d6022", color: "#9ca3af" };
            return (
              <div key={act.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1a2e", border: "1px solid #454d60", borderRadius: 8, padding: "10px 12px", flexWrap: "wrap" }}>
                <div style={{ fontSize: 11, color: "#4b5563", fontFamily: "monospace", minWidth: 45 }}>{time}</div>
                <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: act.source === "Chat" ? "#3b82f622" : act.source === "Dashboard" ? "#a78bfa22" : "#22c55e22", color: act.source === "Chat" ? "#60a5fa" : act.source === "Dashboard" ? "#c4b5fd" : "#4ade80", minWidth: 50, textAlign: "center" }}>{act.source || "?"}</div>
                {act.mac && <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#2d3748", color: "#9ca3af", minWidth: 30, textAlign: "center" }}>{act.mac}</div>}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{act.action}</span>
                  {act.detail && <span style={{ color: "#6b7280", fontSize: 12 }}> — {act.detail}</span>}
                </div>
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, ...tc }}>{act.type}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V2 TAB: STAGING & VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════
function StagingVariants() {
  const { isPhone, S } = useDevice();
  const [projects] = useState([
    { name: "Claude-Ecosystem-Dashboard", production: "claude-ecosystem-dashboard.pages.dev", staging: "claude-ecosystem-staging.pages.dev", variants: [] },
    { name: "Econation", production: "econation.be", staging: "econation-b-dev.franky-f29.workers.dev", variants: [] },
    { name: "BlackFuelWhiskey", production: "blackfuelwhiskey.com", staging: "blackfuel-whiskey.franky-f29.workers.dev", variants: [] },
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {projects.map(proj => (
        <div key={proj.name} style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e5e5e5" }}>🌐 {proj.name}</div>
            <button style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #0e7490", background: "#001a1a", color: "#22d3ee", fontSize: 11, cursor: "pointer" }}>➕ Create Staging</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div style={{ background: proj.production ? "#052e16" : "#1a1a1a", border: `1px solid ${proj.production ? "#166534" : "#454d60"}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: proj.production ? "#4ade80" : "#6b7280", fontWeight: 600, marginBottom: 4 }}>{proj.production ? "🟢 PRODUCTION" : "⚫ PRODUCTION"}</div>
              {proj.production ? (
                <a href={`https://${proj.production}`} target="_blank" rel="noopener noreferrer" style={{ color: "#86efac", fontSize: 12, wordBreak: "break-all" }}>{proj.production}</a>
              ) : (
                <span style={{ color: "#6b7280", fontSize: 13, fontStyle: "italic" }}>Not deployed</span>
              )}
            </div>
            <div style={{ background: proj.staging ? "#1a1400" : "#1a1a1a", border: `1px solid ${proj.staging ? "#854d0e" : "#454d60"}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: proj.staging ? "#fbbf24" : "#6b7280", fontWeight: 600, marginBottom: 4 }}>{proj.staging ? "🟡 STAGING" : "⚫ STAGING"}</div>
              {proj.staging ? (
                <a href={`https://${proj.staging}`} target="_blank" rel="noopener noreferrer" style={{ color: "#fde68a", fontSize: 12, wordBreak: "break-all" }}>{proj.staging}</a>
              ) : (
                <span style={{ color: "#6b7280", fontSize: 13, fontStyle: "italic" }}>Not deployed</span>
              )}
            </div>
          </div>
          {proj.variants.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Variants for Client Preview:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {proj.variants.map(v => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1a2e", border: "1px solid #454d60", borderRadius: 8, padding: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 13 }}>{v.name}</div>
                      <a href={`https://${v.url}`} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: 11 }}>{v.url}</a>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: v.status === "ready" ? "#22c55e22" : "#f59e0b22", color: v.status === "ready" ? "#4ade80" : "#fbbf24" }}>{v.status}</span>
                      <button style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #166534", background: "#052e16", color: "#4ade80", fontSize: 10, cursor: "pointer" }}>🚀 Promote</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V3.1 TAB: CROSS-DEVICE SYNC STATUS
// ═══════════════════════════════════════════════════════════════════════════════
function CrossDeviceSync() {
  const { isPhone, S } = useDevice();
  const [devices] = useState([
    { id: "mba", name: "MacBook Air", type: "💻", lastSync: new Date(), memoryVersion: "2026-02-06T12:00:00", pendingUpdates: 0, isOnline: true, lastActivity: "SDK-HRM InfraNodus analyse" },
    { id: "mm4", name: "Mac Mini (MM4)", type: "🖥️", lastSync: new Date(Date.now() - 1000 * 60 * 60 * 2), memoryVersion: "2026-02-06T09:30:00", pendingUpdates: 3, isOnline: true, lastActivity: "SDK-HRM Training prep" },
    { id: "iphone", name: "iPhone (Voice)", type: "📱", lastSync: null, memoryVersion: null, pendingUpdates: 5, isOnline: false, lastActivity: null },
  ]);
  const [pendingActions] = useState([
    { from: "MacBook Air", to: "Mac Mini (MM4)", type: "memory", description: "MEMORY.json update met SDK-HRM entities" },
    { from: "MacBook Air", to: "Mac Mini (MM4)", type: "learnings", description: "FRANKY-LEARNINGS.md nieuwe inzichten" },
    { from: "MacBook Air", to: "Mac Mini (MM4)", type: "session", description: "SESSION-BACKLOG.md update" },
  ]);

  const formatTimeAgo = (date) => {
    if (!date) return "Nooit";
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Zojuist";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m geleden`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours}u geleden` : `${Math.floor(hours / 24)}d geleden`;
  };

  const totalPending = devices.reduce((sum, d) => sum + d.pendingUpdates, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Alert */}
      {totalPending > 0 && (
        <div style={{ background: "#1a1400", border: "1px solid #854d0e", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontWeight: 700, color: "#fbbf24" }}>{totalPending} pending updates</span>
          </div>
          <p style={{ color: "#fde68a", fontSize: 12, marginTop: 6, opacity: 0.8 }}>Er zijn wijzigingen die nog niet gesynchroniseerd zijn naar alle devices.</p>
        </div>
      )}

      {/* Device Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {devices.map((device) => (
          <div key={device.id} style={{ background: "#1a1a2e", border: `1px solid ${device.isOnline ? (device.pendingUpdates > 0 ? "#854d0e" : "#166534") : "#454d60"}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{device.type}</span>
                <span style={{ fontWeight: 700, color: "#e5e5e5", fontSize: 14 }}>{device.name}</span>
              </div>
              <span style={{ color: device.isOnline ? "#4ade80" : "#6b7280" }}>{device.isOnline ? "●" : "○"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Laatste sync:</span>
                <span style={{ color: device.lastSync ? "#e5e5e5" : "#6b7280" }}>{formatTimeAgo(device.lastSync)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Pending:</span>
                <span style={{ color: device.pendingUpdates > 0 ? "#fbbf24" : "#4ade80", fontWeight: 600 }}>{device.pendingUpdates} updates</span>
              </div>
              {device.lastActivity && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #2d3748" }}>
                  <span style={{ color: "#4b5563", fontSize: 10 }}>Laatste activiteit:</span>
                  <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>{device.lastActivity}</p>
                </div>
              )}
            </div>
            {device.pendingUpdates > 0 && device.isOnline && (
              <button style={{ marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 8, border: "1px solid #3b82f6", background: "#1e3a8a", color: "#93c5fd", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sync Nu</button>
            )}
          </div>
        ))}
      </div>

      {/* Pending Actions */}
      {pendingActions.length > 0 && (
        <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span>🕐</span> Te Synchroniseren
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingActions.map((action, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a1a2e", borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 14 }}>{action.type === "memory" ? "💾" : action.type === "learnings" ? "📚" : "📝"}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#e5e5e5", fontSize: 12 }}>{action.description}</p>
                  <p style={{ color: "#6b7280", fontSize: 10 }}>{action.from} → {action.to}</p>
                </div>
                <button style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #3b82f6", background: "transparent", color: "#60a5fa", fontSize: 11, cursor: "pointer" }}>Push</button>
              </div>
            ))}
          </div>
          <button style={{ marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 8, border: "1px solid #166534", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🔄 Synchroniseer Alles naar MM4</button>
        </div>
      )}

      {/* Info */}
      <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
        <p><strong>Sync Methode:</strong> iCloud (~/.claude/) + GitHub (project repos)</p>
        <p style={{ marginTop: 4 }}><strong>Verplichte bestanden:</strong> MEMORY.json, FRANKY-LEARNINGS.md, SESSION-BACKLOG.md</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V3.1 TAB: INFRANODUS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function InfraNodusDashboard() {
  const { isPhone, S } = useDevice();
  const [filter, setFilter] = useState("all");
  const graphs = [
    { name: "SDK-HRM-vision", type: "STANDARD", date: "6 Feb", cat: "core", tags: ["Leerkurve", "Per-contact"] },
    { name: "SDK-HRM-fraud_protection", type: "STANDARD", date: "6 Feb", cat: "core", tags: ["Real-time", "Wearable"] },
    { name: "SDK-HRM-email_guardian", type: "STANDARD", date: "6 Feb", cat: "core", tags: ["BEC", "Impersonation"] },
    { name: "SDK-HRM-revenue_model", type: "STANDARD", date: "6 Feb", cat: "core", tags: ["White-label", "API-first"] },
    { name: "SDK-HRM-website_monitoring", type: "STANDARD", date: "6 Feb", cat: "core", tags: ["Phishing", "Clone"] },
    { name: "SDK-HRM-mobile_agent", type: "STANDARD", date: "6 Feb", cat: "core", tags: ["SMS", "Call screening"] },
    { name: "SDK-HRM-franky-vision", type: "STANDARD", date: "6 Feb", cat: "vision", tags: ["Product vision"] },
    { name: "SDK-HRM-roadmap-gaps", type: "STANDARD", date: "6 Feb", cat: "vision", tags: ["Content gaps"] },
    { name: "SDK-HRM-training-priorities", type: "STANDARD", date: "6 Feb", cat: "training", tags: ["Prioriteiten"] },
    { name: "SDK-HRM-scam-patterns-v2", type: "STANDARD", date: "6 Feb", cat: "training", tags: ["Scam patronen"] },
    { name: "SDK-HRM-model-comparison", type: "STANDARD", date: "7 Feb", cat: "model", tags: ["LFM2", "HRM-27M"] },
    { name: "SDK-HRM-nested-architecture", type: "STANDARD", date: "7 Feb", cat: "model", tags: ["Nested", "Phase 1"] },
    { name: "SDK-HRM-model-security", type: "STANDARD", date: "7 Feb", cat: "security", tags: ["Model security"] },
    { name: "SDK-HRM-blockchain-trust", type: "STANDARD", date: "7 Feb", cat: "security", tags: ["Blockchain"] },
    { name: "SDK-HRM-embedded-market", type: "STANDARD", date: "7 Feb", cat: "market", tags: ["Embedded SDK"] },
    { name: "SDK-HRM-crypto-security", type: "STANDARD", date: "7 Feb", cat: "security", tags: ["Crypto scams"] },
    { name: "SDK-HRM-full-product-map", type: "STANDARD", date: "7 Feb", cat: "vision", tags: ["Product map"] },
    { name: "SDK-HRM-website-guardian", type: "STANDARD", date: "7 Feb", cat: "core", tags: ["GDPR", "Guardian"] },
    { name: "SDK-HRM-voice-visual-shield", type: "STANDARD", date: "7 Feb", cat: "core", tags: ["Voice", "Visual"] },
    { name: "sdk-hrm-finance-strategy", type: "STANDARD", date: "7 Feb", cat: "market", tags: ["Finance"] },
    { name: "sdk-hrm-session-log", type: "MEMORY", date: "7 Feb", cat: "memory", tags: ["Session log"] },
    { name: "sdk-hrm-franky-vision", type: "MEMORY", date: "7 Feb", cat: "memory", tags: ["Franky brain"] },
  ];

  const catColors = { core: "#a78bfa", vision: "#60a5fa", training: "#f97316", model: "#22c55e", security: "#ef4444", market: "#fbbf24", memory: "#f472b6" };
  const catLabels = { core: "Core Product", vision: "Visie & Strategie", training: "Training Data", model: "Model Architectuur", security: "Security & Crypto", market: "Markt & Revenue", memory: "Memory / Sessies" };
  const cats = [...new Set(graphs.map(g => g.cat))];
  const filtered = filter === "all" ? graphs : graphs.filter(g => g.cat === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ background: "#1e1e34", border: "1px solid #5b21b6", borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 90 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#a78bfa" }}>{graphs.length}</div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Graphs</div>
        </div>
        <div style={{ background: "#1e1e34", border: "1px solid #166534", borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 90 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#4ade80" }}>{cats.length}</div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Categorieën</div>
        </div>
        <div style={{ background: "#1e1e34", border: "1px solid #854d0e", borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 90 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fbbf24" }}>{graphs.filter(g => g.type === "MEMORY").length}</div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Memory Graphs</div>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={() => setFilter("all")} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${filter === "all" ? "#a78bfa" : "#454d60"}`, background: filter === "all" ? "#5b21b622" : "#111", color: filter === "all" ? "#c4b5fd" : "#6b7280", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Alle ({graphs.length})</button>
        {cats.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${filter === cat ? catColors[cat] : "#454d60"}`, background: filter === cat ? catColors[cat] + "22" : "#111", color: filter === cat ? catColors[cat] : "#6b7280", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>{catLabels[cat]} ({graphs.filter(g => g.cat === cat).length})</button>
        ))}
      </div>

      {/* Graphs grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {filtered.map(g => (
          <a key={g.name + g.type} href={`https://infranodus.com/Franky-DSVD/${g.name}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ background: "#1a1a2e", border: `1px solid ${catColors[g.cat]}33`, borderRadius: 10, padding: 12, cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = catColors[g.cat]}
              onMouseLeave={e => e.currentTarget.style.borderColor = catColors[g.cat] + "33"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 11, color: "#c4b5fd", lineHeight: 1.3 }}>{g.name}</span>
                <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 4, background: g.type === "MEMORY" ? "#f472b622" : "#5b21b622", color: g.type === "MEMORY" ? "#f472b6" : "#a78bfa", flexShrink: 0 }}>{g.type}</span>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                {g.tags.map((t, i) => <span key={i} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: catColors[g.cat] + "15", color: catColors[g.cat] }}>{t}</span>)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "#6b7280" }}>{g.date} 2026</span>
                <span style={{ fontSize: 9, color: catColors[g.cat] }}>↗ Open</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V3.1 TAB: SYSTEM KNOWLEDGE BASE (Backup voor als claude-mem niet beschikbaar is)
// Dit is de CENTRALE WAARHEID - onafhankelijk van externe memory systemen
// ═══════════════════════════════════════════════════════════════════════════════
function SystemKnowledgeBase() {
  const { isPhone, S } = useDevice();
  // KRITIEKE REGELS - NOOIT VERGETEN
  const kritiekRegels = [
    { id: "r1", regel: "Cloud Control Center LOCATIE", waarde: "/Users/franky13m3/Projects/Claude-Ecosystem-Dashboard/", type: "path", prioriteit: "critical" },
    { id: "r2", regel: "NOOIT nieuw project maken voor features", waarde: "Altijd TOEVOEGEN aan bestaande codebase", type: "regel", prioriteit: "critical" },
    { id: "r3", regel: "ALLES loggen en backuppen", waarde: "7000x herhaald - nu PERMANENT", type: "regel", prioriteit: "critical" },
    { id: "r4", regel: "SDK-HRM Model grootte", waarde: "6.4M parameters (NIET 27M!)", type: "feit", prioriteit: "critical" },
    { id: "r5", regel: "Leerkurve filosofie", waarde: "4-8 weken innestelen voordat model oordeelt", type: "concept", prioriteit: "high" },
    { id: "r6", regel: "Email spam analyse", waarde: "WACHT - Franky moet eerst inbox reviewen", type: "status", prioriteit: "warning" },
  ];

  // PROJECTEN & LOCATIES
  const projectLocaties = [
    { naam: "HRM-Core-Brain", path: "/Users/franky13m3/Projects/HRM-Core-Brain/", github: "DS2036/HRM-Core-Brain", status: "active" },
    { naam: "HRM-TRANSFER-PACKAGE", path: "/Users/franky13m3/Projects/HRM-TRANSFER-PACKAGE/", github: "DS2036/HRM-TRANSFER-PACKAGE", status: "active" },
    { naam: "Claude-Ecosystem-Dashboard", path: "/Users/franky13m3/Projects/Claude-Ecosystem-Dashboard/", github: "DS2036/Claude-Ecosystem-Dashboard", status: "active" },
    { naam: "Sapienthinc-HRM-SDK-1", path: "/Users/franky13m3/Projects/Sapienthinc-HRM-SDK-1/", github: "DS2036/Sapienthinc-HRM-SDK-1", status: "active" },
  ];

  // DEVICES
  const devices = [
    { naam: "MacBook Air", id: "MBA", role: "Primair development", status: "online" },
    { naam: "Mac Mini M4", id: "MM4", role: "Training & compute", status: "pending setup" },
    { naam: "Mac Mini M2", id: "MM2", role: "Backup/secondary", status: "pending setup" },
    { naam: "iPhone", id: "iPhone", role: "Voice input in wagen", status: "planned" },
  ];

  // SYNC BESTANDEN (VERPLICHT bij elke sessie)
  const syncBestanden = [
    { naam: "MEMORY.json", locatie: "~/.claude/MEMORY.json", doel: "Globale entities en relaties" },
    { naam: "FRANKY-LEARNINGS.md", locatie: "[PROJECT]/FRANKY-LEARNINGS.md", doel: "Permanente lessen per project" },
    { naam: "SESSION-BACKLOG.md", locatie: "[PROJECT]/SESSION-BACKLOG.md", doel: "Sessie logs en beslissingen" },
    { naam: "SYNC-PROTOCOL.md", locatie: "~/.claude/SYNC-PROTOCOL.md", doel: "Cross-device sync instructies" },
  ];

  // BESLISSINGEN LOG
  const [beslissingen] = useState([
    { datum: "2026-02-06 12:00", beslissing: "3 nieuwe tabs toegevoegd aan Cloud Control Center", reden: "Cross-Sync, InfraNodus, Agents nodig voor overzicht" },
    { datum: "2026-02-06 11:45", beslissing: "FRANKY-LEARNINGS.md bijgewerkt met permanente regels", reden: "7000x herhaald - nu PERMANENT vastgelegd" },
    { datum: "2026-02-06 10:30", beslissing: "InfraNodus competitor analyse uitgevoerd", reden: "8 nieuwe features gevonden die concurrenten hebben" },
    { datum: "2026-02-06 10:00", beslissing: "SDK-HRM model geanalyseerd: 6.4M params", reden: "Transfer naar MM4 voorbereiden" },
  ]);

  const prioriteitKleuren = { critical: { bg: "#1a0000", border: "#991b1b", color: "#ef4444" }, high: { bg: "#1a1400", border: "#854d0e", color: "#fbbf24" }, warning: { bg: "#1a1400", border: "#854d0e", color: "#f59e0b" }, info: { bg: "#001a33", border: "#1e40af", color: "#60a5fa" } };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f0f23, #1a0a2e)", border: "1px solid #5b21b6", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 800, color: "#a78bfa", fontSize: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <span>🧠</span> System Knowledge Base
        </div>
        <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>Centrale waarheid - backup voor als claude-mem niet beschikbaar is</p>
        <p style={{ color: "#6b7280", fontSize: 10, marginTop: 4 }}>Dit bestand synchroniseert naar alle devices via Git</p>
      </div>

      {/* KRITIEKE REGELS */}
      <div style={{ background: "#1a1a2e", border: "1px solid #991b1b", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#ef4444", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🚨</span> KRITIEKE REGELS (NOOIT VERGETEN)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {kritiekRegels.map(r => {
            const pk = prioriteitKleuren[r.prioriteit] || prioriteitKleuren.info;
            return (
              <div key={r.id} style={{ background: pk.bg, border: `1px solid ${pk.border}`, borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontWeight: 700, color: pk.color, fontSize: 12 }}>{r.regel}</span>
                    <p style={{ color: "#e5e5e5", fontSize: 11, marginTop: 4 }}>{r.waarde}</p>
                  </div>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${pk.color}22`, color: pk.color }}>{r.type}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SYNC BESTANDEN */}
      <div style={{ background: "#1a1a2e", border: "1px solid #166534", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#4ade80", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📁</span> VERPLICHTE SYNC BESTANDEN (elke sessie lezen!)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
          {syncBestanden.map((b, idx) => (
            <div key={idx} style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 600, color: "#4ade80", fontSize: 12 }}>{b.naam}</div>
              <div style={{ color: "#86efac", fontSize: 10, fontFamily: "monospace", marginTop: 4 }}>{b.locatie}</div>
              <div style={{ color: "#6b7280", fontSize: 10, marginTop: 4 }}>{b.doel}</div>
            </div>
          ))}
        </div>
      </div>

      {/* DEVICES */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🖥️</span> DEVICES & ROLLEN
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {devices.map((d, idx) => (
            <div key={idx} style={{ background: "#1a1a2e", border: "1px solid #454d60", borderRadius: 8, padding: 10, minWidth: 140 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.status === "online" ? "#4ade80" : d.status === "pending setup" ? "#fbbf24" : "#6b7280" }} />
                <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{d.naam}</span>
              </div>
              <div style={{ color: "#6b7280", fontSize: 10, marginTop: 4 }}>{d.role}</div>
              <div style={{ color: "#4b5563", fontSize: 9, marginTop: 2 }}>{d.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PROJECT LOCATIES */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📂</span> ACTIEVE PROJECTEN
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {projectLocaties.map((p, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1a2e", borderRadius: 8, padding: 10 }}>
              <div>
                <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{p.naam}</span>
                <div style={{ color: "#6b7280", fontSize: 10, fontFamily: "monospace" }}>{p.path}</div>
              </div>
              <a href={`https://github.com/${p.github}`} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: 10, textDecoration: "none" }}>GitHub ↗</a>
            </div>
          ))}
        </div>
      </div>

      {/* BESLISSINGEN LOG */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📋</span> RECENTE BESLISSINGEN
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {beslissingen.map((b, idx) => (
            <div key={idx} style={{ background: "#1a1a2e", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{b.beslissing}</span>
                <span style={{ color: "#6b7280", fontSize: 10, whiteSpace: "nowrap" }}>{b.datum}</span>
              </div>
              <p style={{ color: "#9ca3af", fontSize: 10, marginTop: 4 }}>Reden: {b.reden}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SDK-HRM TRAINING & STRATEGIE (7 Feb 2026 — MM4 Training Sessie) */}
      <div style={{ background: "#1a1a2e", border: "1px solid #f97316", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#f97316", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🧠</span> SDK-HRM TRAINING & STRATEGIE (7 Feb 2026 — MM4)
        </div>

        {/* Model Overview */}
        <div style={{ background: "#1a0a00", border: "1px solid #9a3412", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#fb923c", fontSize: 13, marginBottom: 8 }}>Sapient-HRM 27.3M — ARC Training op Mac Mini M4</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 6 }}>
            {[
              { label: "Parameters", value: "27.3M", color: "#f97316" },
              { label: "Architectuur", value: "ACT+HRM", color: "#a78bfa" },
              { label: "Device", value: "MPS M4", color: "#60a5fa" },
              { label: "Speed", value: "~1.76s/step", color: "#22c55e" },
              { label: "Checkpoint", value: "elke 100", color: "#f472b6" },
              { label: "Talen", value: "NL/FR/EN", color: "#06b6d4" },
              { label: "Domeinen", value: "66", color: "#fbbf24" },
              { label: "Target", value: "1.05M samples", color: "#ef4444" },
            ].map(m => (
              <div key={m.label} style={{ background: "#1e1e30", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 8, color: "#6b7280" }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Nested Architecture */}
        <div style={{ background: "#1a1a2e", border: "1px solid #312e81", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#a78bfa", fontSize: 12, marginBottom: 8 }}>Nested Architecture — HRM inside LFM2</div>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#c4b5fd", lineHeight: 1.6 }}>
            <div style={{ color: "#60a5fa" }}>LFM2-2.6B (body) — 2560-dim, ~5GB</div>
            <div>{"    ↓ (1000 tokens)"}</div>
            <div style={{ color: "#f59e0b" }}>DeepEncoder Bridge — 2560→512dim, 1000→50 tokens (97% info)</div>
            <div>{"    ↓ (50 tokens)"}</div>
            <div style={{ color: "#f97316" }}>HRM-27M (brain) — 512-dim, ~1GB → risk_score + uitleg</div>
            <div style={{ color: "#22c55e", marginTop: 4 }}>Totaal: 6.5GB (past op 16GB Mac Mini)</div>
          </div>
        </div>

        {/* 18 Modules */}
        <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#4ade80", fontSize: 12, marginBottom: 8 }}>18 Beschermingsmodules</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["Email Guardian", "Website Guardian", "Call Shield", "Mobile Agent", "Elderly Guardian", "Wearable Shield", "Social Graph", "QR Shield", "Deepfake Detector", "Identity Monitor", "Child Safety", "IoT Guardian", "Document Verifier", "Voice Clone Detector", "Marketplace Guard", "Voice Auth", "Visual Shield", "Malware Analysis"].map(m => (
              <span key={m} style={{ fontSize: 9, padding: "3px 6px", borderRadius: 4, background: "#22c55e15", color: "#86efac", border: "1px solid #16653444" }}>{m}</span>
            ))}
          </div>
        </div>

        {/* Go-to-Market */}
        <div style={{ background: "#1a1400", border: "1px solid #854d0e", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 12, marginBottom: 8 }}>Go-to-Market — 5 Fasen</div>
          {[
            { fase: 0, naam: "Gratis Zichtbaarheid", periode: "Week 1-4", rev: "€0" },
            { fase: 1, naam: "Chrome Extensie (WASM)", periode: "Maand 2-3", rev: "€500-2K/mnd" },
            { fase: 2, naam: "API + WordPress + Shopify", periode: "Maand 4-6", rev: "€2K-10K/mnd" },
            { fase: 3, naam: "MSP White-Label", periode: "Maand 6-12", rev: "€10K-50K/mnd" },
            { fase: 4, naam: "Embedded SDK (IoT/Auto)", periode: "Jaar 2+", rev: "€100K+/jaar" },
          ].map(f => (
            <div key={f.fase} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: "#f9731633", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#f97316", flexShrink: 0 }}>{f.fase}</span>
              <div style={{ flex: 1, fontSize: 11, color: "#fde68a" }}>{f.naam} <span style={{ color: "#6b7280" }}>({f.periode})</span></div>
              <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>{f.rev}</span>
            </div>
          ))}
        </div>

        {/* Finance Track */}
        <div style={{ background: "#001a33", border: "1px solid #1e40af", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#60a5fa", fontSize: 12, marginBottom: 8 }}>Finance Track — Value Guardian</div>
          <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 6 }}>"Wij beschermen uw GELD, niet alleen uw netwerk"</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["POS Terminal Guard €0.50/t/mnd", "Payment Gateway €99/mnd", "DORA Compliance €5K-50K/jr", "Claim Fraud €10K-100K/jr"].map(p => (
              <span key={p} style={{ fontSize: 9, padding: "3px 6px", borderRadius: 4, background: "#3b82f615", color: "#93c5fd", border: "1px solid #1e40af44" }}>{p}</span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6 }}>Targets: Bancontact, Worldline (Brussel), Ethias, Billit, Aion Bank</div>
          <div style={{ fontSize: 10, color: "#22c55e", marginTop: 4 }}>ROI: Bank verliest €50K aan phishing, SDK-HRM kost €500/mnd = 100x ROI</div>
        </div>

        {/* Embedded Market */}
        <div style={{ background: "#001a1a", border: "1px solid #0e7490", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#22d3ee", fontSize: 12, marginBottom: 8 }}>Embedded SDK Markt — $30.6B (2029)</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[
              "Automotive €0.50-2/auto", "Wearables €0.25-1/device", "Smart Home €0.10-0.50/device",
              "Robots €5K-50K/site", "Drones €1-5/drone"
            ].map(s => (
              <span key={s} style={{ fontSize: 9, padding: "3px 6px", borderRadius: 4, background: "#06b6d415", color: "#67e8f9", border: "1px solid #0e749044" }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Model Security */}
        <div style={{ background: "#1a0000", border: "1px solid #991b1b", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#ef4444", fontSize: 12, marginBottom: 8 }}>5-Laags Model Bescherming</div>
          {["1. Runtime Integrity — hash check bij elke start", "2. Code Obfuscation — anti-debugging", "3. Encrypted Weights — AES-256, device-locked", "4. Modulaire LoRA — open base, geheime adapters", "5. Blockchain Verificatie — tamper-proof updates"].map(s => (
            <div key={s} style={{ fontSize: 10, color: "#fca5a5", padding: "2px 0" }}>{s}</div>
          ))}
          <div style={{ fontSize: 10, color: "#22c55e", marginTop: 6 }}>Strategie: Open Base + Geheime LoRA Adapters (10-50MB, versleuteld, abonnement)</div>
        </div>

        {/* Data Flywheel */}
        <div style={{ background: "#0f000f", border: "1px solid #86198f", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#f472b6", fontSize: 12, marginBottom: 8 }}>Data Flywheel — Competitive Moat (Waze-model)</div>
          <div style={{ fontSize: 10, color: "#f9a8d4", lineHeight: 1.6 }}>
            User scant → Model score → User feedback (✓/✗) → GRATIS training data → Beter model → Meer users → ONVERSLAANBAAR
          </div>
          <div style={{ fontSize: 9, color: "#6b7280", marginTop: 4 }}>Privacy: alleen anonieme patronen, NOOIT content. Hash-based sharing. GDPR compliant.</div>
        </div>

        {/* Chrome Extension */}
        <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#4ade80", fontSize: 12, marginBottom: 8 }}>Chrome Extensie — Eerste Revenue</div>
          <div style={{ fontSize: 10, color: "#86efac", lineHeight: 1.6 }}>
            <div>ExtensionPay (Stripe) • WASM model lokaal in browser • Nul hosting kosten • ~95% marge</div>
            <div>Gratis: 10 scans/dag | Pro: €4.99/mnd | Gezin: €9.99/mnd</div>
            <div style={{ color: "#22c55e", fontWeight: 700, marginTop: 4 }}>Doel: €5.000/maand MRR binnen 6 maanden</div>
          </div>
        </div>

        {/* Checkpoint System */}
        <div style={{ background: "#1e1e30", border: "1px solid #454d60", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#9ca3af", fontSize: 12, marginBottom: 8 }}>Checkpoint V3 (MPS-Safe Fixes)</div>
          {["✓ Checkpoint VÓÓR evaluatie (niet erna)", "✓ while True → for range(16) — geen MPS kernel hang", "✓ Interval: 500→100 steps, Max keep: 5", "✓ MAX_EVAL_BATCHES: 20, EVAL_TIMEOUT: 120s"].map(f => (
            <div key={f} style={{ fontSize: 10, color: "#86efac", padding: "2px 0" }}>{f}</div>
          ))}
        </div>

        {/* 19 InfraNodus Graphs */}
        <div style={{ background: "#001a1a", border: "1px solid #0e7490", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, color: "#06b6d4", fontSize: 12, marginBottom: 8 }}>19 InfraNodus Knowledge Graphs</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["vision", "website_monitoring", "mobile_agent", "email_guardian", "fraud_protection", "revenue_model", "training-priorities", "franky-vision", "roadmap-gaps", "scam-patterns-v2", "website-guardian", "full-product-map", "voice-visual-shield", "model-comparison", "nested-architecture", "blockchain-trust", "model-security", "embedded-market", "finance-strategy"].map(g => (
              <span key={g} style={{ fontSize: 8, padding: "2px 5px", borderRadius: 3, background: "#06b6d415", color: "#67e8f9", border: "1px solid #0e749033" }}>SDK-HRM-{g}</span>
            ))}
          </div>
        </div>

        {/* Deployment Sizes */}
        <div style={{ background: "#1e1e30", border: "1px solid #454d60", borderRadius: 8, padding: 12, marginTop: 10 }}>
          <div style={{ fontWeight: 700, color: "#9ca3af", fontSize: 12, marginBottom: 8 }}>Deployment Groottes</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, color: "#d1d5db" }}>
            <div><strong style={{ color: "#f97316" }}>HRM-27M:</strong> 27MB (int8) — 109MB (float32)</div>
            <div><strong style={{ color: "#a78bfa" }}>LFM2-2.6B:</strong> 1.6GB (int4) — 5.2GB (float16)</div>
            <div><strong style={{ color: "#22c55e" }}>Gecombineerd:</strong> 2.1GB geoptimaliseerd</div>
          </div>
        </div>
      </div>

      {/* Export Info */}
      <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
        <p><strong>Backup:</strong> Dit dashboard is zelf de backup - gepusht naar GitHub na elke wijziging</p>
        <p style={{ marginTop: 4 }}><strong>Sync:</strong> Clone dit repo op MM4/MM2 voor dezelfde kennis overal</p>
        <p style={{ marginTop: 4 }}><strong>Onafhankelijk:</strong> Werkt zonder claude-mem - alle kritieke info staat IN de code</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V3.6 TAB: CLAUDE UPDATES - Dagelijkse updates over nieuwe features
// Franky wil NIET 7000 video's kijken - Claude moet dit zelf bijhouden
// ═══════════════════════════════════════════════════════════════════════════════
function ClaudeUpdates() {
  const { isPhone, S } = useDevice();
  // Recente Claude/Anthropic updates (handmatig bijgehouden tot API beschikbaar)
  const [updates] = useState([
    { id: 1, date: "2026-02-06", type: "feature", title: "Claude Code CLI v2.1.32", description: "Nieuwe versie met verbeterde context handling", relevance: "high", implemented: true },
    { id: 2, date: "2026-02-05", type: "feature", title: "Claude-Mem Plugin v9.0.16", description: "Memory plugin met SQLite en vector DB", relevance: "high", implemented: true },
    { id: 3, date: "2026-02-04", type: "announcement", title: "Opus 4.5 Extended Context", description: "1M token context window beschikbaar", relevance: "high", implemented: true },
    { id: 4, date: "2026-02-03", type: "plugin", title: "MCP Registry Connector", description: "Zoek en verbind externe MCP servers", relevance: "medium", implemented: true },
    { id: 5, date: "2026-02-01", type: "feature", title: "CoWork Desktop Beta", description: "Desktop app voor collaborative coding", relevance: "medium", implemented: false },
    { id: 6, date: "2026-01-28", type: "sdk", title: "Claude Agent SDK", description: "Bouw custom agents met Anthropic SDK", relevance: "critical", implemented: false },
  ]);

  // Nieuwe features die Franky zou moeten kennen
  const [recommendations] = useState([
    { feature: "Claude Agent SDK", reason: "Perfect voor je Telegram bot plannen - agents draaien op MM4", priority: "P1", action: "Onderzoek starten" },
    { feature: "CoWork", reason: "Collaborative coding - handig voor grotere projecten", priority: "P2", action: "Testen wanneer stabiel" },
    { feature: "Extended Thinking", reason: "Diepere analyse voor SDK-HRM ontwikkeling", priority: "P2", action: "Beschikbaar in Opus" },
  ]);

  // Tools en plugins status
  const [toolsStatus] = useState([
    { name: "Serena IDE", status: "broken", note: "Niet geconfigureerd - verwijder of herinstalleer", action: "Review needed" },
    { name: "Ralph Wiggins Loop", status: "active", note: "Marketplace plugin - functioneel", action: "Keep" },
    { name: "Claude-Mem", status: "active", note: "v9.0.16 - werkt goed", action: "Keep" },
    { name: "InfraNodus MCP", status: "active", note: "API key actief", action: "Keep" },
    { name: "Mac-Hub MCP", status: "active", note: "System automation", action: "Keep" },
  ]);

  const typeColors = { feature: "#4ade80", announcement: "#60a5fa", plugin: "#a78bfa", sdk: "#fbbf24" };
  const statusColors = { active: "#4ade80", broken: "#ef4444", pending: "#fbbf24" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)", border: "1px solid #0e7490", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 800, color: "#22d3ee", fontSize: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <span>📡</span> Claude/Anthropic Updates
        </div>
        <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>Dagelijkse updates - Franky hoeft geen 7000 video's te kijken</p>
        <p style={{ color: "#6b7280", fontSize: 10, marginTop: 4 }}>Laatst gecheckt: {new Date().toLocaleDateString("nl-BE")}</p>
      </div>

      {/* Recommendations - Wat Franky moet weten */}
      <div style={{ background: "#1a1400", border: "1px solid #854d0e", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>💡</span> AANBEVELINGEN VOOR FRANKY
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recommendations.map((rec, idx) => (
            <div key={idx} style={{ background: "#1a1a2e", border: "1px solid #454d60", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontWeight: 700, color: "#fbbf24", fontSize: 13 }}>{rec.feature}</span>
                  <p style={{ color: "#e5e5e5", fontSize: 11, marginTop: 4 }}>{rec.reason}</p>
                </div>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: rec.priority === "P1" ? "#ef444422" : "#fbbf2422", color: rec.priority === "P1" ? "#ef4444" : "#fbbf24" }}>{rec.priority}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <button style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #166534", background: "#052e16", color: "#4ade80", fontSize: 10, cursor: "pointer" }}>{rec.action}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Updates */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#22d3ee", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📰</span> RECENTE UPDATES
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {updates.map(upd => (
            <div key={upd.id} style={{ background: "#222238", border: "1px solid #2d3748", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: typeColors[upd.type], flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{upd.title}</span>
                {upd.relevance === "critical" && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#ef444422", color: "#ef4444" }}>CRITICAL</span>}
              </div>
              <p style={{ color: "#9ca3af", fontSize: 10, marginTop: 2, marginBottom: 8 }}>{upd.description}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#6b7280" }}>{upd.date}</span>
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: upd.implemented ? "#22c55e22" : "#454d6022", color: upd.implemented ? "#4ade80" : "#6b7280" }}>{upd.implemented ? "✓ Actief" : "○ Pending"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tools Status */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔧</span> TOOLS & PLUGINS STATUS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {toolsStatus.map((tool, idx) => (
            <div key={idx} style={{ background: "#222238", border: "1px solid #2d3748", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[tool.status], flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{tool.name}</span>
              </div>
              <span style={{ color: "#9ca3af", fontSize: 10 }}>{tool.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
        <p><strong>Doel:</strong> Franky hoeft niet constant video's te kijken - dit dashboard houdt alles bij</p>
        <p style={{ marginTop: 4 }}><strong>Toekomst:</strong> Automatische checks via Anthropic API/changelog</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V3.6 TAB: OPENCLAW - Agent/Telegram monitoring (NIET installeren, alleen voorbereiden)
// Evolutie: ClawdBot → MoldBot → OpenClaw
// Franky heeft 3 agents gebouwd maar afgebouwd - dit bereidt de infrastructuur voor
// ═══════════════════════════════════════════════════════════════════════════════
function OpenClaudeBot() {
  const { isPhone, S } = useDevice();
  // Agent configuraties (voorbereid, nog niet actief)
  const [agents] = useState([
    { id: "agent-1", name: "Telegram Commander", status: "planned", description: "Commands via Telegram terwijl Franky onderweg is", platform: "Telegram", mm4Required: true },
    { id: "agent-2", name: "MM4 Monitor", status: "planned", description: "Monitort training jobs op Mac Mini M4", platform: "Local", mm4Required: true },
    { id: "agent-3", name: "Sync Watcher", status: "planned", description: "Notificaties bij sync issues tussen devices", platform: "Multi", mm4Required: false },
  ]);

  // Franky's eerdere agent ervaringen
  const [history] = useState([
    { date: "2026-01", event: "3 agents gebouwd", outcome: "Afgebouwd wegens problemen", lesson: "Te vroeg, infrastructuur nog niet klaar" },
    { date: "2026-02", event: "Cloud Control Center v3.5", outcome: "Stabiele basis", lesson: "Eerst monitoring, dan agents" },
  ]);

  // Vereisten voor agent deployment
  const [requirements] = useState([
    { req: "MM4 setup compleet", status: "pending", note: "Scripts klaar, nog niet uitgevoerd" },
    { req: "Syncthing actief op alle Macs", status: "partial", note: "Alleen MBA gekoppeld" },
    { req: "Claude Agent SDK geïnstalleerd", status: "not_started", note: "Wacht op Franky's beslissing" },
    { req: "Telegram Bot Token", status: "not_started", note: "Nog aan te maken" },
    { req: "Stabiele internet op MM4", status: "unknown", note: "Te verifiëren" },
  ]);

  const statusColors = { planned: "#60a5fa", active: "#4ade80", paused: "#fbbf24", failed: "#ef4444", pending: "#fbbf24", partial: "#f59e0b", not_started: "#6b7280", unknown: "#9ca3af" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header - WAARSCHUWING */}
      <div style={{ background: "linear-gradient(135deg, #1a0a2e, #2d1b4e)", border: "1px solid #7c3aed", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 800, color: "#a78bfa", fontSize: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <span>🤖</span> OpenClaw (ClawdBot → MoldBot → OpenClaw)
        </div>
        <p style={{ color: "#c4b5fd", fontSize: 12, marginTop: 6 }}>Monitoring & Voorbereiding - NIET actief</p>
        <div style={{ marginTop: 10, padding: 10, background: "#1a140033", border: "1px solid #854d0e", borderRadius: 8 }}>
          <p style={{ color: "#fbbf24", fontSize: 11 }}>⚠️ STATUS: Alleen monitoring - nog NIETS installeren per Franky's instructie</p>
        </div>
      </div>

      {/* Geplande Agents */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📋</span> GEPLANDE AGENTS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {agents.map(agent => (
            <div key={agent.id} style={{ background: "#222238", border: "1px solid #2d3748", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: "#e5e5e5", fontSize: 13 }}>{agent.name}</span>
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${statusColors[agent.status]}22`, color: statusColors[agent.status] }}>{agent.status}</span>
              </div>
              <p style={{ color: "#9ca3af", fontSize: 11, marginBottom: 8 }}>{agent.description}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#454d6022", color: "#9ca3af" }}>{agent.platform}</span>
                {agent.mm4Required && <span style={{ color: "#6b7280", fontSize: 9 }}>Vereist MM4</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements Checklist */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>✓</span> VEREISTEN VOOR DEPLOYMENT
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {requirements.map((req, idx) => (
            <div key={idx} style={{ background: "#222238", border: "1px solid #2d3748", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: statusColors[req.status], flexShrink: 0 }} />
                <span style={{ color: "#e5e5e5", fontSize: 12, fontWeight: 600 }}>{req.req}</span>
              </div>
              <span style={{ color: "#6b7280", fontSize: 10 }}>{req.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#9ca3af", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📜</span> FRANKY'S AGENT ERVARING
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {history.map((h, idx) => (
            <div key={idx} style={{ background: "#1a1a2e", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{h.event}</span>
                <span style={{ color: "#6b7280", fontSize: 10 }}>{h.date}</span>
              </div>
              <p style={{ color: "#9ca3af", fontSize: 10, marginTop: 4 }}>Outcome: {h.outcome}</p>
              <p style={{ color: "#fbbf24", fontSize: 10, marginTop: 2 }}>Les: {h.lesson}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Telegram Concept */}
      <div style={{ background: "#001a33", border: "1px solid #1e40af", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📱</span> TELEGRAM INTEGRATIE CONCEPT
        </div>
        <p style={{ color: "#93c5fd", fontSize: 12 }}>Doel: Franky rijdt in de wagen → stuurt Telegram command → MM4 voert uit</p>
        <div style={{ marginTop: 10, padding: 10, background: "#1a1a2e", borderRadius: 8 }}>
          <p style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>/status - Check MM4 training status</p>
          <p style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>/sync - Trigger sync naar alle devices</p>
          <p style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>/stop - Pauzeer huidige training</p>
        </div>
        <p style={{ color: "#4b5563", fontSize: 10, marginTop: 10 }}>Status: Concept - wacht op MM4 setup + Franky's go-ahead</p>
      </div>

      {/* Info */}
      <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
        <p><strong>Huidige status:</strong> Alleen monitoring - geen installaties</p>
        <p style={{ marginTop: 4 }}><strong>Volgende stap:</strong> MM4 setup voltooien, dan agents heroverwegen</p>
        <p style={{ marginTop: 4 }}><strong>Franky's beslissing:</strong> Agents ZULLEN geïmplementeerd worden, timing TBD</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V3.1 TAB: AGENT HIERARCHY (voor 10-100 agenten orchestratie)
// ═══════════════════════════════════════════════════════════════════════════════
function AgentHierarchy() {
  const { isPhone, S } = useDevice();
  const [agents] = useState([
    { id: "orch-1", name: "Main Orchestrator", role: "orchestrator", status: "working", currentTask: "Coördineren SDK-HRM deployment", completedTasks: 47, successRate: 98.5 },
    { id: "spec-sdk", name: "SDK-HRM Specialist", role: "specialist", status: "working", currentTask: "Model transfer naar MM4", completedTasks: 23, successRate: 95.2 },
    { id: "spec-infra", name: "InfraNodus Specialist", role: "specialist", status: "idle", currentTask: null, completedTasks: 31, successRate: 97.8 },
    { id: "val-1", name: "Quality Validator", role: "validator", status: "working", currentTask: "Valideren FRANKY-LEARNINGS updates", completedTasks: 156, successRate: 99.1 },
    { id: "work-1", name: "Code Worker Alpha", role: "worker", status: "completed", currentTask: null, completedTasks: 89, successRate: 94.3 },
    { id: "work-2", name: "Doc Worker Beta", role: "worker", status: "working", currentTask: "SESSION-BACKLOG updaten", completedTasks: 67, successRate: 96.7 },
  ]);

  const [taskQueue] = useState([
    { id: "t1", description: "SDK-HRM model transfer naar MM4", priority: "critical", assignedTo: "spec-sdk", status: "in_progress" },
    { id: "t2", description: "Training op 50K samples starten", priority: "critical", assignedTo: null, status: "pending" },
    { id: "t3", description: "InfraNodus gaps invullen", priority: "high", assignedTo: null, status: "pending" },
  ]);

  const roleColors = { orchestrator: { icon: "👑", color: "#fbbf24", bg: "#1a1400", border: "#854d0e" }, specialist: { icon: "🛡️", color: "#60a5fa", bg: "#001a33", border: "#1e40af" }, validator: { icon: "✓", color: "#a78bfa", bg: "#0f0033", border: "#5b21b6" }, worker: { icon: "⚙️", color: "#4ade80", bg: "#052e16", border: "#166534" } };
  const statusColors = { working: "#4ade80", idle: "#6b7280", completed: "#60a5fa", blocked: "#ef4444" };

  const activeCount = agents.filter(a => a.status === "working").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header Stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e1e34", border: "1px solid #2d2a5e", borderRadius: 12, padding: 14 }}>
        <div>
          <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span>👥</span> Multi-Agent Orchestration
          </div>
          <p style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>Hiërarchie voor 10-100 agenten - systeem mag NIET tilt slaan</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#4ade80" }}>{activeCount}</div>
          <div style={{ color: "#6b7280", fontSize: 11 }}>Actieve Agenten</div>
        </div>
      </div>

      {/* Hierarchy Layers */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {["orchestrator", "specialist", "validator", "worker"].map(role => {
          const rc = roleColors[role];
          const roleAgents = agents.filter(a => a.role === role);
          if (roleAgents.length === 0) return null;
          return (
            <div key={role} style={{ background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, color: rc.color, marginBottom: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{rc.icon}</span> {role.charAt(0).toUpperCase() + role.slice(1)}s
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {roleAgents.map(agent => (
                  <div key={agent.id} style={{ background: "#1a1a2e", borderRadius: 8, padding: 10, minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[agent.status] }} />
                      <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{agent.name}</span>
                    </div>
                    {agent.currentTask && <p style={{ color: "#9ca3af", fontSize: 10, marginBottom: 6 }}>{agent.currentTask}</p>}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6b7280" }}>
                      <span>{agent.completedTasks} taken</span>
                      <span>{agent.successRate}% succes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Queue */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2d3748", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#6b7280", marginBottom: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <span>📋</span> Task Queue
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {taskQueue.map(task => (
            <div key={task.id} style={{ background: "#222238", border: "1px solid #2d3748", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12 }}>{task.priority === "critical" ? "🔴" : task.priority === "high" ? "🟡" : "⚪"}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: task.status === "in_progress" ? "#166534" : "#454d60", color: task.status === "in_progress" ? "#4ade80" : "#9ca3af" }}>{task.status}</span>
              </div>
              <p style={{ color: "#e5e5e5", fontSize: 12, marginBottom: 6 }}>{task.description}</p>
              <p style={{ color: "#6b7280", fontSize: 10 }}>{task.assignedTo ? `Toegewezen: ${agents.find(a => a.id === task.assignedTo)?.name}` : "Wacht op toewijzing"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Note */}
      <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
        <p><strong>Veiligheid:</strong> Elke taak wordt gevalideerd voordat deze als "completed" wordt gemarkeerd. Bij fouten: automatische rollback.</p>
        <p style={{ marginTop: 4 }}><strong>Hiërarchie:</strong> Orchestrator delegeert → Specialists coördineren → Workers uitvoeren → Validators controleren</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V4.1 TAB: SDK-HRM — Volledig overzicht Sapient-HRM project
// Aparte tab met expandable/collapsible secties en volledige uitleg teksten
// ═══════════════════════════════════════════════════════════════════════════════
function SDKHRMHub() {
  const { isPhone, S } = useDevice();
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Reusable expandable section component
  const Section = ({ id, icon, title, date, color, border, bg, summary, children }) => (
    <div style={{ background: bg || "#0f0f0f", border: `1px solid ${border || "#454d60"}`, borderRadius: 12, padding: 0, overflow: "hidden" }}>
      <div
        onClick={() => toggle(id)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", cursor: "pointer", transition: "background 0.15s",
          background: expanded[id] ? `${color}11` : "transparent"
        }}
        onMouseEnter={e => e.currentTarget.style.background = `${color}11`}
        onMouseLeave={e => { if (!expanded[id]) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 700, color: color, fontSize: 14 }}>{title}</div>
              {date && <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>{date}</div>}
            </div>
            {summary && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{summary}</div>}
          </div>
        </div>
        <span style={{ color: "#6b7280", fontSize: 16, transition: "transform 0.2s", transform: expanded[id] ? "rotate(180deg)" : "rotate(0deg)", marginLeft: 8 }}>▾</span>
      </div>
      {expanded[id] && (
        <div style={{ padding: "0 16px 16px 16px", borderTop: `1px solid ${border || "#454d60"}33` }}>
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a0a00, #0f0f23, #001a1a)", border: "2px solid #f97316", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, background: "linear-gradient(90deg, #f97316, #fbbf24, #22c55e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              SDK-HRM Intelligence Hub
            </div>
            <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>Sapient-HRM 27.3M — Volledig overzicht training, strategie & architectuur</p>
            <p style={{ color: "#6b7280", fontSize: 10, marginTop: 4 }}>Klik op elk item om de volledige uitleg te openen</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "27.3M", sub: "params", color: "#f97316" },
              { label: "66", sub: "domeinen", color: "#fbbf24" },
              { label: "18", sub: "modules", color: "#22c55e" },
              { label: "19", sub: "graphs", color: "#06b6d4" },
            ].map(m => (
              <div key={m.sub} style={{ textAlign: "center", padding: "8px 12px", background: `${m.color}11`, border: `1px solid ${m.color}44`, borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.label}</div>
                <div style={{ fontSize: 8, color: "#6b7280", textTransform: "uppercase" }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 1. MODEL & TRAINING ── */}
      <Section id="model" icon="🧠" title="Sapient-HRM 27.3M — Model & Training" date="6 Feb 2026" color="#f97316" border="#9a3412" bg="#0f0800"
        summary="ACT-architectuur, MPS M4 training, 66 domeinen, checkpoint V3">
        <div style={{ marginTop: 12 }}>
          {/* Quick Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 6, marginBottom: 16 }}>
            {[
              { label: "Parameters", value: "27.3M", color: "#f97316" },
              { label: "Architectuur", value: "ACT+HRM", color: "#a78bfa" },
              { label: "Device", value: "MPS M4", color: "#60a5fa" },
              { label: "Speed", value: "~1.76s/step", color: "#22c55e" },
              { label: "Checkpoint", value: "elke 100", color: "#f472b6" },
              { label: "Talen", value: "NL/FR/EN", color: "#06b6d4" },
              { label: "Domeinen", value: "66", color: "#fbbf24" },
              { label: "Target", value: "1.05M samples", color: "#ef4444" },
            ].map(m => (
              <div key={m.label} style={{ background: "#1e1e30", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 8, color: "#6b7280" }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Full explanation */}
          <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
            <p>Het Sapient-HRM model is een 27.3 miljoen parameter neuraal netwerk dat specifiek ontworpen is voor het detecteren van online fraude, scams, phishing en andere digitale bedreigingen. Het draait lokaal op een Mac Mini M4 met Apple's Metal Performance Shaders (MPS) als GPU-acceleratie.</p>
            <p style={{ marginTop: 8 }}>De architectuur combineert twee innovatieve technieken:</p>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li><strong style={{ color: "#f97316" }}>Adaptive Computation Time (ACT)</strong> — het model beslist zelf hoeveel rekenstappen nodig zijn per invoer. Eenvoudige gevallen (duidelijke spam) worden snel afgehandeld, complexe gevallen (subtiele social engineering) krijgen meer denktijd.</li>
              <li><strong style={{ color: "#a78bfa" }}>Hierarchical Reasoning Model (HRM)</strong> — twee niveaus van redeneren: H-level (strategisch, 4 lagen, 2 cycli) voor het grote plaatje en L-level (detail, 4 lagen, 4 cycli) voor gedetailleerde analyse.</li>
            </ul>
            <p style={{ marginTop: 8 }}>Het model traint op 66 verschillende domeinen verdeeld over 10 lagen, van core scam detection tot financiele fraude en platform-specifieke patronen. Het doel is uiteindelijk 1.051.000 training samples te verzamelen.</p>
            <p style={{ marginTop: 8 }}>De training draait met ~1.76 seconden per stap op MPS. Checkpoints worden elke 100 stappen opgeslagen met maximaal 5 behouden (de laatste 5). De gehele pipeline is privacy-first: alles draait lokaal, geen cloud, geen data die het apparaat verlaat.</p>

            <div style={{ marginTop: 12, padding: 12, background: "#1e1e30", borderRadius: 8, border: "1px solid #454d60" }}>
              <div style={{ fontWeight: 700, color: "#f97316", fontSize: 12, marginBottom: 8 }}>Neurale Architectuur Detail:</div>
              <ul style={{ paddingLeft: 20, fontSize: 11, color: "#d1d5db", lineHeight: 1.7 }}>
                <li><strong style={{ color: "#a78bfa" }}>Rotary Positional Embeddings (RoPE)</strong> — vervangt traditionele absolute positionele encodings door query/key vectoren te roteren in complexe ruimte. Biedt betere length generalization en relatieve positie-awareness via de "rotate half" techniek.</li>
                <li><strong style={{ color: "#22c55e" }}>SwiGLU Activation</strong> — vervangt traditionele ReLU/GELU met gated linear units en SiLU activatie. Gebruikt een zorgvuldig gekozen expansion ratio (2/3) afgerond op veelvouden van 256 voor optimale rekenefficiency.</li>
                <li><strong style={{ color: "#60a5fa" }}>FlashAttention / SDPA fallback</strong> — selecteert intelligent tussen FlashAttention (geoptimaliseerde CUDA kernel voor GPU) en standaard PyTorch SDPA voor CPU/MPS. Op MPS wordt SDPA gebruikt omdat FlashAttention niet beschikbaar is.</li>
                <li><strong style={{ color: "#f472b6" }}>Q-learning Halting</strong> — het model leert via reinforcement learning wanneer het moet stoppen met redeneren. Maximaal 16 cycli, maar eenvoudige inputs worden na 2-3 cycli al correct geclassificeerd.</li>
                <li><strong style={{ color: "#fbbf24" }}>Multi-Query Attention</strong> — deelt key/value heads over meerdere query heads, wat geheugenbandbreedte vermindert tijdens inference. Cruciaal voor snelle real-time detectie op edge devices.</li>
                <li><strong style={{ color: "#ef4444" }}>RMS Normalization</strong> — sneller alternatief voor LayerNorm dat normaliseert op root mean square in plaats van mean en variance. Minder parameters, snellere berekening.</li>
                <li><strong style={{ color: "#06b6d4" }}>Truncated LeCun Normal</strong> — custom weight initialization die PyTorch's wiskundige onnauwkeurigheid in truncated normal corrigeert. Zorgt voor stabiele gradients bij initialisatie.</li>
              </ul>
            </div>

            <div style={{ marginTop: 12, padding: 12, background: "#1a1a2e", borderRadius: 8, border: "1px solid #312e81" }}>
              <div style={{ fontWeight: 700, color: "#a78bfa", fontSize: 12, marginBottom: 8 }}>MPS Porting Learnings (CUDA → Apple Silicon):</div>
              <ul style={{ paddingLeft: 20, fontSize: 11, color: "#c4b5fd", lineHeight: 1.7 }}>
                <li>FlashAttention vervangen door SDPA (Scaled Dot Product Attention)</li>
                <li><code style={{ color: "#f97316" }}>view()</code> vervangen door <code style={{ color: "#22c55e" }}>reshape()</code> overal — MPS vereist contiguous tensors</li>
                <li>Float32 only — MPS ondersteunt geen float16/bfloat16 voor alle operaties</li>
                <li><code style={{ color: "#f97316" }}>torch.compile()</code> uitgeschakeld — niet compatibel met MPS backend</li>
                <li>Optimizer VOOR <code style={{ color: "#22c55e" }}>.to(device)</code> aanmaken — anders device mismatch</li>
                <li><code style={{ color: "#06b6d4" }}>carry_to_device()</code> helper functie voor het verplaatsen van carry state tussen devices</li>
                <li>Hydra config bypass met OmegaConf — directe config loading in plaats van Hydra decorators</li>
              </ul>
            </div>

            <div style={{ marginTop: 12, padding: 12, background: "#052e16", borderRadius: 8, border: "1px solid #166534" }}>
              <div style={{ fontWeight: 700, color: "#4ade80", fontSize: 12, marginBottom: 8 }}>HRMBrain — Embedded AI Wrapper:</div>
              <p style={{ fontSize: 11, color: "#86efac", lineHeight: 1.7 }}>De brain.py module biedt een production-ready wrapper rond het HRM model, ontworpen voor embedding in diverse applicaties van mobiele apps tot IoT devices. De API is simpel: <code>think()</code> voor inference en <code>learn()</code> voor continuous learning. Het brein onderhoudt persistent state via een carry-mechanisme, waardoor context behouden blijft tijdens lopende conversaties. Een experience buffer slaat tot 1000 recente interacties op met inputs, targets, losses en timestamps voor on-device adaptatie. Automatische device selectie kiest tussen CUDA, MPS of CPU. Met ~50MB modelgrootte en real-time inference levert dit praktische edge AI zonder netwerkafhankelijkheid of privacyzorgen.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 2. CHECKPOINT V3 FIXES ── */}
      <Section id="checkpoint" icon="💾" title="Checkpoint V3 — MPS-Safe Training Fixes" date="6 Feb 2026" color="#22c55e" border="#166534" bg="#020f06"
        summary="Kritieke fixes na 2x dataverlies door MPS GPU hangs">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p><strong style={{ color: "#ef4444" }}>Probleem:</strong> Twee keer is alle trainingsvoortgang verloren gegaan doordat de MPS GPU vastliep in een evaluatie-loop. De eerste keer 5750 stappen, de tweede keer 228 stappen. Dit komt omdat MPS GPU-calls op kernel-niveau blokkeren (Uninterruptible Sleep / UN state) — Python code wordt simpelweg niet meer uitgevoerd, dus timeouts en while-loop checks werken niet.</p>

          <div style={{ marginTop: 12, marginBottom: 12, padding: 12, background: "#1e1e30", borderRadius: 8, border: "1px solid #454d60" }}>
            <div style={{ fontWeight: 700, color: "#22c55e", marginBottom: 8 }}>3 Kritieke Fixes:</div>
            {[
              { fix: "Checkpoint VÓÓR evaluatie", detail: "Het model wordt nu opgeslagen VOORDAT de evaluatie begint. Als de eval vastloopt, is de trainingsvoortgang al veilig opgeslagen. Voorheen werd pas NA de eval opgeslagen, waardoor alles verloren ging." },
              { fix: "while True → for range(16)", detail: "De gevaarlijke while True evaluatie-loop is vervangen door een vaste for-loop met maximaal 16 cycli. Zelfs als het model niet convergeert, stopt de loop na 16 iteraties in plaats van eindeloos te draaien." },
              { fix: "Lager interval + cleanup", detail: "Checkpoint interval verlaagd van 500 naar 100 stappen. Maximaal 5 checkpoints behouden (automatische cleanup). MAX_EVAL_BATCHES=20 en EVAL_TIMEOUT=120s als extra veiligheid." },
            ].map((f, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ color: "#86efac", fontWeight: 600 }}>✓ {f.fix}</div>
                <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>{f.detail}</div>
              </div>
            ))}
          </div>

          <p><strong style={{ color: "#fbbf24" }}>MPS Kernel-Level Hang Verklaring:</strong> Apple's Metal Performance Shaders maken GPU-calls die op besturingssysteem-niveau blokkeren. Wanneer een MPS operatie vastloopt, gaat het hele Python-proces in UN (Uninterruptible Sleep) status. Dit betekent dat Python's eigen time.time() check nooit bereikt wordt, want de thread wacht in kernel space. De enige oplossingen zijn: voorkom de situatie (vaste loop grenzen) of gebruik een apart subprocess met OS-level kill.</p>
        </div>
      </Section>

      {/* ── 3. NESTED ARCHITECTURE ── */}
      <Section id="nested" icon="🏗️" title="Nested Architecture — HRM inside LFM2" date="8 Feb 2026" color="#a78bfa" border="#5b21b6" bg="#080020"
        summary="Brain-inside-Body concept met DeepEncoder compression bridge">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>Franky's kern-innovatie: het combineren van twee AI-modellen in een geneste architectuur die op een enkel edge device draait. Het concept is "Brain inside Body" — het kleine maar krachtige HRM-model (het brein) draait binnen het grotere LFM2-model (het lichaam).</p>

          {/* Architecture Diagram */}
          <div style={{ marginTop: 12, marginBottom: 12, padding: 14, background: "#1a1a2e", borderRadius: 8, border: "1px solid #312e81", fontFamily: "monospace", fontSize: 11, lineHeight: 1.8 }}>
            <div style={{ color: "#60a5fa", fontWeight: 700 }}>LFM2-2.6B (body) — ontvangt alle input (tekst, email, voice, beeld)</div>
            <div style={{ color: "#6b7280" }}>{"    ↓ 1000 tokens (2560-dim embeddings)"}</div>
            <div style={{ color: "#f59e0b", fontWeight: 700 }}>DeepEncoder Bridge — comprimeert 2560→512 dim, 1000→50 tokens (97% info behoud)</div>
            <div style={{ color: "#6b7280" }}>{"    ↓ 50 tokens (512-dim compressed)"}</div>
            <div style={{ color: "#f97316", fontWeight: 700 }}>HRM-27M (brain) — diep redeneren → risk_score + uitleg</div>
            <div style={{ color: "#22c55e", fontWeight: 700, marginTop: 8 }}>Totaal geheugen: LFM2 ~5GB + Bridge ~0.5GB + HRM ~1GB = 6.5GB (past op 16GB Mac Mini)</div>
          </div>

          <p><strong style={{ color: "#60a5fa" }}>LFM2-2.6B (Liquid AI):</strong> Een hybrid model van 2.6 miljard parameters met GQA (Grouped Query Attention) en Gated Convolutions, 30 lagen (22 convolutie + 8 attention), getraind op 10 biljoen tokens in 8 talen. Het heeft native tool calling, MLX support voor Apple Silicon, en een context window van 32K tokens. Dit model fungeert als de "taalschil" die alle binnenkomende informatie begrijpt en verwerkt.</p>

          <p style={{ marginTop: 8 }}><strong style={{ color: "#f59e0b" }}>DeepEncoder Bridge:</strong> Gebaseerd op DeepSeek OCR compressie-technologie. Reduceert het aantal tokens met factor 10-20x terwijl 97% van de informatie behouden blijft. De bridge comprimeert LFM2's output (2560-dimensionale embeddings) naar HRM's input (512-dimensionaal), en verlaagt het tokenaantal van 1000 naar 50. Dit maakt de communicatie tussen de twee modellen extreem efficient.</p>

          <p style={{ marginTop: 8 }}><strong style={{ color: "#f97316" }}>HRM-27M (Brain):</strong> Het compacte maar krachtige kernmodel dat diep redeneert over bedreigingen. Met slechts 27MB (int8 kwantisatie) biedt het adaptief redeneren via ACT, hierarchische analyse via H/L-levels, en Q-learning-gebaseerde halting. Het ontvangt de gecomprimeerde context van de bridge en levert een risk_score plus menselijk leesbare uitleg.</p>

          <div style={{ marginTop: 12, padding: 12, background: "#0a1a0a", borderRadius: 8, border: "1px solid #16a34a44" }}>
            <div style={{ fontWeight: 700, color: "#22c55e", fontSize: 12, marginBottom: 8 }}>IMPLEMENTATIE GESTART — 8 Feb 2026</div>
            <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.7 }}>
              <p><strong style={{ color: "#22c55e" }}>Phase 1 — Feature-Level Nesting (NU):</strong></p>
              <p>LFM2 analyseert bericht → extraheert ~28 numerieke features (indicators, rule engine scores, tekst stats) → HRM-Scam redeneert iteratief (H/L cycles) → classificatie SCAM/SAFE</p>
              <p style={{ marginTop: 4 }}><strong style={{ color: "#fbbf24" }}>Target: 80-83%</strong> (boven 78.9% hybrid baseline)</p>
              <p style={{ marginTop: 4 }}><strong style={{ color: "#a78bfa" }}>Phase 2 — Embedding-Level (TOEKOMST):</strong></p>
              <p>LFM2 hidden states (2048-dim) → DeepEncoder bridge → HRM continue embeddings (512-dim) • Target: 83-87%</p>
            </div>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[
                { label: "HRM-Scam", value: "512-dim", color: "#f97316" },
                { label: "Features", value: "~28", color: "#fbbf24" },
                { label: "Bridge", value: "~8MB", color: "#a78bfa" },
              ].map(m => (
                <div key={m.label} style={{ background: "#1e1e30", borderRadius: 6, padding: "4px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 8, color: "#6b7280" }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 10, background: "#1e1e30", borderRadius: 8, border: "1px solid #454d60" }}>
            <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 12, marginBottom: 6 }}>3 Strategieen (Optie 1 gekozen):</div>
            {[
              "1. ✅ HRM inside LFM2 — HRM als reasoning core, LFM2 als language/context shell (ACTIEF)",
              "2. Compressed LFM2 inside HRM — LoRA adapters injecteren LFM2 kennis in HRM framework",
              "3. Dual model met DeepEncoder bridge — beide modellen draaien, compressed tokens ertussen",
            ].map((s, i) => (
              <div key={i} style={{ fontSize: 11, color: i === 0 ? "#22c55e" : "#6b7280", padding: "3px 0", fontWeight: i === 0 ? 600 : 400 }}>{s}</div>
            ))}
          </div>

          <p style={{ marginTop: 12 }}><strong style={{ color: "#22c55e" }}>Google Nested Learning (NeurIPS 2025):</strong> Multi-timescale aanpak met snelle modules (nieuwe scams, maandelijks updatebaar) en trage modules (core reasoning, stabiel). Het Continuum Memory System voorkomt catastrophic forgetting. Maandelijkse updates gaan naar de snelle modules ZONDER het basismodel te hertrainen. Perfect voor een abonnementsmodel: nieuwe bedreigingen maandelijks, core blijft stabiel.</p>

          <div style={{ marginTop: 12, padding: 12, background: "#1a1a2e", borderRadius: 8, border: "1px solid #312e81" }}>
            <div style={{ fontWeight: 700, color: "#c4b5fd", fontSize: 12, marginBottom: 8 }}>Hoe de compressie werkt — stap voor stap:</div>
            <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.7 }}>
              <p><strong style={{ color: "#60a5fa" }}>Fase 1 — LFM2 ontvangt input:</strong> Een email, website of spraakfragment komt binnen. LFM2-2.6B verwerkt dit met zijn 30 lagen (22 convolutie + 8 attention) tot 2560-dimensionale embeddings. Op dit punt begrijpt LFM2 de taal, context en inhoud, maar het is te groot om diep te redeneren over dreigingen.</p>
              <p style={{ marginTop: 6 }}><strong style={{ color: "#f59e0b" }}>Fase 2 — DeepEncoder comprimeert:</strong> De DeepEncoder bridge neemt de 1000 tokens van LFM2 en comprimeert ze naar slechts 50-100 visual tokens per pagina. De dimensionaliteit gaat van 2560 naar 512. Dit is optische compressie: tekst-context wordt omgezet naar een visuele representatie die geheugen bespaart. 97% van de informatie blijft behouden ondanks 10-20x compressie.</p>
              <p style={{ marginTop: 6 }}><strong style={{ color: "#f97316" }}>Fase 3 — HRM redeneert:</strong> Het compacte HRM-27M ontvangt de 50 compressed tokens en past zijn hierarchische redenering toe. H-level (strategisch): "Is dit een phishing poging?" L-level (detail): "Welk type? Wat zijn de rode vlaggen?" Het resultaat: een risk assessment met natural language explanation — "Deze email is 94% waarschijnlijk phishing omdat de afzender een lookalike domein gebruikt en urgentie-taal bevat."</p>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 12, background: "#1e1e30", borderRadius: 8, border: "1px solid #454d60" }}>
            <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 12, marginBottom: 8 }}>Multi-Timescale Learning — Hoe updates werken:</div>
            <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.7 }}>
              <p><strong style={{ color: "#22c55e" }}>Snelle modules (fast modules):</strong> Worden maandelijks bijgewerkt met nieuwe scam-patronen, trending phishing campagnes, en seizoensgebonden dreigingen. Deze updates gaan via LoRA adapters (10-50MB) die in seconden geladen worden. Ze reageren op immediate context — wat er NU gebeurt in het dreigingslandschap.</p>
              <p style={{ marginTop: 6 }}><strong style={{ color: "#60a5fa" }}>Trage modules (slow modules):</strong> Bevatten de core knowledge en core reasoning die stabiel en betrouwbaar blijven. Deze worden zelden bijgewerkt (kwartaal of jaarlijks) en alleen na uitgebreide validatie. Ze bevatten de fundamentele redeneercapaciteiten: wat IS phishing, hoe WERKT social engineering, wat zijn de universele kenmerken van fraude.</p>
              <p style={{ marginTop: 6 }}><strong style={{ color: "#a78bfa" }}>Waarom dit werkt voor een abonnement:</strong> Klanten betalen maandelijks voor de snelle module updates (nieuwe dreigingen), terwijl het basismodel (trage modules) stabiel en betrouwbaar blijft. Je hertraint NOOIT het hele model voor een maandelijkse update — alleen de snelle LoRA adapters worden vervangen.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 4. 18 BESCHERMINGSMODULES ── */}
      <Section id="modules" icon="🛡️" title="18 Beschermingsmodules — Volledige Product Map" date="7 Feb 2026" color="#4ade80" border="#166534" bg="#020f06"
        summary="7 core + 11 expansie modules voor complete digitale bescherming">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>SDK-HRM is ontworpen als een modulair beveiligingsplatform met 18 beschermingsmodules, verdeeld in 7 kern-modules en 11 uitbreidingsmodules. Elk module kan onafhankelijk worden geactiveerd en bijgewerkt via LoRA adapters.</p>

          <div style={{ fontWeight: 700, color: "#4ade80", fontSize: 13, marginTop: 12, marginBottom: 8 }}>7 Core Modules:</div>
          {[
            { naam: "Email Guardian", detail: "Detecteert phishing, impersonation en credential theft in e-mails via 11 analyse-clusters. Specifieke detectie omvat: taalanalyse (AI-gegenereerde tekst in perfect Nederlands herkennen, schrijfstijl vergelijken met normaal contact), domein/SPF/header checks (vervalste afzenders, lookalike domeinen), URL-analyse (fake links naar niet-officiele sites, redirect chains), urgentie/druk-tactiek detectie (dreigingen met account blokkering, 'handel nu' taal), beloning/loterij patronen, en specifieke scam-categorieen zoals crypto wallet phishing ('vraagt nooit naar private keys'), exacte kopieeen van bank-emails, en BEC (Business Email Compromise). Het model leert ook dat banken NOOIT naar codes vragen via email — een fundamentele regel die verrassend effectief is." },
            { naam: "Website Guardian", detail: "Volledige website bescherming verdeeld over 16 clusters. Bot protection blokkeert scrapers, crawlers en geautomatiseerde aanvallen. Hack detection monitort file changes, unauthorized access, SQL injection en XSS attacks in real-time. GDPR/NIS2 compliance scanning controleert cookie walls, consent mechanismen en juridische vereisten inclusief recente court rulings. Plugin vulnerability scanning detecteert outdated plugins, themes en CMS versies op WordPress, Shopify, Wix en Squarespace. KVK/BTW verificatie controleert of bedrijfsgegevens verifieerbaar zijn via web presence. Een mini AI engine draait lokaal met self-updating security rules zonder cloud dependency. Alert escalatie via SMS, email en phone call op basis van severity. Pricing: freemium basic scan, premium monitoring op €9.99/maand." },
            { naam: "Call Shield", detail: "Live telefoongesprek analyse voor impersonation en social engineering detectie. Voert continue voice stress analysis uit door micro-tremors, angst en dwang te meten in de stem. Analyseert achtergrondgeluiden om callcenter-omgevingen te herkennen (typisch voor tech support scams). Vergelijkt de stem van de beller met de lokaal opgeslagen voiceprint baseline van bekende contacten. Detecteert wanneer iemand claimt een bankmedewerker of Microsoft support te zijn via taalpatronen (urgente branding, telefoonnummers die niet kloppen). Kan gesprekken opnemen als bewijs voor aangifte. Beschermt specifiek tegen het scenario waarbij een oudere persoon onder druk wordt gezet om geld over te maken." },
            { naam: "Mobile Agent", detail: "Real-time bescherming voor SMS, messaging apps (WhatsApp, Telegram, Signal) en QR codes op smartphones. Scant binnenkomende berichten op phishing links, fake delivery notificaties, en verdachte URL's. QR code scanning op openbare plekken (parkeermeters, restaurants) detecteert malafide redirects naar phishing-paginas voordat je ze opent. Analyseert SMS berichten op smishing patronen: fake pakket-tracking, bank verificatie codes, en premium nummer scams. Integreert met de Social Graph module om afwijkend berichtgedrag van bekende contacten te detecteren (gehackt account)." },
            { naam: "Elderly Guardian", detail: "Speciaal ontworpen voor de bescherming van kwetsbare ouderen met familie-oversight. Proactieve screening van alle binnenkomende communicatie — niet alleen na een melding, maar continu. Genereert wekelijkse rapporten voor familieleden met een overzicht van verdachte contacten en interacties. Detecteert specifieke patronen die ouderen treffen: romance scams (snel verliefd, geld vragen), beleggingsfraude (gegarandeerd rendement), tech support scams (Microsoft belt nooit zelf), en manipulatie door bekenden. Zero-Knowledge Proofs laten ouderen hun identiteit bewijzen zonder persoonlijke informatie te delen. De module werkt samen met Wearable Shield om verhoogde stress tijdens verdachte gesprekken automatisch te detecteren." },
            { naam: "Wearable Shield", detail: "Apple Watch integratie die biometrische data combineert met gespreksanalyse. Meet hartslag en stresspatronen continu tijdens telefoongesprekken. State of mind monitoring detecteert fatigue, confusion en panic via stemanalyse. Wanneer verhoogde stress samenvalt met een verdacht gesprek (onbekend nummer + urgente taal + stress-indicatoren), wordt automatisch een alarm gestuurd naar het emergency contact. De combinatie van fysiologische data (hartslag, huidgeleiding) met AI-analyse (stem, inhoud) maakt dit uniek — geen andere oplossing combineert beide signalen." },
            { naam: "Social Graph", detail: "Bouwt gedragsprofielen (behavioral baselines) per contact op over tijd. De baseline omvat: schrijfstijl, berichttijdstippen, woordkeuze, emoji-gebruik, en communicatiefrequentie. Detecteert wanneer een contact zich anders begint te gedragen (account gehackt, of romance scam). Specifieke detectie: romance scams op dating platforms (te snel verliefd, geld vragen, weigeren te videobellen), account hijacking (plotselinge verandering in schrijfstijl, ongebruikelijke verzoeken), en gecoordineerde fraude (meerdere contacten die gelijktijdig hetzelfde patroon vertonen). De behavioral baseline voedt ALLE andere modules — als Email Guardian een email ontvangt van een bekend contact, controleert Social Graph of het gedrag klopt met de baseline." },
          ].map((m, i) => (
            <div key={i} style={{ marginBottom: 8, padding: 10, background: "#052e16", borderRadius: 8, border: "1px solid #16653444" }}>
              <div style={{ fontWeight: 600, color: "#86efac", fontSize: 12 }}>{i + 1}. {m.naam}</div>
              <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>{m.detail}</div>
            </div>
          ))}

          <div style={{ fontWeight: 700, color: "#06b6d4", fontSize: 13, marginTop: 16, marginBottom: 8 }}>11 Uitbreidingsmodules:</div>
          {[
            { naam: "QR Shield", detail: "Scant QR codes op openbare plekken (parkeermeters, restaurants, evenementen) voordat je ze opent. Detecteert malafide redirects, phishing-paginas achter QR codes, en stickers die over legitieme QR codes heen zijn geplakt. Controleert de bestemmings-URL tegen bekende scam-databases en analyseert de landingspagina op phishing-kenmerken. Specifiek relevant voor België/Nederland waar QR-parking scams toenemen." },
            { naam: "Deepfake Detector", detail: "Detecteert AI-gegenereerde video en afbeeldingen in videogesprekken en social media feeds. Analyseert facial inconsistencies (onnatuurlijke gezichtsuitdrukkingen), lighting/shadows fouten die AI niet correct rendert, en lip-sync issues (mond beweegt niet synchroon met audio). Werkt passief tijdens social media scrolling — 'always-on scanning' die automatisch waarschuwt bij verdachte content in messaging apps en feeds zonder dat de gebruiker actief hoeft te scannen." },
            { naam: "Identity Monitor", detail: "Continue dark web monitoring en data breach detectie. Doorzoekt gelekte databases op je email-adressen, telefoonnummers en gebruikersnamen. Waarschuwt onmiddellijk wanneer je stolen credentials opduiken in nieuwe breaches. Controleert ook of je wachtwoorden in bekende breach-lijsten voorkomen (zoals HaveIBeenPwned maar dan lokaal en privacy-first). Monitoring draait continu als achtergrondproces." },
            { naam: "Child Safety", detail: "Online activiteit monitoring specifiek ontworpen voor ouders. Detecteert grooming patronen (volwassene die geleidelijk vertrouwen opbouwt bij minderjarige), cyberbullying (herhaalde negatieve berichten, uitsluiting), en ongeschikt content. Leeftijdsgeschikte beschermingsniveaus die meegroeien. Beschermt tegen het delen van persoonlijke informatie door kinderen (adres, school, fotos). Ouders krijgen alerts zonder elk bericht te hoeven lezen — privacy van het kind wordt gerespecteerd terwijl veiligheid gewaarborgd blijft." },
            { naam: "IoT Guardian", detail: "Beveiligt smart home apparaten (smart locks, deurbellen, camera's, speakers, thermostaten) tegen ongeautoriseerde toegang en firmware manipulatie. Detecteert brute-force login pogingen, ongeautoriseerde firmware updates, en verdachte netwerkcommunicatie van IoT devices. Voorkomt dat smart speakers reageren op commando's van buren of voorbijgangers. Monitort of apparaten data versturen naar onbekende servers (data exfiltratie via IoT)." },
            { naam: "Document Verifier", detail: "Verifieert de echtheid van contracten, facturen en certificaten via AI-analyse van opmaak, taalpatronen, metadata en digitale handtekeningen. Detecteert gemanipuleerde PDF's, vervalste notaris-documenten, en fake diploma's/certificaten. Controleert of facturen kloppen met bekende leverancierspatronen (voorkomen van CEO fraude via nep-facturen). Vergelijkt documentstijl met historische referenties van dezelfde afzender." },
            { naam: "Voice Clone Detector", detail: "Detecteert AI-gegenereerde stemmen (voice cloning) door analyse van vocale biomarkers die synthetische spraak mist. Specifieke detectie van: micro-tremors (natuurlijke trillingen die AI niet reproduceert), ademhalingspatronen (echte mensen ademen, AI niet), vocal fry (krakende laagste stemregisters), en micro-pauses (natuurlijke pauzes in spraak). Vergelijkt live voice met de lokaal opgeslagen voiceprint baseline. Een voice aging model houdt rekening met het feit dat stemmen over tijd veranderen. Cruciaal nu AI-stemklonen steeds overtuigender worden." },
            { naam: "Marketplace Guard", detail: "Bescherming tegen fraude op Marktplaats, 2dehands, Vinted en andere platforms. Detecteert nep-listings (gestolen productfoto's, geen fysiek adres, te-mooi-om-waar-te-zijn prijzen), escrow scams (betalen via onofficieel platform), en manipulatieve verkopers. Controleert KVK/BTW nummers van verkopers, vergelijkt productfoto's met reverse image search, en analyseert verkooppatronen. Review manipulation detectie identificeert nep-reviews en gecoordineerde review-fraude. Return fraud patronen worden herkend bij herhaalde klachten van dezelfde accounts." },
            { naam: "Voice Authentication", detail: "Continue identiteitsverificatie via vocale biomarkers — niet een eenmalige check, maar doorlopend gedurende het hele gesprek. Meet pitch frequency (toonhoogte), timber resonance (klankkleur), breathing patterns (ademhalingsritme), en speech rhythm (spraakpatronen). Slaat de voiceprint baseline lokaal op als hash (NOOIT als opname) voor privacy. Een voice aging model past de baseline automatisch aan naarmate de stem van de gebruiker natuurlijk verandert over maanden en jaren. Detecteert real-time of je daadwerkelijk spreekt met wie je denkt te spreken, of met een impersonator." },
            { naam: "Visual Authenticity Shield", detail: "Real-time overlay (rood/amber/groen) voor het beoordelen van de echtheid van afbeeldingen en video's. Analyseert compression artifacts (patronen die ontstaan bij AI-generatie), unnatural details (onrealistische texturen, asymmetrische gelaatstrekken), en generation patterns (herkenbare AI-vingerafdrukken). Werkt passief tijdens social media scrolling en messaging — always-on scanning. Content die op de blockchain een creation timestamp heeft krijgt automatisch een hogere authenticiteits-score. AI-gegenereerde content die geen originele blockchain timestamp heeft wordt gemarkeerd." },
            { naam: "Malware Analysis Engine", detail: "Gedragsanalyse van APK's (Android apps), browser extensies en desktop applicaties. Scant NIET op signatures (zoals traditionele antivirus) maar op verdacht GEDRAG: hidden permissions die de app niet nodig zou moeten hebben, verdachte network calls naar onbekende servers, data exfiltration (app stuurt contacten/foto's naar externe server), en cryptominer activiteit (onverklaard hoog CPU-gebruik). Analyseert mobile apps op het moment van installatie en monitort daarna continu op verdacht runtime-gedrag. Detecteert ransomware-patronen voordat bestanden versleuteld zijn." },
          ].map((m, i) => (
            <div key={i} style={{ marginBottom: 6, padding: 8, background: "#001a1a", borderRadius: 6, border: "1px solid #0e749033" }}>
              <div style={{ fontWeight: 600, color: "#67e8f9", fontSize: 11 }}>{i + 8}. {m.naam}</div>
              <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 3 }}>{m.detail}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 5. GO-TO-MARKET STRATEGIE ── */}
      <Section id="gtm" icon="🚀" title="Go-to-Market — 5 Fasen als Eenmanszaak" date="7 Feb 2026" color="#fbbf24" border="#854d0e" bg="#0f0a00"
        summary="Van gratis zichtbaarheid naar €100K+/jaar embedded SDK revenue">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>De go-to-market strategie is ontworpen voor een eenmanszaak die met minimale kosten maximale impact wil bereiken. Het principe is: begin met gratis, bouw autoriteit op, monetiseer geleidelijk, en schaal via partnerschappen.</p>

          {[
            { fase: 0, naam: "Gratis Zichtbaarheid", periode: "Week 1-4", rev: "€0", color: "#6b7280",
              detail: "Publiceer het HRM base model als open source op GitHub. Schrijf technische blog posts over de ACT-architectuur en hierarchisch redeneren. Deel op LinkedIn, Hacker News en Reddit. Doel: 500+ GitHub stars en naam vestigen als security AI expert. Kosten: €0, alleen tijd. De open source publicatie bouwt vertrouwen en community — cruciaal voor een onbekend merk." },
            { fase: 1, naam: "Chrome Extensie 'SDK-Guardian'", periode: "Maand 2-3", rev: "€500-2K/mnd", color: "#f97316",
              detail: "Eerste betaald product. Het AI-model draait als WASM (WebAssembly) volledig lokaal in de browser — nul hosting kosten, ~95% marge. Betalingen via ExtensionPay (open source, Stripe-gebaseerd). Freemium model: gratis tier met 10 scans per dag, Pro voor €4.99/maand (onbeperkt + dashboard), Gezin voor €9.99/maand (tot 5 apparaten). Doel: €5.000/maand MRR binnen 6 maanden. Dit is het laagst hangend fruit: Chrome extensions hebben 0 infrastructuurkosten en directe toegang tot miljoenen gebruikers." },
            { fase: 2, naam: "API + WordPress + Shopify", periode: "Maand 4-6", rev: "€2K-10K/mnd", color: "#22c55e",
              detail: "API endpoint voor ontwikkelaars (€49-199/maand per klant). WordPress plugin voor website-eigenaren (GDPR scanner, bot detectie). Shopify app voor webshop beveiliging. Elke integratie bedient een ander klantsegment maar hergebruikt dezelfde SDK-HRM kern." },
            { fase: 3, naam: "MSP White-Label", periode: "Maand 6-12", rev: "€10K-50K/mnd", color: "#60a5fa",
              detail: "Managed Service Providers (MSPs) bedienen duizenden kleine bedrijven. Bied SDK-HRM aan als white-label product dat MSPs onder eigen naam doorverkopen. MSP-vriendelijk dashboard met multi-tenant support. Pricing: €2-5/eindklant/maand, MSP houdt marge. Eén MSP met 1000 klanten = €2K-5K/maand recurring." },
            { fase: 4, naam: "Embedded SDK (IoT/Automotive)", periode: "Jaar 2+", rev: "€100K+/jaar", color: "#a78bfa",
              detail: "De langetermijnvisie: SDK-HRM als universele embedded security SDK voor IoT, automotive, wearables, drones en robots. Volume royalties van €0.10-2.00 per device, fleet subscriptions van €1-5/device/maand, SDK licenties van €5K-50K/jaar, en enterprise site licenties van €10K-100K/jaar. De on-device AI markt groeit naar $30.6 miljard in 2029 (25%/jaar). Dit is waar de echte schaal zit." },
          ].map(f => (
            <div key={f.fase} style={{ marginBottom: 12, padding: 14, background: `${f.color}08`, borderRadius: 10, border: `1px solid ${f.color}33` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: `${f.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: f.color, flexShrink: 0 }}>{f.fase}</span>
                  <div>
                    <span style={{ fontWeight: 700, color: f.color, fontSize: 13 }}>{f.naam}</span>
                    <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 8 }}>({f.periode})</span>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>{f.rev}</span>
              </div>
              <div style={{ color: "#d1d5db", fontSize: 11, lineHeight: 1.7 }}>{f.detail}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 6. FINANCE TRACK — VALUE GUARDIAN ── */}
      <Section id="finance" icon="🏦" title="Finance Track — Value Guardian" date="7 Feb 2026" color="#60a5fa" border="#1e40af" bg="#000a1a"
        summary="'Wij beschermen uw GELD, niet alleen uw netwerk' — parallel revenue stream">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>Franky's overtuiging: als je de waarde van geld kunt beschermen, word je altijd serieuzer genomen. De financiele sector is een parallel spoor naast de consumer markt — niet in plaats van, maar als versterking.</p>

          <div style={{ marginTop: 12, marginBottom: 12, padding: 14, background: "#001a33", borderRadius: 10, border: "1px solid #1e40af" }}>
            <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: 13, marginBottom: 10 }}>Positionering: "Value Guardian"</div>
            <p style={{ color: "#93c5fd", fontSize: 12, fontStyle: "italic" }}>"Wij beschermen uw GELD, niet alleen uw netwerk"</p>
            <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 8 }}>Dit onderscheidt SDK-HRM van traditionele security vendors die netwerken beschermen. Value Guardian beschermt direct de financiele waarde — elke euro die niet gestolen wordt is directe, meetbare ROI.</p>
          </div>

          <div style={{ fontWeight: 700, color: "#60a5fa", fontSize: 13, marginTop: 16, marginBottom: 8 }}>Producten voor de financiele sector:</div>
          {[
            { product: "POS Terminal Guard", prijs: "€0.50/terminal/maand", detail: "Beschermt betaalterminals tegen skimming, relay attacks en firmware manipulatie. Draait als embedded agent op de terminal zelf." },
            { product: "Payment Gateway Shield", prijs: "€99/maand", detail: "Real-time transactiemonitoring voor online betalingen. Detecteert frauduleuze transacties, gestolen creditcards en ongebruikelijke patronen." },
            { product: "DORA/PSD2 Compliance", prijs: "€5K-50K/jaar", detail: "Automatische compliance monitoring voor de Europese DORA (Digital Operational Resilience Act) en PSD2 regelgeving. Continue scanning, rapportage en audit-trail." },
            { product: "Claim Fraud Detection", prijs: "€10K-100K/jaar", detail: "Voor verzekeraars: detecteert frauduleuze claims via patroonanalyse. Vergelijkt claims met historische data, detecteert gecoordineerde fraude-ringen en ongebruikelijke tijdspatronen." },
          ].map((p, i) => (
            <div key={i} style={{ marginBottom: 8, padding: 10, background: "#0a1a33", borderRadius: 8, border: "1px solid #1e40af44" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#93c5fd", fontSize: 12 }}>{p.product}</span>
                <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>{p.prijs}</span>
              </div>
              <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>{p.detail}</div>
            </div>
          ))}

          <div style={{ marginTop: 12, padding: 10, background: "#1e1e30", borderRadius: 8, border: "1px solid #454d60" }}>
            <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 12, marginBottom: 6 }}>Belgische Targets:</div>
            <div style={{ fontSize: 11, color: "#d1d5db" }}>Bancontact/Payconiq (nationale betaalinfra), Worldline (HQ Brussel, global payment processor), Ethias (verzekeraar), Billit (facturatie), Aion Bank (digitale bank). Telecom partners: Proximus, Orange, KPN (NL). Banken: Belfius, KBC, ING. Deze partners bieden directe toegang tot miljoenen eindgebruikers via bestaande kanalen.</div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#22c55e", fontWeight: 600 }}>ROI Argument: Bank verliest €50K aan phishing, SDK-HRM kost €500/maand = 100x ROI</div>
          </div>

          <p style={{ marginTop: 12 }}><strong style={{ color: "#fbbf24" }}>Strategisch voordeel:</strong> Een reputatie in de financiele sector opent automatisch deuren naar enterprise klanten, MSPs en investeerders. Als banken je vertrouwen, vertrouwt iedereen je.</p>
        </div>
      </Section>

      {/* ── 7. CHROME EXTENSIE & MONETISATIE ── */}
      <Section id="chrome" icon="🌐" title="Chrome Extensie — Eerste Revenue Stream" date="7 Feb 2026" color="#4ade80" border="#166534" bg="#020f06"
        summary="WASM model lokaal in browser, ExtensionPay/Stripe, ~95% marge">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>De Chrome extensie is het laagst hangend fruit voor eerste revenue. Het unieke: het AI-model draait als WebAssembly (WASM) volledig in de browser van de gebruiker. Er zijn nul hosting kosten — geen servers, geen API calls, geen bandbreedte. De marge is daardoor ~95%.</p>

          <div style={{ marginTop: 12, marginBottom: 12, padding: 14, background: "#052e16", borderRadius: 10, border: "1px solid #166534" }}>
            <div style={{ fontWeight: 700, color: "#86efac", fontSize: 13, marginBottom: 8 }}>Monetisatie via ExtensionPay</div>
            <p style={{ color: "#9ca3af", fontSize: 11, marginBottom: 8 }}>ExtensionPay (extensionpay.com) is een open source bibliotheek die Stripe-betalingen integreert in Chrome extensions. Het ondersteunt maandelijkse en jaarlijkse abonnementen, gratis proefperiodes, en automatische licentie-validatie.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { tier: "Gratis", prijs: "€0", features: "10 scans/dag, basis bescherming" },
                { tier: "Pro", prijs: "€4.99/mnd", features: "Onbeperkt scans, dashboard, alerts" },
                { tier: "Gezin", prijs: "€9.99/mnd", features: "Tot 5 apparaten, familie dashboard" },
              ].map(t => (
                <div key={t.tier} style={{ padding: 10, background: "#0a1a0a", borderRadius: 8, border: "1px solid #16653444", textAlign: "center" }}>
                  <div style={{ fontWeight: 700, color: "#4ade80", fontSize: 13 }}>{t.tier}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#22c55e", margin: "6px 0" }}>{t.prijs}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{t.features}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, textAlign: "center", fontWeight: 700, color: "#22c55e", fontSize: 13 }}>Doel: €5.000/maand MRR binnen 6 maanden</div>
          </div>

          <p><strong style={{ color: "#f97316" }}>Waarom WASM?</strong> Het model wordt gecompileerd naar WebAssembly en draait volledig in de browser. Dit betekent: privacy (geen data verlaat het apparaat), snelheid (geen netwerk latency), en nul infrastructuurkosten. De gebruiker download de extensie en alles werkt offline. Updates van het model worden via de Chrome Web Store verspreid.</p>
        </div>
      </Section>

      {/* ── 8. DATA FLYWHEEL ── */}
      <Section id="flywheel" icon="🔄" title="Data Flywheel — Competitive Moat (Waze-model)" date="7 Feb 2026" color="#f472b6" border="#86198f" bg="#0f000f"
        summary="User feedback → beter model → meer users → ONVERSLAANBAAR">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>Franky's kerninsight: de data flywheel is het echte competitief voordeel. Net als Waze wordt de service beter naarmate meer mensen hem gebruiken — en dat voordeel is cumulatief en bijna onmogelijk in te halen.</p>

          {/* Flywheel Diagram */}
          <div style={{ marginTop: 12, marginBottom: 12, padding: 14, background: "#1a0a1a", borderRadius: 10, border: "1px solid #86198f", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#f9a8d4", lineHeight: 2.2 }}>
              <div style={{ fontWeight: 700, color: "#f472b6" }}>De Flywheel Cyclus:</div>
              <div>User scant email/website/bericht</div>
              <div style={{ color: "#6b7280" }}>↓</div>
              <div>Model geeft risicoscore</div>
              <div style={{ color: "#6b7280" }}>↓</div>
              <div>User geeft feedback (✓ correct / ✗ fout)</div>
              <div style={{ color: "#6b7280" }}>↓</div>
              <div style={{ color: "#22c55e", fontWeight: 700 }}>GRATIS training data!</div>
              <div style={{ color: "#6b7280" }}>↓</div>
              <div>Model wordt beter</div>
              <div style={{ color: "#6b7280" }}>↓</div>
              <div>Meer tevreden users</div>
              <div style={{ color: "#6b7280" }}>↓</div>
              <div style={{ fontWeight: 700, color: "#f472b6" }}>Meer users → meer data → beter model → ONVERSLAANBAAR</div>
            </div>
          </div>

          <div style={{ fontWeight: 700, color: "#f472b6", marginBottom: 6 }}>Hoe privacy behouden blijft:</div>
          <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
            <li><strong>Hash-based sharing:</strong> Alleen SHA-256 hashes van URLs, emails en patronen worden gedeeld — nooit de werkelijke content.</li>
            <li><strong>Anonieme patronen:</strong> Gedeelde features zijn abstract: patroontype, tijdstip, verdict, regio. Geen persoonlijke data.</li>
            <li><strong>Federated learning:</strong> Het model leert van de patronen zonder dat de data het apparaat van de gebruiker verlaat.</li>
            <li><strong>GDPR compliant:</strong> Geen persoonlijk identificeerbare informatie wordt ooit opgeslagen of verstuurd.</li>
          </ul>

          <div style={{ fontWeight: 700, color: "#f472b6", marginBottom: 6 }}>Collectieve intelligentie:</div>
          <p>Wanneer een URL door 500 gebruikers als scam wordt gemeld, wordt die automatisch geblokkeerd voor alle gebruikers. Wanneer meerdere gebruikers een nieuw patroon melden dat het model niet herkent, wordt er onmiddellijk alarm geslagen — zero-day detectie door de crowd, niet door onderzoekers.</p>
          <p style={{ marginTop: 8, color: "#22c55e", fontWeight: 600 }}>Dit is het Waze-model voor security: hoe meer mensen rijden, hoe beter de kaart. Hoe meer mensen scannen, hoe beter de bescherming.</p>
        </div>
      </Section>

      {/* ── 9. EMBEDDED SDK MARKT ── */}
      <Section id="embedded" icon="📡" title="Embedded SDK Markt — $30.6B (2029)" date="7 Feb 2026" color="#22d3ee" border="#0e7490" bg="#001015"
        summary="Software-only oplossing voor IoT, automotive, wearables, drones, robots">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>SDK-HRM als universele embedded security SDK is een software-only oplossing die op ELKE chip draait — geen custom hardware nodig. Dit maakt het complementair aan hardware security van Qualcomm/NXP, niet concurrent.</p>

          <div style={{ fontWeight: 700, color: "#22d3ee", fontSize: 13, marginTop: 12, marginBottom: 8 }}>Target Markten:</div>
          {[
            { markt: "Automotive", prijs: "€0.50-2/auto", detail: "CAN-bus monitoring voor ongeautoriseerde communicatie, sensor spoofing detectie (GPS, LIDAR, camera), firmware integrity verificatie. Elke moderne auto heeft 100+ ECU's die beveiligd moeten worden." },
            { markt: "Wearables", prijs: "€0.25-1/device", detail: "Voice authenticatie op smartwatches, health data bescherming, biometrische spoofing detectie. Gevoelige gezondheidsdata vereist on-device bescherming." },
            { markt: "Smart Home", prijs: "€0.10-0.50/device", detail: "Voice command authenticatie (voorkom dat buren je smart speaker aansturen), camera privacy bescherming, brute-force login detectie op smart locks en deurbellen." },
            { markt: "Robots & Fabrieken", prijs: "€5K-50K/site", detail: "Command verificatie (alleen geautoriseerde operators), operationele anomalie detectie (robot doet iets onverwachts), safety override bescherming." },
            { markt: "Drones", prijs: "€1-5/drone", detail: "GPS spoofing detectie (voorkom dat drones worden ontvoerd), command authenticatie, cargo verificatie. Kritiek voor delivery drones en militaire toepassingen." },
          ].map((m, i) => (
            <div key={i} style={{ marginBottom: 8, padding: 10, background: "#001a1a", borderRadius: 8, border: "1px solid #0e749033" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#67e8f9", fontSize: 12 }}>{m.markt}</span>
                <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>{m.prijs}</span>
              </div>
              <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>{m.detail}</div>
            </div>
          ))}

          <div style={{ marginTop: 12, padding: 12, background: "#1e1e30", borderRadius: 8, border: "1px solid #454d60" }}>
            <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 12, marginBottom: 6 }}>Marktcijfers:</div>
            <div style={{ fontSize: 11, color: "#d1d5db" }}>On-device AI markt: $30.6 miljard in 2029 (25% groei/jaar). Embedded IoT security: $18.3 miljard in 2033 (11.5% groei/jaar). Automotive = 25% van IoT security, snelst groeiend segment.</div>
          </div>

          <div style={{ marginTop: 12, padding: 12, background: "#0a1a0a", borderRadius: 8, border: "1px solid #16653444" }}>
            <div style={{ fontWeight: 700, color: "#22c55e", fontSize: 12, marginBottom: 6 }}>4-Tier Revenue Model:</div>
            {[
              "OEM: €0.10-2.00 per device (volume royalty bij fabrikant)",
              "Fleet: €1-5/device/maand (subscription voor vlootbeheerders)",
              "SDK License: €5K-50K/jaar (voor developers die integreren)",
              "Enterprise: €10K-100K/jaar (site license, NIS2 compliance)",
            ].map((r, i) => (
              <div key={i} style={{ fontSize: 11, color: "#86efac", padding: "3px 0" }}>{i + 1}. {r}</div>
            ))}
            <div style={{ marginTop: 8, fontWeight: 700, color: "#f97316", fontSize: 12 }}>Totaal potentieel: €8M+/jaar (conservatief)</div>
          </div>

          <p style={{ marginTop: 12 }}><strong style={{ color: "#22d3ee" }}>Killer argument:</strong> SDK-HRM is software-only, 27MB klein, updatebaar via LoRA in seconden, en privacy-first lokaal. Hardware security (Qualcomm/NXP) vereist een speciale chip, firmware updates duren maanden, en werken vaak via de cloud. SDK-HRM kan bovenop ELKE hardware draaien als extra beveiligingslaag.</p>
        </div>
      </Section>

      {/* ── 10. MODEL SECURITY ── */}
      <Section id="security" icon="🔐" title="5-Laags Model Bescherming" date="7 Feb 2026" color="#ef4444" border="#991b1b" bg="#0f0000"
        summary="Open base + geheime LoRA adapters = recurring revenue">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>Het beschermen van het AI-model is cruciaal voor het businessmodel. De strategie: maak het basismodel open source (vertrouwen, community), maar houd de gespecialiseerde LoRA adapters geheim, versleuteld en device-locked.</p>

          {[
            { laag: 1, naam: "Runtime Integrity", detail: "Bij elke start van het model wordt een hash-check uitgevoerd. De hash van de gewichten wordt vergeleken met de officieel gepubliceerde hash (op blockchain). Als er ook maar 1 byte gewijzigd is, weigert het model te starten." },
            { laag: 2, naam: "Code Obfuscation", detail: "De inference code wordt beschermd met anti-debugging technieken, integrity checks en verstoorde control flow. Dit maakt het veel moeilijker om het model te reverse-engineeren of te kopiëren." },
            { laag: 3, naam: "Encrypted Weights", detail: "Model gewichten worden op schijf versleuteld met AES-256. De sleutel is gebonden aan het specifieke device (hardware ID + secure enclave). Zelfs als iemand de bestanden kopieert, zijn ze waardeloos op een ander apparaat. Anti-memory-dump bescherming voorkomt dat de gedecrypteerde gewichten uit het werkgeheugen worden gestolen." },
            { laag: 4, naam: "Modulaire LoRA Adapters", detail: "Het basismodel (LFM2 + HRM) is open source — iedereen kan het gebruiken en vertrouwen. Maar de gespecialiseerde LoRA adapters (10-50MB per adapter) zijn GEHEIM, versleuteld, en device-locked. Nieuwe adapters worden maandelijks geleverd als onderdeel van het abonnement. Dit is het recurring revenue model: open base + betaalde specialisatie." },
            { laag: 5, naam: "Blockchain Verificatie", detail: "Weight hashes worden op de blockchain gepubliceerd. Gebruikers kunnen verifiëren dat hun model-versie de officiele is — tamper-proof updates. Niemand kan een gewijzigd model distribueren zonder dat het detecteerbaar is." },
          ].map((l, i) => (
            <div key={i} style={{ marginBottom: 10, padding: 12, background: "#1a0000", borderRadius: 8, border: "1px solid #991b1b33" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: "#ef444422", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#ef4444", flexShrink: 0 }}>{l.laag}</span>
                <span style={{ fontWeight: 700, color: "#fca5a5", fontSize: 12 }}>{l.naam}</span>
              </div>
              <div style={{ color: "#d1d5db", fontSize: 11, marginTop: 6, lineHeight: 1.7 }}>{l.detail}</div>
            </div>
          ))}

          <div style={{ marginTop: 8, padding: 10, background: "#1e1e30", borderRadius: 8, border: "1px solid #454d60" }}>
            <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 12, marginBottom: 6 }}>Deployment Groottes:</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, fontSize: 11, color: "#d1d5db" }}>
              <div><strong style={{ color: "#f97316" }}>HRM-27M:</strong> 27MB (int8) — 109MB (float32)</div>
              <div><strong style={{ color: "#a78bfa" }}>LFM2-2.6B:</strong> 1.6GB (int4) — 5.2GB (float16)</div>
              <div><strong style={{ color: "#22c55e" }}>Gecombineerd geoptimaliseerd:</strong> 2.1GB</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 11. BLOCKCHAIN TRUST LAYER ── */}
      <Section id="blockchain" icon="⛓️" title="Blockchain Trust Layer" date="7 Feb 2026" color="#fbbf24" border="#854d0e" bg="#0f0a00"
        summary="Decentralized trust, ZKP privacy, tamper-proof model updates">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>Franky's visie: blockchain als vertrouwenslaag voor het hele SDK-HRM ecosysteem. Niet blockchain om blockchain, maar voor concrete doelen: verificatie, privacy en decentralisatie.</p>

          {[
            { feature: "Model Integrity via Immutable Ledger", detail: "Elke model update krijgt een hash die op een immutable ledger wordt opgeslagen. Gebruikers kunnen verifiëren of hun SDK-HRM versie overeenkomt met het official blockchain record. Dit voorkomt malicious model injection en backdoor attacks — als iemand het model wijzigt, klopt de hash niet meer. Bij elke bewerking (edit) van het model wordt de modificatie gelogd, waardoor de volledige geschiedenis traceerbaar is." },
            { feature: "Decentralized Threat Intelligence", detail: "Wanneer een gebruiker een scam meldt, wordt de hash recorded op de blockchain zonder private data exposure. Geen enkel bedrijf kan de threat database manipuleren of censureren — het is een distributed ledger waar iedereen aan bijdraagt. Federated learning proofs worden ook op de blockchain vastgelegd voor transparantie: je kunt bewijzen dat het model eerlijk is getraind zonder de trainingsdata te onthullen." },
            { feature: "Content Authenticity & Timestamps", detail: "Originele foto's en video's krijgen een creation timestamp op de chain die hun authenticiteit bewijst. AI-gegenereerde content die GEEN originele blockchain timestamp heeft wordt automatisch als verdacht gemarkeerd. Dit maakt het mogelijk om deepfakes te onderscheiden van echte content op basis van cryptografisch bewijs, niet alleen op basis van AI-detectie." },
            { feature: "Voiceprint Privacy via Hash", detail: "Voiceprint baselines worden opgeslagen als hash — nooit als actual recording. Dit is cruciaal voor privacy: zelfs als de database gelekt wordt, kan niemand je stem reconstrueren uit een hash. De blockchain bewaart alleen de hash en een timestamp, zodat voiceprint verificatie mogelijk is zonder dat je stemopname ooit het apparaat verlaat." },
            { feature: "Business Verification (KVK/BTW)", detail: "KVK en BTW nummers worden geverifieerd tegen on-chain records. Bedrijfsidentiteiten zijn cryptografisch bewezen — je kunt niet claimen een bedrijf te zijn dat je niet bent. Dit beschermt tegen nep-webshops, vervalste facturen en Business Email Compromise waarbij aanvallers zich voordoen als een leverancier." },
            { feature: "Zero-Knowledge Proofs (ZKP)", detail: "Privacy-behoudende identiteitsverificatie die BEWIJST zonder te ONTHULLEN. Een ouder persoon kan bewijzen dat die volwassen is zonder geboortedatum te delen. Een bedrijf kan bewijzen dat het geregistreerd is zonder het KVK-nummer prijs te geven. Dit lost het fundamentele probleem op: hoe verifieer je identiteit online zonder je privacy op te geven? ZKP maakt het wiskundig mogelijk." },
            { feature: "Decentralized Model Marketplace", detail: "Community leden kunnen dreigingsmodules (LoRA adapters) bijdragen aan het ecosysteem. Revenue verdeling via smart contracts — automatisch, transparant, eerlijk, zonder menselijke interventie. Module creators ontvangen automatisch een percentage van de abonnementsinkomsten wanneer hun module wordt gebruikt. Dit creëert een open innovatie-ecosysteem waar security researchers worden beloond voor het bijdragen van nieuwe detectie-capabilities." },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: 6, padding: 8, background: "#1a1400", borderRadius: 6, border: "1px solid #854d0e33" }}>
              <div style={{ fontWeight: 600, color: "#fde68a", fontSize: 11 }}>{f.feature}</div>
              <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 3 }}>{f.detail}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 12. TRAINING DOMEINEN ── */}
      <Section id="domains" icon="📊" title="66 Training Domeinen — 10 Lagen" date="7 Feb 2026" color="#a78bfa" border="#5b21b6" bg="#080020"
        summary="Van core scam detection tot contextual threats — 1.05M samples target">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>Het model traint op 66 specifieke domeinen, georganiseerd in 10 lagen van toenemende complexiteit. Het doel is uiteindelijk ~1.051.000 training samples te verzamelen over alle domeinen.</p>

          {[
            { laag: "Layer 1: Core Scam (11)", color: "#ef4444", items: "Phishing URL, credential theft, urgency+fear, reward+lottery, impersonation, romance scam, investment scam, BEC (Business Email Compromise), tech support scam, subscription trap, delivery scam" },
            { laag: "Layer 2: Communication (6)", color: "#f59e0b", items: "Time anomaly detection, language deviation, sender reputation, contact baseline, context mismatch, channel anomaly" },
            { laag: "Layer 3: Device & Identity (6)", color: "#22c55e", items: "Device fingerprint, IP geolocation, behavior biometrics, login anomaly, session hijack, MFA bypass" },
            { laag: "Layer 4: Voice & Audio (8)", color: "#3b82f6", items: "Voiceprint match, stress/fear detection, background noise analysis, voice cloning, deepfake voice, call center detection, robocall patterns, social engineering voice" },
            { laag: "Layer 5: Visual (7)", color: "#a855f7", items: "AI-generated image, deepfake video, manipulated document, fake screenshot, watermark analysis, EXIF metadata analysis, reverse image search" },
            { laag: "Layer 6: Web Protection (8)", color: "#06b6d4", items: "Bot detection, SQLi/XSS prevention, credential stuffing, GDPR compliance, plugin vulnerability, social media verification, SSL/certificate anomaly, content injection" },
            { laag: "Layer 7: Malware (6)", color: "#ec4899", items: "APK analysis, browser extension scan, desktop app scan, ransomware pattern, cryptominer detection, data exfiltration" },
            { laag: "Layer 8: Financial (5)", color: "#f97316", items: "Transaction anomaly, invoice fraud, CEO fraud, payment redirect, money mule detection" },
            { laag: "Layer 9: Platform-Specific (5)", color: "#10b981", items: "Marketplace fraud, review manipulation, fake listing, escrow scam, return fraud" },
            { laag: "Layer 10: Contextual (4)", color: "#6366f1", items: "Elderly-specific patterns, regional threats (BE/NL), seasonal scams, emerging threat patterns" },
          ].map((l, i) => (
            <div key={i} style={{ marginBottom: 6, padding: 10, background: `${l.color}08`, borderRadius: 8, border: `1px solid ${l.color}22` }}>
              <div style={{ fontWeight: 600, color: l.color, fontSize: 12, marginBottom: 4 }}>{l.laag}</div>
              <div style={{ color: "#9ca3af", fontSize: 10 }}>{l.items}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 13. INFRANODUS GRAPHS ── */}
      <Section id="graphs" icon="🕸️" title="19 InfraNodus Knowledge Graphs" date="7 Feb 2026" color="#06b6d4" border="#0e7490" bg="#001015"
        summary="Complete kennisinfrastructuur op InfraNodus — alle strategische beslissingen gelogd">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>Alle strategische kennis, inzichten en beslissingen zijn vastgelegd in 19 InfraNodus knowledge graphs. Elke graph bevat meerdere topical clusters die de relaties tussen concepten visualiseren.</p>

          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { naam: "SDK-HRM-vision", desc: "Overkoepelende productvisie en missie" },
              { naam: "SDK-HRM-website_monitoring", desc: "10 clusters — website bescherming en compliance" },
              { naam: "SDK-HRM-mobile_agent", desc: "Mobiele bescherming en messaging" },
              { naam: "SDK-HRM-email_guardian", desc: "11 clusters — email security en phishing detectie" },
              { naam: "SDK-HRM-fraud_protection", desc: "11 clusters — fraude patronen en detectie" },
              { naam: "SDK-HRM-revenue_model", desc: "Revenue streams en pricing strategie" },
              { naam: "SDK-HRM-training-priorities", desc: "14 clusters — training volgorde en prioriteiten" },
              { naam: "SDK-HRM-franky-vision", desc: "16 clusters — Franky's leertraject en visie" },
              { naam: "SDK-HRM-roadmap-gaps", desc: "16 clusters — ontbrekende features en gaps" },
              { naam: "SDK-HRM-scam-patterns-v2", desc: "Multilinguaal — NL/FR/EN scam patronen" },
              { naam: "SDK-HRM-website-guardian", desc: "16 clusters — compliance, GDPR, NIS2" },
              { naam: "SDK-HRM-full-product-map", desc: "16 clusters — complete 18-module productkaart" },
              { naam: "SDK-HRM-voice-visual-shield", desc: "16 clusters — voice/visual/malware bescherming" },
              { naam: "SDK-HRM-model-comparison", desc: "LFM2-2.6B vs HRM-27M analyse" },
              { naam: "SDK-HRM-nested-architecture", desc: "Nested model + compression visie" },
              { naam: "SDK-HRM-blockchain-trust", desc: "16 clusters — blockchain + ZKP + trust" },
              { naam: "SDK-HRM-model-security", desc: "16 clusters — 5-laags bescherming" },
              { naam: "SDK-HRM-embedded-market", desc: "16 clusters — IoT/automotive/drones markt" },
              { naam: "SDK-HRM-finance-strategy", desc: "8 clusters — financiele sector GTM" },
            ].map((g, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#001a1a", borderRadius: 6, border: "1px solid #0e749022" }}>
                <span style={{ fontSize: 8, padding: "2px 5px", borderRadius: 3, background: "#06b6d415", color: "#67e8f9", border: "1px solid #0e749033", whiteSpace: "nowrap", fontFamily: "monospace" }}>{g.naam}</span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>{g.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── 14. CONTINUOUS LEARNING ── */}
      <Section id="learning" icon="🔬" title="Continuous Learning System" date="7 Feb 2026" color="#8b5cf6" border="#6d28d9" bg="#0a0020"
        summary="Federated learning, Nested Learning, LoRA swapping, adversarial training">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>Het model is niet statisch — het leert continu bij via meerdere mechanismen die samenwerken.</p>

          {[
            { tech: "Federated Learning", detail: "Deelt patronen tussen gebruikers zonder private data te onthullen. Alleen abstracte features worden gedeeld: patroontype, tijdstip, verdict, regio. Het model op elk device leert van de collectieve intelligentie zonder dat iemands email of berichten ooit het apparaat verlaten." },
            { tech: "Google Nested Learning (NeurIPS 2025)", detail: "Multi-timescale aanpak: snelle modules worden maandelijks bijgewerkt met nieuwe dreigingen, terwijl de trage kern-modules stabiel blijven. Het Continuum Memory System voorkomt catastrophic forgetting — nieuwe kennis overschrijft geen oude kennis." },
            { tech: "LoRA Adapter Swapping", detail: "Kleine adapters (10-50MB) worden maandelijks geleverd als onderdeel van het abonnement. Deze adapters specialiseren het basismodel voor nieuwe dreigingen zonder het hele model te hertrainen. Swappen duurt seconden, niet uren." },
            { tech: "Adversarial Training", detail: "Het model wordt getraind tegen adversariale aanvallen — inputs die specifiek ontworpen zijn om het model te misleiden. Dit maakt het robuuster tegen geavanceerde aanvallers die de detectie proberen te omzeilen." },
            { tech: "Knowledge Distillation", detail: "Kennis van grotere modellen wordt gedestilleerd naar het compacte HRM-model. Het model wordt slimmer zonder groter te worden — cruciaal voor edge devices met beperkt geheugen." },
          ].map((t, i) => (
            <div key={i} style={{ marginBottom: 8, padding: 10, background: "#0f0033", borderRadius: 8, border: "1px solid #6d28d933" }}>
              <div style={{ fontWeight: 600, color: "#c4b5fd", fontSize: 12 }}>{t.tech}</div>
              <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>{t.detail}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Footer */}
      <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
        <p><strong>Laatste update:</strong> 7 februari 2026 — MM4 Training Sessie</p>
        <p style={{ marginTop: 4 }}><strong>Bronnen:</strong> 19 InfraNodus graphs, ARC training logs, sessie-notities</p>
        <p style={{ marginTop: 4 }}><strong>Opmerking:</strong> Deze tab bevat de volledige uitgesproken teksten en analyses uit de trainingssessie. Klik op elk onderdeel om de complete uitleg te lezen.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V16 TAB: TRAINING & BENCHMARK RESULTS
// ═══════════════════════════════════════════════════════════════════════════════
// ── SVG Mini Chart Component (reusable for all training runs) ──
function MiniChart({ data, width = 500, height = 180, color = "#ef4444", label = "", yMin, yMax, gridLines = 5 }) {
  if (!data || data.length === 0) return null;
  const pad = { top: 20, right: 15, bottom: 30, left: 55 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const dMin = yMin !== undefined ? yMin : Math.min(...data.map(d => d.y));
  const dMax = yMax !== undefined ? yMax : Math.max(...data.map(d => d.y));
  const xMin = data[0].x;
  const xMax = data[data.length - 1].x;
  const sx = (v) => pad.left + ((v - xMin) / (xMax - xMin || 1)) * w;
  const sy = (v) => pad.top + h - ((v - dMin) / (dMax - dMin || 1)) * h;
  const pts = data.map(d => `${sx(d.x)},${sy(d.y)}`).join(" ");
  const areaPath = `M${sx(data[0].x)},${sy(data[0].y)} ${data.map(d => `L${sx(d.x)},${sy(d.y)}`).join(" ")} L${sx(data[data.length-1].x)},${pad.top + h} L${sx(data[0].x)},${pad.top + h} Z`;

  return (
    <div style={{ background: "#0a0a14", border: "1px solid #2d3748", borderRadius: 10, padding: 12 }}>
      {label && <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb", marginBottom: 8 }}>{label}</div>}
      <svg width={width} height={height} style={{ display: "block", maxWidth: "100%" }} viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const yVal = dMin + (dMax - dMin) * (i / gridLines);
          const y = sy(yVal);
          return (
            <g key={i}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#2d3748" strokeWidth="1" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#6b7280" fontSize="10">{yVal < 0.01 ? yVal.toExponential(1) : yVal.toFixed(yVal >= 10 ? 0 : yVal >= 1 ? 1 : 2)}</text>
            </g>
          );
        })}
        {/* X axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const xVal = xMin + (xMax - xMin) * frac;
          return <text key={i} x={sx(xVal)} y={height - 5} textAnchor="middle" fill="#6b7280" fontSize="10">{Math.round(xVal).toLocaleString()}</text>;
        })}
        {/* Area fill */}
        <path d={areaPath} fill={`${color}15`} />
        {/* Line */}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {/* Last value dot */}
        <circle cx={sx(data[data.length-1].x)} cy={sy(data[data.length-1].y)} r="4" fill={color} stroke="#0a0a14" strokeWidth="2" />
      </svg>
    </div>
  );
}

function TrainingBenchmarks() {
  const { isPhone, S } = useDevice();
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // ── ARC Training History (downsampled from 5750 points → 115) ──
  const arcSteps = [1,51,101,151,201,251,301,351,401,451,501,551,601,651,701,751,801,851,901,951,1001,1051,1101,1151,1201,1251,1301,1351,1401,1451,1501,1551,1601,1651,1701,1751,1801,1851,1901,1951,2001,2051,2101,2151,2201,2251,2301,2351,2401,2451,2501,2551,2601,2651,2701,2751,2801,2851,2901,2951,3001,3051,3101,3151,3201,3251,3301,3351,3401,3451,3501,3551,3601,3651,3701,3751,3801,3851,3901,3951,4001,4051,4101,4151,4201,4251,4301,4351,4401,4451,4501,4551,4601,4651,4701,4751,4801,4851,4901,4951,5001,5051,5101,5151,5201,5251,5301,5351,5401,5451,5501,5551,5601,5651,5701];
  const arcLoss = [2.7323,2.6798,2.3786,1.7949,2.1589,1.464,2.2551,1.6554,1.251,1.7287,1.8716,1.7593,1.5031,1.6786,1.4269,1.5783,1.1204,1.3658,1.1758,1.9446,1.1885,2.682,1.4007,1.5184,1.1154,1.5492,1.0048,1.6342,1.9077,1.0053,1.6566,2.5146,1.2317,1.0916,1.2589,1.0145,0.9974,1.3844,1.9494,1.9722,1.1972,0.7943,1.2775,1.4697,2.0075,0.8404,1.8418,0.766,2.3137,1.7217,0.8972,1.3614,2.0735,1.4303,0.6946,1.3476,1.0254,1.5379,1.3989,0.8474,2.2193,3.2861,1.0277,1.5361,1.5653,0.8906,1.3397,1.7072,2.2011,1.2989,1.3283,1.8093,1.3127,0.7283,1.6299,2.105,1.1624,1.5137,1.8393,0.6879,0.7499,1.5506,0.3727,0.7788,1.8101,2.0725,1.3116,0.8675,1.8862,1.3137,0.6879,1.2501,1.3001,2.121,1.3327,1.3516,0.6621,1.7765,1.9694,1.3543,1.3816,1.3178,1.3372,0.9762,0.4506,2.3025,1.1854,1.4543,0.6898,1.5618,0.6825,1.5653,2.0113,1.8494,1.7575];
  const arcAcc = [0.0,0.0,0.0177,0.1158,0.0311,0.2711,0.0678,0.1311,0.3378,0.0689,0.0189,0.16,0.1933,0.1511,0.2478,0.12,0.4,0.2556,0.3344,0.0733,0.3067,0.0067,0.1711,0.1467,0.3867,0.1422,0.47,0.1578,0.0689,0.4456,0.12,0.0267,0.2622,0.4244,0.3244,0.4533,0.4333,0.2444,0.0256,0.0122,0.3433,0.5889,0.2333,0.2189,0.0433,0.5389,0.1267,0.6222,0.0078,0.12,0.4911,0.2356,0.0122,0.17,0.6544,0.2533,0.4089,0.1878,0.2511,0.4844,0.0478,0.0011,0.39,0.1578,0.1622,0.4667,0.25,0.0922,0.0378,0.2867,0.2278,0.0789,0.2756,0.5978,0.1133,0.0267,0.3311,0.2189,0.0744,0.6622,0.6167,0.1733,0.9283,0.5722,0.0811,0.04,0.2889,0.4811,0.0333,0.2689,0.6578,0.3,0.3478,0.0233,0.2556,0.2811,0.6767,0.0533,0.0067,0.2,0.2444,0.2733,0.2822,0.4433,0.7722,0.0078,0.3411,0.2067,0.66,0.1578,0.65,0.1489,0.0111,0.0967,0.8067];
  const arcLR = [0.0000001,0.00000105,0.00000199,0.00000293,0.00000387,0.00000481,0.00000575,0.00000669,0.00000764,0.00000858,0.00000952,0.00001046,0.0000114,0.00001234,0.00001328,0.00001422,0.00001517,0.00001611,0.00001705,0.00001799,0.00001893,0.00001987,0.00002081,0.00002175,0.0000227,0.00002364,0.00002458,0.00002552,0.00002646,0.0000274,0.00002834,0.00002928,0.00003023,0.00003117,0.00003211,0.00003305,0.00003399,0.00003493,0.00003587,0.00003681,0.00003776,0.0000387,0.00003964,0.00004058,0.00004152,0.00004246,0.0000434,0.00004434,0.00004529,0.00004623,0.00004717,0.00004811,0.00004905,0.00004999,0.00005093,0.00005187,0.00005281,0.00005376,0.0000547,0.00005564,0.00005658,0.00005752,0.00005846,0.0000594,0.00006034,0.00006129,0.00006223,0.00006317,0.00006411,0.00006505,0.00006599,0.00006693,0.00006787,0.00006882,0.00006976,0.0000707,0.00007164,0.00007258,0.00007352,0.00007446,0.0000754,0.00007635,0.00007729,0.00007823,0.00007917,0.00008011,0.00008105,0.00008199,0.00008293,0.00008388,0.00008482,0.00008576,0.0000867,0.00008764,0.00008858,0.00008952,0.00009046,0.00009141,0.00009235,0.00009329,0.00009423,0.00009517,0.00009611,0.00009705,0.00009799,0.00009894,0.00009988,0.0001,0.0001,0.0001,0.0001,0.0001,0.0001,0.0001,0.0001];
  const arcLossData = arcSteps.map((s, i) => ({ x: s, y: arcLoss[i] }));
  const arcAccData = arcSteps.map((s, i) => ({ x: s, y: arcAcc[i] }));
  const arcLRData = arcSteps.map((s, i) => ({ x: s, y: arcLR[i] }));

  // ARC Pre-training data
  const arcTraining = {
    model: "Sapient-HRM 27.3M",
    architecture: "ACT + HRM (H-level 4L/2C, L-level 4L/4C)",
    device: "Mac Mini M4 (MPS)",
    dataset: "ARC-aug-1000 puzzles",
    totalSteps: 5750,
    targetSteps: 7695,
    finalAccuracy: 65.94,
    speed: "~1.70 sec/step",
    trainingTime: "2h 52min",
    checkpointSize: "1.8GB",
    status: "COMPLETE"
  };

  // LFM2 Benchmark data
  const lfm2Baseline = {
    model: "LFM2-2.6B-4bit-MLX (Liquid AI)",
    params: "2.569B (4-bit quantized)",
    scenarios: 209,
    categories: 13,
    languages: ["NL", "FR", "EN"],
    totalAccuracy: 86.1,
    scamDetection: 100,
    safeDetection: 0,
    speed: "1.1 sec/scenario",
    totalTime: "237s"
  };

  const lfm2FineTuned = {
    adapter: "LoRA (3.26M trainable, 0.127%)",
    trainingIters: 300,
    trainingLossStart: 3.6,
    trainingLossEnd: 0.43,
    trainingTime: "~5 min",
    totalAccuracy: 98.1,
    scamDetection: 99.5,
    safeDetection: 88,
    speed: "1.1 sec/scenario",
    totalTime: "229s"
  };

  // Category results
  const categoryResults = [
    { cat: "Urgency/Credential", before: 100, after: 100, total: 18, icon: "🏦" },
    { cat: "Reward/Payment", before: 100, after: 100, total: 18, icon: "🎁" },
    { cat: "Impersonation", before: 100, after: 100, total: 18, icon: "👤" },
    { cat: "Elderly Targeted", before: 100, after: 94, total: 18, icon: "👴" },
    { cat: "Romance Scam", before: 100, after: 100, total: 16, icon: "💕" },
    { cat: "Investment Fraud", before: 100, after: 100, total: 16, icon: "💰" },
    { cat: "Deepfake/AI", before: 100, after: 100, total: 15, icon: "🤖" },
    { cat: "BEC", before: 100, after: 100, total: 15, icon: "📧" },
    { cat: "Time Anomaly", before: 100, after: 100, total: 12, icon: "⏰" },
    { cat: "Language Deviation", before: 100, after: 100, total: 12, icon: "🗣️" },
    { cat: "Device Anomaly", before: 100, after: 100, total: 12, icon: "📱" },
    { cat: "Wearable", before: 67, after: 100, total: 15, icon: "⌚" },
    { cat: "Safe/Legitimate", before: 0, after: 88, total: 24, icon: "✅" },
  ];

  const langResults = [
    { lang: "Frans (FR)", before: 87, after: 100, icon: "🇫🇷" },
    { lang: "Engels (EN)", before: 86, after: 99, icon: "🇬🇧" },
    { lang: "Nederlands (NL)", before: 86, after: 96, icon: "🇳🇱" },
  ];

  // Commercial readiness checklist
  const readiness = [
    { item: "Proof-of-concept fine-tuning", done: true },
    { item: "Meertalig NL/FR/EN getest", done: true },
    { item: "LoRA adapter systeem bewezen", done: true },
    { item: "On-device inference (M4, 1.1s/scenario)", done: true },
    { item: "Privacy-first (geen cloud)", done: true },
    { item: "5.000+ test scenarios", done: false },
    { item: "Externe validatie dataset", done: false },
    { item: "Real-world phishing emails getest", done: false },
    { item: "Vergelijking met Gmail/Defender", done: false },
    { item: "Precision/Recall/F1 rapportage", done: false },
    { item: "Zero-day detectie bewezen", done: false },
  ];

  // Helper: progress bar
  const Bar = ({ value, max, color, label }) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: "#9ca3af" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{value}%</span>
      </div>
      <div style={{ height: 8, background: "#1a1a2e", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s" }} />
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0a1628, #0f0f23, #1a0a2e)", border: "2px solid #60a5fa", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 24, background: "linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Training & Benchmark Results
            </div>
            <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 6 }}>Alle trainingsruns, benchmarks en commerciële validatie op één plek</p>
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>Laatste update: 8 februari 2026</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "78.9%", sub: "OOD hybrid", color: "#22c55e" },
              { label: "445", sub: "OOD scenarios", color: "#60a5fa" },
              { label: "3 talen", sub: "NL/FR/EN", color: "#fbbf24" },
              { label: "6/11", sub: "readiness", color: "#f97316" },
            ].map(m => (
              <div key={m.sub} style={{ textAlign: "center", padding: "8px 14px", background: `${m.color}11`, border: `1px solid ${m.color}44`, borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.label}</div>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RUN 1: ARC PRE-TRAINING ── */}
      <div style={{ background: "#0f0800", border: "1px solid #9a3412", borderRadius: 12, padding: 0, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit ARC sectie" aria-expanded={!!expanded.arc} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("arc")} onClick={() => toggle("arc")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.arc ? "#f9731611" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>🧠</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#f97316", fontSize: 15 }}>Run 1: ARC Pre-Training — Sapient-HRM 27.3M</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>6 Feb 2026</div>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>5750 stappen • 65.94% accuracy • COMPLETE</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 8 }}>
            <span style={{ padding: "3px 10px", borderRadius: 6, background: "#22c55e22", color: "#4ade80", fontSize: 11, fontWeight: 600 }}>✓ COMPLETE</span>
            <span style={{ color: "#6b7280", fontSize: 16, transition: "transform 0.2s", transform: expanded.arc ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </div>
        </div>
        {expanded.arc && (
          <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid #9a341233" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginTop: 12 }}>
              {[
                { label: "Parameters", value: "27.3M", color: "#f97316" },
                { label: "Architectuur", value: "ACT+HRM", color: "#a78bfa" },
                { label: "Device", value: "MPS M4", color: "#60a5fa" },
                { label: "Steps", value: "5750", color: "#22c55e" },
                { label: "Accuracy", value: "65.94%", color: "#fbbf24" },
                { label: "Speed", value: "1.70s/step", color: "#06b6d4" },
                { label: "Tijd", value: "2h 52min", color: "#f472b6" },
                { label: "Checkpoint", value: "1.8GB", color: "#ef4444" },
              ].map(m => (
                <div key={m.label} style={{ background: "#1e1e30", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{m.label}</div>
                </div>
              ))}
            </div>
            {/* ── LIVE CHARTS (van training_status.json, 115 datapunten) ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginTop: 16 }}>
              <MiniChart data={arcLossData} color="#ef4444" label="Training Loss" yMin={0} yMax={3.5} />
              <MiniChart data={arcAccData} color="#4ade80" label="Training Accuracy" yMin={0} yMax={1.0} />
              <MiniChart data={arcLRData} color="#22d3ee" label="Learning Rate" yMin={0} yMax={0.0001} />
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "#4b5563", textAlign: "center" }}>
              Data: training_status.json (5750 stappen → 115 datapunten gedownsampled) • Sapient-HRM 27.3M • MPS M4
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: "#d1d5db", lineHeight: 1.8 }}>
              <p>Pre-training op ARC-aug-1000 puzzels om het model patroonherkenning en hiërarchisch redeneren aan te leren. De dataset raakte uitgeput bij step 5750 (van geplande 7695). Checkpoint V3 systeem werkte perfect — elke 100 stappen opgeslagen, maximaal 5 bewaard.</p>
              <p style={{ marginTop: 6 }}>Dit model vormt de reasoning basis voor de nested architectuur. Het leert NIET tekst begrijpen, maar WEL: patronen herkennen, adaptief redeneren (ACT), en hiërarchische beslissingen nemen (HRM H/L-levels).</p>
            </div>
          </div>
        )}
      </div>

      {/* ── RUN 2: LFM2 BENCHMARK — VOOR vs NA ── */}
      <div style={{ background: "#000a1a", border: "1px solid #1e40af", borderRadius: 12, padding: 0, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit LFM2 sectie" aria-expanded={!!expanded.lfm2} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("lfm2")} onClick={() => toggle("lfm2")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.lfm2 ? "#60a5fa11" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#60a5fa", fontSize: 15 }}>Run 2: LFM2-2.6B Scam Detection Benchmark</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>86.1% → 98.1% na LoRA fine-tuning • 209 scenarios • NL/FR/EN</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 8 }}>
            <span style={{ padding: "3px 10px", borderRadius: 6, background: "#22c55e22", color: "#4ade80", fontSize: 11, fontWeight: 600 }}>+12% ↑</span>
            <span style={{ color: "#6b7280", fontSize: 16, transition: "transform 0.2s", transform: expanded.lfm2 ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </div>
        </div>
        {expanded.lfm2 && (
          <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid #1e40af33" }}>
            {/* Comparison cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              {/* Before */}
              <div style={{ background: "#1a1a2e", border: "1px solid #454d60", borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700, color: "#9ca3af", fontSize: 13, marginBottom: 10 }}>BASELINE (voor fine-tuning)</div>
                <div style={{ textAlign: "center", margin: "10px 0" }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: "#f59e0b" }}>86.1%</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>totaal correct (180/209)</div>
                </div>
                <Bar value={100} max={100} color="#22c55e" label="Scam detectie" />
                <Bar value={0} max={100} color="#ef4444" label="SAFE herkenning" />
                <div style={{ fontSize: 11, color: "#ef4444", marginTop: 8, textAlign: "center", fontWeight: 600 }}>⚠️ Alles als SCAM gemarkeerd — te agressief</div>
              </div>
              {/* After */}
              <div style={{ background: "#001a0a", border: "1px solid #166534", borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700, color: "#4ade80", fontSize: 13, marginBottom: 10 }}>NA LoRA FINE-TUNING ✓</div>
                <div style={{ textAlign: "center", margin: "10px 0" }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: "#22c55e" }}>98.1%</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>totaal correct (205/209)</div>
                </div>
                <Bar value={99.5} max={100} color="#22c55e" label="Scam detectie" />
                <Bar value={88} max={100} color="#4ade80" label="SAFE herkenning" />
                <div style={{ fontSize: 11, color: "#22c55e", marginTop: 8, textAlign: "center", fontWeight: 600 }}>✅ Precies — niet paranoïde, niet naïef</div>
              </div>
            </div>

            {/* LoRA Training Details */}
            <div style={{ marginTop: 12, padding: 12, background: "#1a1a2e", borderRadius: 10, border: "1px solid #312e81" }}>
              <div style={{ fontWeight: 700, color: "#a78bfa", fontSize: 13, marginBottom: 8 }}>LoRA Fine-Tuning Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                {[
                  { label: "Trainable", value: "3.26M", sub: "0.127% van 2.6B", color: "#a78bfa" },
                  { label: "Iteraties", value: "300", sub: "batch_size=1", color: "#60a5fa" },
                  { label: "Loss", value: "3.6 → 0.43", sub: "88% reductie", color: "#22c55e" },
                  { label: "Tijd", value: "~5 min", sub: "op Mac Mini M4", color: "#fbbf24" },
                  { label: "Data", value: "252", sub: "209 + SAFE oversample", color: "#f472b6" },
                  { label: "Adapter", value: "~13MB", sub: "LoRA rank 8", color: "#06b6d4" },
                ].map(m => (
                  <div key={m.label} style={{ background: "#1e1e30", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{m.label}</div>
                    <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2 }}>{m.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Breakdown */}
            <div style={{ marginTop: 12, padding: 12, background: "#1e1e30", borderRadius: 10, border: "1px solid #454d60" }}>
              <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 13, marginBottom: 10 }}>Per Categorie — Voor vs Na</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
                {categoryResults.map((c, i) => {
                  const improved = c.after > c.before;
                  const perfect = c.after === 100;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: perfect ? "#22c55e08" : improved ? "#f59e0b08" : "#0a0a0a", borderRadius: 6, border: `1px solid ${perfect ? "#16653433" : "#454d6033"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{c.icon}</span>
                        <span style={{ fontSize: 12, color: "#d1d5db" }}>{c.cat}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>{c.before}%</span>
                        <span style={{ fontSize: 11, color: "#4b5563" }}>→</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: perfect ? "#4ade80" : improved ? "#fbbf24" : "#9ca3af" }}>{c.after}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Language Results */}
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {langResults.map((l, i) => (
                <div key={i} style={{ padding: 12, background: "#0a1a0a", borderRadius: 10, border: "1px solid #16653444", textAlign: "center" }}>
                  <div style={{ fontSize: 24 }}>{l.icon}</div>
                  <div style={{ fontWeight: 700, color: "#d1d5db", fontSize: 13, marginTop: 4 }}>{l.lang}</div>
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>{l.before}%</span>
                    <span style={{ color: "#22c55e", fontWeight: 800 }}>→</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: l.after === 100 ? "#22c55e" : "#4ade80" }}>{l.after}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── RUN 3: OOD BENCHMARK EVOLUTIE (v2-v6) ── */}
      <div style={{ background: "#0a001a", border: "1px solid #7c3aed", borderRadius: 12, padding: 0, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit OOD benchmark sectie" aria-expanded={!!expanded.ood} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("ood")} onClick={() => toggle("ood")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.ood ? "#a78bfa11" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>🔬</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#a78bfa", fontSize: 15 }}>Run 3: OOD Benchmark Evolutie — v2 t/m v6 + Hybrid</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>8 Feb 2026</div>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>64.3% → 78.9% na 6 versies + rule engine • 445 schone OOD scenarios</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 8 }}>
            <span style={{ padding: "3px 10px", borderRadius: 6, background: "#22c55e22", color: "#4ade80", fontSize: 11, fontWeight: 600 }}>78.9% BEST</span>
            <span style={{ color: "#6b7280", fontSize: 16, transition: "transform 0.2s", transform: expanded.ood ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </div>
        </div>
        {expanded.ood && (
          <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid #7c3aed33" }}>
            <div style={{ marginTop: 12, fontSize: 13, color: "#d1d5db", lineHeight: 1.8 }}>
              <p>De <strong style={{ color: "#a78bfa" }}>Out-of-Distribution (OOD)</strong> benchmark test het model op data die het NOOIT gezien heeft tijdens training. Dit is de eerlijke test — de enige die telt. Na 6 LoRA-versies en een rule engine hybrid is het resultaat 78.9%.</p>
            </div>

            {/* Version Evolution Table */}
            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #454d60" }}>
                    {["Versie", "OOD %", "Test Set", "Strategie", "Status"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#9ca3af", fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { v: "v2", pct: "64.3%", set: "587 (vuil)", strat: "Basis LoRA", status: "Afgesloten", color: "#ef4444" },
                    { v: "v3", pct: "64.1%", set: "587 (vuil)", strat: "Meer SAFE data", status: "Afgesloten", color: "#ef4444" },
                    { v: "v4", pct: "76.0%", set: "445 (schoon)", strat: "Indicators+CoT", status: "Beste adapter", color: "#fbbf24" },
                    { v: "v5", pct: "70.7%", set: "531 (deels)", strat: "Meer data", status: "Afgesloten", color: "#f97316" },
                    { v: "v6", pct: "65.7%", set: "445 (schoon)", strat: "Adversarial boost", status: "Afgesloten", color: "#ef4444" },
                    { v: "v4+rules", pct: "78.9%", set: "445 (schoon)", strat: "Hybrid rule engine", status: "ACTIEF", color: "#22c55e" },
                  ].map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #2d3748", background: r.v === "v4+rules" ? "#22c55e08" : "transparent" }}>
                      <td style={{ padding: "8px 10px", fontWeight: r.v === "v4+rules" ? 700 : 400, color: r.color }}>{r.v}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: r.color }}>{r.pct}</td>
                      <td style={{ padding: "8px 10px", color: "#9ca3af" }}>{r.set}</td>
                      <td style={{ padding: "8px 10px", color: "#d1d5db" }}>{r.strat}</td>
                      <td style={{ padding: "8px 10px", color: r.color, fontWeight: 600 }}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hybrid Rule Engine Details */}
            <div style={{ marginTop: 16, padding: 14, background: "#001a0a", borderRadius: 10, border: "1px solid #16653444" }}>
              <div style={{ fontWeight: 700, color: "#22c55e", fontSize: 13, marginBottom: 10 }}>Hybrid Rule Engine v1 — Resultaat 78.9%</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
                {[
                  { label: "Overall", value: "78.9%", sub: "351/445", color: "#22c55e" },
                  { label: "SCAM recall", value: "83.0%", sub: "240/289", color: "#4ade80" },
                  { label: "SAFE recall", value: "71.2%", sub: "111/156", color: "#60a5fa" },
                  { label: "Rule hits", value: "38", sub: "8.5% coverage", color: "#fbbf24" },
                  { label: "Overrides", value: "15", sub: "regels winnen", color: "#f97316" },
                  { label: "Delta", value: "+2.9%", sub: "vs model-only", color: "#a78bfa" },
                ].map(m => (
                  <div key={m.label} style={{ background: "#1e1e30", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{m.label}</div>
                    <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2 }}>{m.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#d1d5db", lineHeight: 1.7 }}>
                <p><strong style={{ color: "#fbbf24" }}>Grootste winsten:</strong> subscription_trap +18.2% (59.1→77.3%), adversarial_safe_looks_scam +8.8% (55.9→64.7%), adversarial_borderline_safe +7.1% (10.7→17.9%)</p>
                <p style={{ marginTop: 4 }}><strong style={{ color: "#ef4444" }}>Zwakste categorieën:</strong> adversarial_borderline_safe 17.9%, adversarial_scam_looks_safe 50.0%, qr_code_scam 63.6%</p>
              </div>
            </div>

            {/* Rule Engine Coverage */}
            <div style={{ marginTop: 12, padding: 12, background: "#1e1e30", borderRadius: 8, border: "1px solid #454d60" }}>
              <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 12, marginBottom: 8 }}>Rule Engine — 5 Regelcategorieën</div>
              {[
                { naam: "BEC/Invoice Scam", detail: "Bankwijziging patronen, wire transfers, vendor impersonation (EN/NL/FR)", color: "#ef4444" },
                { naam: "Subscription Trap", detail: "Trial expiry, auto-charging, verdachte cancel domeinen (EN/NL/FR)", color: "#f97316" },
                { naam: "QR Code + Betaling", detail: "QR met betaalverzoek, verdachte parking/menu QR codes", color: "#fbbf24" },
                { naam: "Officiële Domeinen", detail: "50+ bekende legit domeinen (banken NL/BE/FR, overheid, tech, delivery)", color: "#22c55e" },
                { naam: "Safe Patterns", detail: "Service footers, referentienummers, klantenservice patronen", color: "#60a5fa" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", alignItems: "baseline" }}>
                  <span style={{ color: r.color, fontWeight: 600, fontSize: 11, minWidth: 140 }}>{r.naam}</span>
                  <span style={{ color: "#9ca3af", fontSize: 10 }}>{r.detail}</span>
                </div>
              ))}
            </div>

            {/* Lessen Geleerd */}
            <div style={{ marginTop: 12, padding: 12, background: "#1a1a2e", borderRadius: 8, border: "1px solid #312e8144" }}>
              <div style={{ fontWeight: 700, color: "#a78bfa", fontSize: 12, marginBottom: 8 }}>Lessen Geleerd (6 versies)</div>
              <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.7 }}>
                {[
                  "LoRA-only op 2.6B is uitgeput na 6 versies (64-71% range)",
                  "Meer data zonder richting helpt niet (v5 bewees dit)",
                  "Model oscilleert tussen te paranoid en te mild",
                  "Testset kwaliteit is net zo belangrijk als model kwaliteit (3x opschonen nodig)",
                  "Rule engine + model > model alleen (+2.9%)",
                  "Indicators+CoT (v4) was de beste LoRA strategie",
                ].map((l, i) => (
                  <div key={i} style={{ padding: "3px 0" }}>• {l}</div>
                ))}
              </div>
            </div>

            {/* Nested Architecture Status */}
            <div style={{ marginTop: 12, padding: 12, background: "#0a001a", borderRadius: 8, border: "1px solid #7c3aed44" }}>
              <div style={{ fontWeight: 700, color: "#c4b5fd", fontSize: 12, marginBottom: 8 }}>Volgende Stap: Nested HRM+LFM2 Architectuur</div>
              <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.7 }}>
                <p><strong style={{ color: "#22c55e" }}>Status: IMPLEMENTATIE GESTART</strong> (8 Feb 2026)</p>
                <p style={{ marginTop: 4 }}>Phase 1: Feature-Level Nesting — LFM2 extraheert indicators → 28 features → HRM-Scam redeneert → classificatie</p>
                <p style={{ marginTop: 4 }}>Target: 80-83% (boven 78.9% hybrid baseline)</p>
                <p style={{ marginTop: 4 }}>Phase 2 (toekomst): Embedding-Level — LFM2 hidden states → DeepEncoder bridge → HRM continue embeddings → 83-87%</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── COMMERCIËLE VALIDATIE CHECKLIST ── */}
      <div style={{ background: "#0f0a00", border: "1px solid #854d0e", borderRadius: 12, padding: 0, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit commercial readiness sectie" aria-expanded={!!expanded.readiness} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("readiness")} onClick={() => toggle("readiness")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.readiness ? "#fbbf2411" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>🎯</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 15 }}>Commerciële Validatie Checklist</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>5 van 11 items voltooid — wat moet er nog gebeuren?</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 8 }}>
            <span style={{ padding: "3px 10px", borderRadius: 6, background: "#f59e0b22", color: "#fbbf24", fontSize: 11, fontWeight: 600 }}>5/11</span>
            <span style={{ color: "#6b7280", fontSize: 16, transition: "transform 0.2s", transform: expanded.readiness ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </div>
        </div>
        {expanded.readiness && (
          <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid #854d0e33" }}>
            <div style={{ marginTop: 12 }}>
              {readiness.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 4, background: r.done ? "#22c55e08" : "#ef444408", borderRadius: 8, border: `1px solid ${r.done ? "#16653422" : "#991b1b22"}` }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{r.done ? "✅" : "⬜"}</span>
                  <span style={{ fontSize: 13, color: r.done ? "#86efac" : "#fca5a5" }}>{r.item}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: 12, background: "#1e1e30", borderRadius: 8, border: "1px solid #454d60" }}>
              <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 13, marginBottom: 6 }}>Wat moet er nog gebeuren om naar buiten te komen?</div>
              <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.8 }}>
                <p>De huidige 209 scenario's zijn een proof-of-concept. Voor een geloofwaardige claim heb je minimaal <strong style={{ color: "#f97316" }}>5.000 scenario's</strong> nodig met een <strong style={{ color: "#f97316" }}>externe testset</strong> die het model nooit gezien heeft. Vergelijking met bestaande tools (Gmail, Defender) op dezelfde dataset bewijst je niche-voordeel. Focus: meertalig NL/FR/EN + privacy-first + on-device.</p>
              </div>
            </div>

            {/* Target metrics */}
            <div style={{ marginTop: 12, padding: 12, background: "#0a1a0a", borderRadius: 8, border: "1px solid #16653444" }}>
              <div style={{ fontWeight: 700, color: "#22c55e", fontSize: 13, marginBottom: 8 }}>Target Benchmarks voor Commercialisatie</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                {[
                  { metric: "Precision", target: ">95%", current: "~95%", color: "#22c55e" },
                  { metric: "Recall", target: ">98%", current: "99.5%", color: "#4ade80" },
                  { metric: "F1-score", target: ">96%", current: "~97%", color: "#22c55e" },
                  { metric: "False Positive", target: "<5%", current: "12.5%", color: "#f59e0b" },
                  { metric: "Dataset", target: "5000+", current: "209", color: "#ef4444" },
                  { metric: "Zero-day", target: "Bewezen", current: "Niet getest", color: "#ef4444" },
                ].map(m => (
                  <div key={m.metric} style={{ padding: 10, background: "#1e1e30", borderRadius: 8, border: "1px solid #454d60" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.metric}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Target: {m.target}</div>
                    <div style={{ fontSize: 11, color: m.color, marginTop: 2 }}>Nu: {m.current}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 8, fontSize: 12, color: "#6b7280" }}>
        <p><strong>Runs:</strong> 2 trainingsruns vastgelegd (ARC pre-training + LFM2 LoRA fine-tuning)</p>
        <p style={{ marginTop: 4 }}><strong>Locaties:</strong> HRM checkpoint op MM4 intern • LFM2 + adapter op 8TB AI-Models</p>
        <p style={{ marginTop: 4 }}><strong>Volgende run:</strong> LFM2 fine-tuning op 2000+ scenario's (na data opschaling via InfraNodus)</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE INTELLIGENCE TAB — v4.12.0 (+ Perplexity Live Feed + Scan Now)
// Dagelijkse revenue-ideeën, Chrome extensie roadmap, build-up checklist
// Integratie met InfraNodus voor marktinzichten
// ═══════════════════════════════════════════════════════════════════════════════
// Local API config — draait op Mac Mini, CCC praat ermee vanuit browser
const LOCAL_API = "http://localhost:4900";

// Timeout helper — compatibel met alle browsers (Safari, Chrome, Firefox)
function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function RevenueIntelligence() {
  const { isPhone, S } = useDevice();
  const [expanded, setExpanded] = useState({});
  const [feed, setFeed] = useState(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [apiOnline, setApiOnline] = useState(false);
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Check if local API is running
  const checkApi = useCallback(() => {
    fetchWithTimeout(`${LOCAL_API}/health`, {}, 2000)
      .then(r => r.json())
      .then(d => setApiOnline(d.status === "ok"))
      .catch(() => setApiOnline(false));
  }, []);

  // Load intelligence feed — try local API first, fallback to static JSON
  const loadFeed = useCallback(() => {
    setFeedLoading(true);
    setFeedError(null);
    fetchWithTimeout(`${LOCAL_API}/api/intelligence/feed`, {}, 3000)
      .then(r => { if (!r.ok) throw new Error("API offline"); return r.json(); })
      .then(data => { setFeed(data); setFeedLoading(false); setApiOnline(true); })
      .catch(() => {
        // Fallback: static JSON (werkt altijd op lokale dev server)
        fetch("/data/intelligence_feed.json?" + Date.now())
          .then(r => { if (!r.ok) throw new Error("Feed niet beschikbaar"); return r.json(); })
          .then(data => { setFeed(data); setFeedLoading(false); })
          .catch(e => { setFeedError(e.message); setFeedLoading(false); });
      });
  }, []);

  // Trigger Perplexity scan via local API
  const triggerScan = useCallback((topicIndices = null) => {
    if (scanning) return;
    setScanning(true);
    setScanProgress("Scan starten...");

    const body = topicIndices ? { topics: topicIndices } : {};
    fetchWithTimeout(`${LOCAL_API}/api/intelligence/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 5000)
      .then(r => r.json())
      .then(d => {
        setScanProgress(d.message || "Bezig...");
        // Poll for completion
        const poll = setInterval(() => {
          fetchWithTimeout(`${LOCAL_API}/api/intelligence/status`, {}, 2000)
            .then(r => r.json())
            .then(s => {
              setScanProgress(s.progress || "Bezig...");
              if (!s.scanning) {
                clearInterval(poll);
                setScanning(false);
                setScanProgress(s.error ? `❌ ${s.error}` : s.progress);
                loadFeed(); // Reload feed with new data
              }
            })
            .catch(() => {});
        }, 2000);
        // Safety timeout: stop polling after 2 minutes
        setTimeout(() => { clearInterval(poll); setScanning(false); }, 120000);
      })
      .catch(e => {
        setScanning(false);
        setScanProgress(`❌ API niet bereikbaar — start: python3 scripts/local_api.py`);
      });
  }, [scanning, loadFeed]);

  useEffect(() => { loadFeed(); checkApi(); }, [loadFeed, checkApi]);

  // ── Revenue Streams Ranked ──
  const revenueStreams = [
    { rank: 1, name: "Chrome Extensie — SDK-Guardian", timeline: "Maand 1-3", revenue: "€5K MRR", effort: "Medium", risk: "Laag",
      description: "Freemium scam detector. Gratis: 10 scans/dag. Pro: €4.99/maand. Gezin: €9.99/maand.",
      techStack: "WASM (LFM2 lokaal), ExtensionPay (Stripe), Chrome Web Store",
      steps: ["Manifest v3 extensie bouwen", "LFM2 als WASM compileren", "ExtensionPay integreren", "Chrome Web Store listing", "Product Hunt launch"],
      status: "ready", moat: "Model draait lokaal = 0 serverkosten = ~95% marge" },
    { rank: 2, name: "WordPress Plugin — WP-Guardian", timeline: "Maand 2-4", revenue: "€3K MRR", effort: "Medium", risk: "Laag",
      description: "Website security scanner voor WordPress sites. Scant op malware, GDPR, SSL, plugin kwetsbaarheden.",
      techStack: "PHP plugin + API endpoint naar LFM2 model",
      steps: ["WordPress plugin structuur", "API endpoint bouwen", "WordPress.org listing", "WooCommerce integratie"],
      status: "planned", moat: "AI-powered vs static rules = betere detectie" },
    { rank: 3, name: "API Service — scan.sdk-hrm.com", timeline: "Maand 3-5", revenue: "€2K MRR", effort: "Hoog", risk: "Medium",
      description: "REST API: POST /scan → { verdict, confidence, explanation }. Voor developers en MSPs.",
      techStack: "Cloudflare Workers + MLX model op dedicated server",
      steps: ["API ontwerpen (OpenAPI spec)", "Rate limiting + auth", "Pricing tiers", "Developer docs", "Stripe billing"],
      status: "planned", moat: "Multilingual + nuanced crypto = uniek" },
    { rank: 4, name: "Shopify App — Shop-Guardian", timeline: "Maand 4-6", revenue: "€2K MRR", effort: "Medium", risk: "Laag",
      description: "Fraud detectie voor Shopify winkels. Bestelling/klant risico scoring.",
      techStack: "Shopify App Bridge + SDK-HRM API",
      steps: ["Shopify partner account", "App structuur", "Order webhook integratie", "Shopify App Store listing"],
      status: "concept", moat: "Specifiek voor Shopify = betere conversie dan generiek" },
    { rank: 5, name: "MSP White-Label", timeline: "Maand 6-12", revenue: "€10K+ MRR", effort: "Hoog", risk: "Medium",
      description: "White-label dashboard voor Managed Service Providers. Hun branding, onze technologie.",
      techStack: "Multi-tenant dashboard + API + LoRA per klant",
      steps: ["MSP outreach (België/Nederland)", "White-label UI", "Per-klant LoRA adapters", "SLA + support structuur"],
      status: "concept", moat: "NIS2 compliance = MSPs MOETEN security bieden" },
  ];

  // ── Chrome Extension Detail Roadmap ──
  const chromeRoadmap = [
    { week: "Week 1-2", task: "Manifest v3 + popup UI", detail: "Basic extensie structuur, popup met scan knop, permission model", done: false },
    { week: "Week 2-3", task: "LFM2 integratie (WASM/ONNX)", detail: "Model converteren naar browser-compatible formaat, inference in service worker", done: false },
    { week: "Week 3-4", task: "Email scanning", detail: "Gmail/Outlook integratie, content script leest email body, model analyseert", done: false },
    { week: "Week 4-5", task: "ExtensionPay + Stripe", detail: "Freemium model, trial period, payment flow, license verificatie", done: false },
    { week: "Week 5-6", task: "Chrome Web Store", detail: "Screenshots, beschrijving, privacy policy, review process (~1-2 weken)", done: false },
    { week: "Week 6-7", task: "Beta testers", detail: "10-20 beta users, feedback loop, bug fixes, model improvements", done: false },
    { week: "Week 7-8", task: "Launch", detail: "Product Hunt, Reddit r/chrome_extensions, LinkedIn, HackerNews", done: false },
  ];

  // ── Build-Up Checklist (technisch + legaal + business) ──
  const buildUpChecklist = {
    technical: [
      { item: "LFM2 model naar WASM/ONNX converteren", done: false, priority: "P0" },
      { item: "Chrome Manifest v3 extensie skeleton", done: false, priority: "P0" },
      { item: "ExtensionPay account + Stripe koppeling", done: false, priority: "P1" },
      { item: "API endpoint (Cloudflare Worker)", done: false, priority: "P1" },
      { item: "Training data pipeline (InfraNodus + Perplexity)", done: false, priority: "P1" },
      { item: "CI/CD voor model updates (LoRA swapping)", done: false, priority: "P2" },
    ],
    legal: [
      { item: "Privacy Policy schrijven (GDPR compliant)", done: false, priority: "P0" },
      { item: "Terms of Service", done: false, priority: "P0" },
      { item: "KBO/BTW registratie als eenmanszaak (België)", done: false, priority: "P1" },
      { item: "Chrome Web Store developer account (€5 eenmalig)", done: false, priority: "P1" },
      { item: "Stripe account voor betalingen", done: false, priority: "P1" },
      { item: "LFM2 licentie check (LFM Open License v1.0)", done: false, priority: "P0" },
    ],
    marketing: [
      { item: "Landing page (sdk-guardian.com of similar)", done: false, priority: "P1" },
      { item: "Product Hunt listing voorbereiden", done: false, priority: "P2" },
      { item: "LinkedIn posts (Franky's netwerk)", done: false, priority: "P1" },
      { item: "Reddit launch (r/chrome_extensions, r/cybersecurity)", done: false, priority: "P2" },
      { item: "GitHub repo open source (base model)", done: false, priority: "P1" },
      { item: "Demo video (30 sec scan demonstratie)", done: false, priority: "P2" },
    ],
  };

  // ── Daily Intelligence Topics ──
  const dailyTopics = [
    { topic: "Chrome Extension monetisation trends", source: "Perplexity", frequency: "Wekelijks", why: "Nieuwe betaalmodellen, ExtensionPay alternatieven" },
    { topic: "AI security startup funding", source: "Perplexity", frequency: "Wekelijks", why: "Concurrentie analyse, marktvalidatie" },
    { topic: "Nieuwe phishing/scam technieken", source: "Perplexity + InfraNodus", frequency: "Dagelijks", why: "Training data, model updates, zero-day patronen" },
    { topic: "NIS2 compliance deadlines", source: "Perplexity", frequency: "Maandelijks", why: "MSP urgentie, sales timing" },
    { topic: "Chrome Web Store policy updates", source: "Perplexity", frequency: "Wekelijks", why: "Manifest v3 changes, review process" },
    { topic: "MiCA/GENIUS Act updates", source: "InfraNodus", frequency: "Wekelijks", why: "Crypto module relevantie" },
    { topic: "LFM2/Liquid AI updates", source: "Perplexity", frequency: "Maandelijks", why: "Model updates, nieuwe versies" },
    { topic: "Competitor Chrome security extensions", source: "Chrome Web Store", frequency: "Wekelijks", why: "Feature gap analyse, pricing" },
  ];

  // ── Financial Projection ──
  const projections = [
    { month: "Maand 1", users: "50", paying: "5", mrr: "€25", cumulative: "€25" },
    { month: "Maand 2", users: "200", paying: "30", mrr: "€150", cumulative: "€175" },
    { month: "Maand 3", users: "500", paying: "80", mrr: "€400", cumulative: "€575" },
    { month: "Maand 6", users: "2.000", paying: "300", mrr: "€1.500", cumulative: "€4.075" },
    { month: "Maand 9", users: "5.000", paying: "700", mrr: "€3.500", cumulative: "€14.575" },
    { month: "Maand 12", users: "10.000", paying: "1.200", mrr: "€6.000", cumulative: "€38.575" },
  ];

  const prioColor = (p) => p === "P0" ? "#ef4444" : p === "P1" ? "#f59e0b" : "#6b7280";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg, #1a0a00, #0f1a00, #001a0a)", border: "2px solid #22c55e", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 24, background: "linear-gradient(90deg, #22c55e, #fbbf24, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              💰 Revenue Intelligence
            </div>
            <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 6 }}>Van model naar geld — dagelijkse updates, roadmap en build-up checklist</p>
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>Chrome extensie eerst • API daarna • MSP white-label als schaalstap</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {[
              { label: "5", sub: "streams", color: "#22c55e" },
              { label: "€5K", sub: "MRR doel", color: "#fbbf24" },
              { label: "8 wk", sub: "tot launch", color: "#f97316" },
              { label: "€0", sub: "startkosten", color: "#60a5fa" },
            ].map(m => (
              <div key={m.sub} style={{ textAlign: "center", padding: "8px 14px", background: `${m.color}11`, border: `1px solid ${m.color}44`, borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.label}</div>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>{m.sub}</div>
              </div>
            ))}
            {/* ── SCAN NOW BUTTON ── */}
            <button
              onClick={() => triggerScan()}
              disabled={scanning || !apiOnline}
              style={{
                padding: "12px 18px", background: scanning ? "#4b5563" : apiOnline ? "linear-gradient(135deg, #8b5cf6, #6d28d9)" : "#2d3748",
                border: `1px solid ${apiOnline ? "#8b5cf688" : "#454d60"}`, borderRadius: 10, cursor: scanning || !apiOnline ? "default" : "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 80
              }}
            >
              <span style={{ fontSize: 20 }}>{scanning ? "⏳" : apiOnline ? "⚡" : "🔌"}</span>
              <span style={{ fontSize: 10, color: scanning ? "#9ca3af" : apiOnline ? "#c4b5fd" : "#6b7280", fontWeight: 700 }}>
                {scanning ? "SCANNING" : apiOnline ? "SCAN NOW" : "API OFF"}
              </span>
            </button>
          </div>
          {/* Scan progress bar */}
          {(scanning || scanProgress) && (
            <div style={{ marginTop: 8, padding: "6px 12px", background: scanning ? "#8b5cf611" : scanProgress.startsWith("❌") ? "#ef444411" : "#22c55e11",
              border: `1px solid ${scanning ? "#8b5cf633" : scanProgress.startsWith("❌") ? "#ef444433" : "#22c55e33"}`, borderRadius: 6, fontSize: 11,
              color: scanning ? "#a78bfa" : scanProgress.startsWith("❌") ? "#ef4444" : "#4ade80" }}>
              {scanning && <span style={{ marginRight: 6 }}>●</span>}
              {scanProgress}
              {!apiOnline && !scanning && <span style={{ marginLeft: 8, color: "#6b7280" }}>Start: python3 scripts/local_api.py</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── TOP 5 REVENUE STREAMS ── */}
      <div style={{ background: "#0a0f00", border: "1px solid #22c55e66", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit revenue streams sectie" aria-expanded={!!expanded.streams} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("streams")} onClick={() => toggle("streams")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.streams ? "#22c55e11" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>🏆</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#22c55e", fontSize: 15 }}>Top 5 Revenue Streams — Gerankt op snelheid + haalbaarheid</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Chrome extensie = #1 prioriteit (laagste risk, snelste revenue)</div>
            </div>
          </div>
          <span style={{ color: "#6b7280", fontSize: 18, marginLeft: 8 }}>{expanded.streams ? "▼" : "▶"}</span>
        </div>
        {expanded.streams && (
          <div style={{ padding: 16, borderTop: "1px solid #22c55e33" }}>
            {revenueStreams.map(s => (
              <div key={s.rank} style={{ background: s.rank === 1 ? "#22c55e08" : "#111", border: `1px solid ${s.rank === 1 ? "#22c55e44" : "#2d3748"}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: s.rank === 1 ? "#22c55e" : "#6b7280" }}>#{s.rank}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: "#e5e7eb", fontSize: 14 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{s.description}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ padding: "3px 8px", background: "#22c55e22", color: "#22c55e", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{s.revenue}</span>
                    <span style={{ padding: "3px 8px", background: "#60a5fa11", color: "#60a5fa", borderRadius: 4, fontSize: 10 }}>{s.timeline}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, flexWrap: "wrap" }}>
                  <span style={{ color: "#6b7280" }}>Tech: <span style={{ color: "#9ca3af" }}>{s.techStack}</span></span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: "#4ade80" }}>💡 Moat: {s.moat}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                  {s.steps.map((step, i) => (
                    <span key={i} style={{ padding: "2px 8px", background: "#ffffff08", color: "#9ca3af", borderRadius: 4, fontSize: 10 }}>{i + 1}. {step}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CHROME EXTENSION ROADMAP ── */}
      <div style={{ background: "#000a1a", border: "1px solid #60a5fa66", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit Chrome extensie sectie" aria-expanded={!!expanded.chrome} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("chrome")} onClick={() => toggle("chrome")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.chrome ? "#60a5fa11" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>🌐</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#60a5fa", fontSize: 15 }}>Chrome Extensie Roadmap — 8 Weken Tot Launch</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Week-voor-week plan van code tot Chrome Web Store</div>
            </div>
          </div>
          <span style={{ color: "#6b7280", fontSize: 18, marginLeft: 8 }}>{expanded.chrome ? "▼" : "▶"}</span>
        </div>
        {expanded.chrome && (
          <div style={{ padding: 16, borderTop: "1px solid #60a5fa33" }}>
            {chromeRoadmap.map((w, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ minWidth: 70, padding: "4px 8px", background: "#60a5fa11", border: "1px solid #60a5fa33", borderRadius: 6, fontSize: 11, color: "#60a5fa", fontWeight: 700, textAlign: "center" }}>{w.week}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#e5e7eb", fontSize: 12 }}>{w.task}</div>
                  <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{w.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BUILD-UP CHECKLIST ── */}
      <div style={{ background: "#0f0a00", border: "1px solid #fbbf2466", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit build-up checklist sectie" aria-expanded={!!expanded.buildup} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("buildup")} onClick={() => toggle("buildup")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.buildup ? "#fbbf2411" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 15 }}>Build-Up Checklist — Technisch + Legaal + Marketing</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Alles wat er moet gebeuren vóór de eerste euro binnenkomt</div>
            </div>
          </div>
          <span style={{ color: "#6b7280", fontSize: 18 }}>{expanded.buildup ? "▼" : "▶"}</span>
        </div>
        {expanded.buildup && (
          <div style={{ padding: 16, borderTop: "1px solid #fbbf2433" }}>
            {Object.entries(buildUpChecklist).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: cat === "technical" ? "#60a5fa" : cat === "legal" ? "#f97316" : "#a855f7", fontSize: 13, marginBottom: 8, textTransform: "uppercase" }}>
                  {cat === "technical" ? "⚙️ Technisch" : cat === "legal" ? "⚖️ Legaal" : "📣 Marketing"}
                </div>
                {items.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #2d374833" }}>
                    <span style={{ fontSize: 14 }}>{item.done ? "✅" : "⬜"}</span>
                    <span style={{ flex: 1, color: item.done ? "#6b7280" : "#d1d5db", fontSize: 12, textDecoration: item.done ? "line-through" : "none" }}>{item.item}</span>
                    <span style={{ padding: "2px 6px", background: `${prioColor(item.priority)}22`, color: prioColor(item.priority), borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{item.priority}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DAILY INTELLIGENCE MONITORING ── */}
      <div style={{ background: "#1a1a2e", border: "1px solid #a855f766", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit dagelijkse projecties sectie" aria-expanded={!!expanded.daily} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("daily")} onClick={() => toggle("daily")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.daily ? "#a855f711" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>📡</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#a855f7", fontSize: 15 }}>Dagelijkse Intelligence Monitoring</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Wat moet er dagelijks/wekelijks gescand worden via Perplexity + InfraNodus</div>
            </div>
          </div>
          <span style={{ color: "#6b7280", fontSize: 18, marginLeft: 8 }}>{expanded.daily ? "▼" : "▶"}</span>
        </div>
        {expanded.daily && (
          <div style={{ padding: 16, borderTop: "1px solid #a855f733" }}>
            <div style={{ background: "#14b8a611", border: "1px solid #14b8a633", borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <div style={{ color: "#14b8a6", fontSize: 12, fontWeight: 600 }}>💡 Perplexity API = beste optie (~€1/maand)</div>
              <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>Doorzoekt heel het web (incl. X, Reddit, HN). Geen aparte X API nodig (die kost €200/maand). Reddit API is gratis maar beperkt tot niet-commercieel.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dailyTopics.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1e1e30", border: "1px solid #2d3748", borderRadius: 8, padding: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "#e5e7eb", fontSize: 12 }}>{t.topic}</div>
                    <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{t.why}</div>
                  </div>
                  <span style={{ padding: "2px 8px", background: "#a855f722", color: "#a855f7", borderRadius: 4, fontSize: 10 }}>{t.source}</span>
                  <span style={{ padding: "2px 8px", background: "#ffffff08", color: "#9ca3af", borderRadius: 4, fontSize: 10 }}>{t.frequency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── FINANCIAL PROJECTION ── */}
      <div style={{ background: "#001a00", border: "1px solid #22c55e66", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#22c55e", marginBottom: 12 }}>📈 Financiële Projectie — Chrome Extensie (conservatief)</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #22c55e33" }}>
                {["Periode", "Users", "Betalend", "MRR", "Cumulatief"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#22c55e", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projections.map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #2d374833" }}>
                  <td style={{ padding: "8px 12px", color: "#e5e7eb", fontWeight: 600 }}>{p.month}</td>
                  <td style={{ padding: "8px 12px", color: "#9ca3af" }}>{p.users}</td>
                  <td style={{ padding: "8px 12px", color: "#60a5fa" }}>{p.paying}</td>
                  <td style={{ padding: "8px 12px", color: "#22c55e", fontWeight: 700 }}>{p.mrr}</td>
                  <td style={{ padding: "8px 12px", color: "#fbbf24" }}>{p.cumulative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 10, color: "#4b5563", marginTop: 8 }}>Aannames: 5% conversie gratis→betaald, €4.99/maand gemiddeld, organische groei + Product Hunt launch</div>
      </div>

      {/* ── LIVE INTELLIGENCE FEED (Perplexity API) ── */}
      <div style={{ background: "#0a001a", border: "2px solid #8b5cf6", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit live feed sectie" aria-expanded={!!expanded.livefeed} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("livefeed")} onClick={() => toggle("livefeed")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.livefeed ? "#8b5cf611" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 800, color: "#8b5cf6", fontSize: 16 }}>Live Intelligence Feed — Perplexity API</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>8 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                {feed && feed.meta?.last_scan
                  ? `Laatste scan: ${new Date(feed.meta.last_scan).toLocaleString("nl-BE")} • ${feed.meta.topics_scanned}/${feed.meta.total_topics} topics • ${feed.meta.total_tokens_this_scan} tokens`
                  : feedError ? `⚠️ ${feedError}` : feedLoading ? "Laden..." : "Nog geen data — run: python3 scripts/perplexity_monitor.py"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={(e) => { e.stopPropagation(); loadFeed(); }} style={{ padding: "4px 10px", background: "#8b5cf622", border: "1px solid #8b5cf644", borderRadius: 6, color: "#8b5cf6", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🔄 Refresh</button>
            {apiOnline && (
              <button onClick={(e) => { e.stopPropagation(); triggerScan(); }} disabled={scanning}
                style={{ padding: "4px 10px", background: scanning ? "#4b556322" : "#22c55e22", border: `1px solid ${scanning ? "#4b556344" : "#22c55e44"}`, borderRadius: 6, color: scanning ? "#6b7280" : "#22c55e", fontSize: 11, cursor: scanning ? "default" : "pointer", fontWeight: 600 }}>
                {scanning ? "⏳ Bezig..." : "⚡ Scan Now"}
              </button>
            )}
            <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: apiOnline ? "#22c55e22" : "#ef444422", color: apiOnline ? "#22c55e" : "#ef4444" }}>
              {apiOnline ? "● LIVE" : "● OFFLINE"}
            </span>
            <span style={{ color: "#6b7280", fontSize: 18 }}>{expanded.livefeed ? "▼" : "▶"}</span>
          </div>
        </div>
        {expanded.livefeed && (
          <div style={{ padding: 16, borderTop: "1px solid #8b5cf633" }}>
            {!feed || !feed.entries || Object.keys(feed.entries).length === 0 ? (
              <div style={{ textAlign: "center", padding: 30 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <div style={{ color: "#9ca3af", fontSize: 14 }}>Nog geen intelligence data beschikbaar</div>
                <div style={{ color: "#6b7280", fontSize: 12, marginTop: 8, lineHeight: 1.8 }}>
                  <strong style={{ color: "#8b5cf6" }}>Setup:</strong><br/>
                  1. Voeg <code style={{ background: "#2d3748", padding: "2px 6px", borderRadius: 4 }}>PERPLEXITY_API_KEY=pplx-xxx</code> toe aan <code style={{ background: "#2d3748", padding: "2px 6px", borderRadius: 4 }}>~/.env</code><br/>
                  2. Run: <code style={{ background: "#2d3748", padding: "2px 6px", borderRadius: 4 }}>python3 scripts/perplexity_monitor.py</code><br/>
                  3. Klik 🔄 Refresh hierboven
                </div>
                <div style={{ color: "#4b5563", fontSize: 11, marginTop: 12 }}>Kosten: ~$0.005-0.01 per scan (8 topics) = minder dan €1/maand bij dagelijks gebruik</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Category filter badges */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  {["threats", "competition", "product", "regulation", "technology"].map(cat => {
                    const catEntries = Object.values(feed.entries).filter(e => e.category === cat);
                    if (catEntries.length === 0) return null;
                    const colors = { threats: "#ef4444", competition: "#f59e0b", product: "#60a5fa", regulation: "#22c55e", technology: "#8b5cf6" };
                    return (
                      <span key={cat} style={{ padding: "3px 10px", background: `${colors[cat]}15`, border: `1px solid ${colors[cat]}44`, borderRadius: 6, fontSize: 11, color: colors[cat], fontWeight: 600, textTransform: "uppercase" }}>
                        {cat} ({catEntries.length})
                      </span>
                    );
                  })}
                </div>

                {/* Feed entries */}
                {Object.values(feed.entries).sort((a, b) => (b.scanned_at || "").localeCompare(a.scanned_at || "")).map(entry => {
                  const catColors = { threats: "#ef4444", competition: "#f59e0b", product: "#60a5fa", regulation: "#22c55e", technology: "#8b5cf6" };
                  const borderColor = catColors[entry.category] || "#6b7280";
                  return (
                    <div key={entry.id} style={{ background: "#1e1e30", border: `1px solid ${borderColor}33`, borderLeft: `3px solid ${borderColor}`, borderRadius: 8, overflow: "hidden" }}>
                      <div role="button" tabIndex="0" aria-label={`Open/sluit ${entry.title || "feed item"}`} aria-expanded={!!expanded[`feed_${entry.id}`]} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle(`feed_${entry.id}`)} onClick={() => toggle(`feed_${entry.id}`)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", background: expanded[`feed_${entry.id}`] ? `${borderColor}08` : "transparent" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{entry.icon}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: "#e5e7eb", fontSize: 13 }}>{entry.topic}</div>
                            <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                              <span style={{ padding: "1px 6px", background: `${borderColor}15`, color: borderColor, borderRadius: 3, fontSize: 9, fontWeight: 600, textTransform: "uppercase" }}>{entry.category}</span>
                              <span style={{ padding: "1px 6px", background: "#ffffff08", color: "#6b7280", borderRadius: 3, fontSize: 9 }}>{entry.frequency}</span>
                              {entry.scanned_at && <span style={{ padding: "1px 6px", background: "#ffffff08", color: "#4b5563", borderRadius: 3, fontSize: 9 }}>{new Date(entry.scanned_at).toLocaleDateString("nl-BE")}</span>}
                            </div>
                          </div>
                        </div>
                        <span style={{ color: "#6b7280", fontSize: 14 }}>{expanded[`feed_${entry.id}`] ? "▼" : "▶"}</span>
                      </div>
                      {expanded[`feed_${entry.id}`] && (
                        <div style={{ padding: "0 14px 14px 14px", borderTop: `1px solid ${borderColor}22` }}>
                          {/* Content */}
                          <div style={{ color: "#d1d5db", fontSize: 12, lineHeight: 1.7, marginTop: 10, whiteSpace: "pre-wrap" }}>
                            {entry.content}
                          </div>
                          {/* Citations */}
                          {entry.citations && entry.citations.length > 0 && (
                            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #2d374844" }}>
                              <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>📎 BRONNEN:</div>
                              {entry.citations.map((url, ci) => (
                                <div key={ci} style={{ fontSize: 10, color: "#60a5fa", marginBottom: 2, wordBreak: "break-all" }}>
                                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>
                                    [{ci + 1}] {url.length > 80 ? url.substring(0, 80) + "..." : url}
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Related questions */}
                          {entry.related_questions && entry.related_questions.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>💡 GERELATEERDE VRAGEN:</div>
                              {entry.related_questions.map((q, qi) => (
                                <div key={qi} style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>• {q}</div>
                              ))}
                            </div>
                          )}
                          {/* Token usage */}
                          <div style={{ marginTop: 8, fontSize: 9, color: "#4b5563" }}>
                            {entry.tokens_used} tokens • model: {entry.model}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Cost summary */}
                {feed.meta && (
                  <div style={{ background: "#14b8a608", border: "1px solid #14b8a622", borderRadius: 8, padding: 10, marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 11, color: "#9ca3af" }}>
                      <span>📊 Totaal tokens deze scan: <strong style={{ color: "#14b8a6" }}>{feed.meta.total_tokens_this_scan?.toLocaleString()}</strong></span>
                      <span>💰 Geschatte kosten: <strong style={{ color: "#22c55e" }}>~${(feed.meta.total_tokens_this_scan / 1_000_000 * 2 + 0.005 * (feed.meta.topics_scanned || 8)).toFixed(4)}</strong></span>
                      <span>📅 Bij dagelijks: <strong style={{ color: "#fbbf24" }}>~€{((feed.meta.total_tokens_this_scan / 1_000_000 * 2 + 0.005 * (feed.meta.topics_scanned || 8)) * 30).toFixed(2)}/maand</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ background: "#1e1e30", border: "1px solid #2d3748", borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
          <p><strong style={{ color: "#22c55e" }}>Eerste stap:</strong> Chrome extensie bouwen met LFM2 lokaal (WASM). Nul serverkosten = ~95% marge.</p>
          <p style={{ marginTop: 4 }}><strong style={{ color: "#22c55e" }}>Monitoring:</strong> Perplexity API (~€1/maand) voor dagelijkse scam + markt intelligence. InfraNodus voor structurering.</p>
          <p style={{ marginTop: 4 }}><strong style={{ color: "#22c55e" }}>Principe:</strong> Eerst bewijzen (Chrome extensie), dan schalen (API + MSP), dan domineren (embedded SDK).</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASES TAB — v4.14.0
// Concrete doelstellingen, use cases, en roadmap richting
// Wat SDK-HRM doet voor eindgebruikers — georganiseerd per fase
// ═══════════════════════════════════════════════════════════════════════════════
function UseCases() {
  const { isPhone, S } = useDevice();
  const [expanded, setExpanded] = useState({});
  const toggle = id => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const phases = [
    { id: "A", title: "Rule Engine v2", color: "#f97316", status: "ACTIEF", deadline: "Feb-Mrt 2026", target: "85%+", done: 1, total: 6,
      desc: "Meer regels = hogere accuracy. Enige bewezen methode.",
      tasks: ["Rule engine v1 (+2.9%)", "Subscription trap", "Adversarial borderline", "BEC/invoice patronen", "QR context regels", "Benchmark per update"],
      tasksDone: [true, false, false, false, false, false] },
    { id: "B", title: "Data Opschaling", color: "#60a5fa", status: "ACTIEF", deadline: "Feb-Apr 2026", target: "10K+", done: 2, total: 7,
      desc: "3637 → 10.000+ scenarios. Meer data = betere generalisatie.",
      tasks: ["3637 scenarios (NL/FR/EN)", "445 OOD testset", "Crypto scams (50-100)", "Synthetische data", "PhishTank integratie", "Real-world BE/NL scams", "LFM2 hertrainen"],
      tasksDone: [true, true, false, false, false, false, false] },
    { id: "C", title: "Chrome Extensie", color: "#22c55e", status: "GEPLAND", deadline: "Apr-Mei 2026", target: "Users", done: 0, total: 7,
      desc: "MVP: scam/safe indicator in je browser. Eerste revenue.",
      tasks: ["Content script", "Lokale inference", "Popup UI (G/O/R)", "Gmail/Outlook integratie", "Marktplaats badges", "ExtensionPay (Stripe)", "Chrome Web Store"],
      tasksDone: [false, false, false, false, false, false, false] },
    { id: "D", title: "GDPR Guardian", color: "#a78bfa", status: "GEPLAND", deadline: "Mei-Jul 2026", target: "KMO's", done: 0, total: 8,
      desc: "GDPR/NIS2 compliance scanner. Premium revenue stream.",
      tasks: ["Cookie banner check", "Privacy policy scan", "DPO verificatie", "GA IP-check", "NIS2 vereisten", "SSL audit", "PDF rapport (NL/FR/EN)", "Pricing €29-99"],
      tasksDone: [false, false, false, false, false, false, false, false] },
  ];

  const useCases = [
    { icon: "📧", title: "Email Scam", color: "#ef4444", phase: "C", desc: "Gmail/Outlook web: phishing, BEC, impersonation detectie", how: "Overlay badge groen/oranje/rood naast afzender", usp: "Meertalig NL/FR/EN" },
    { icon: "🌐", title: "Website Check", color: "#60a5fa", phase: "C", desc: "Domein-leeftijd, typosquatting, verdachte formulieren", how: "Banner + popup waarschuwing bij verdacht domein", usp: "Verder dan HTTPS" },
    { icon: "🛒", title: "Marktplaats", color: "#22c55e", phase: "C", desc: "2dehands, Marktplaats, Vinted: nep-advertenties herkennen", how: "Badge naast prijs bij verdachte advertenties", usp: "BeNeLux specifiek" },
    { icon: "💬", title: "Chat Scan", color: "#f472b6", phase: "C", desc: "WhatsApp/Telegram/Messenger Web: verdachte berichten", how: "Klein icoon naast verdachte berichten", usp: "Alle messaging apps" },
    { icon: "⚖️", title: "GDPR/NIS2", color: "#a78bfa", phase: "D", desc: "Website compliance scan + rapport PDF generatie", how: "Cookie, privacy policy, DPO, SSL audit", usp: "KMO onmisbaar" },
    { icon: "📱", title: "QR Veiligheid", color: "#06b6d4", phase: "Later", desc: "QR codes scannen voordat je de link opent", how: "Camera-feed analyse op mobiel", usp: "Context-aware" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── STRATEGISCH OVERZICHT ── */}
      <div style={{ background: "linear-gradient(135deg, #0a0a2e, #0f1a2e, #0a0f1a)", border: "1px solid #4f46e555", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontSize: 20, fontWeight: 800, background: "linear-gradient(90deg, #818cf8, #60a5fa, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SDK-HRM — Scam Detection & Compliance</div>
          <div style={{ fontSize: 10, color: "#4b5563" }}>8 Feb 2026</div>
        </div>
        <div style={{ fontSize: 13, color: "#d1d5db", marginTop: 10, lineHeight: 1.7 }}>
          Een Chrome extensie die meertalig (NL/FR/EN) en 100% lokaal op je device draait. Scant emails, websites, marktplaatsen en chat-berichten op scams. Premium feature: GDPR/NIS2 compliance rapporten voor Europese KMO's.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 }}>
          <div style={{ background: "#1e1e30", borderRadius: 10, padding: "10px 12px", borderLeft: "3px solid #f97316" }}>
            <div style={{ fontSize: 10, color: "#f97316", fontWeight: 700 }}>IDEE</div>
            <div style={{ fontSize: 12, color: "#e5e7eb", marginTop: 4 }}>Lokale AI die meekijkt terwijl je browst — geen cloud, geen data die je browser verlaat</div>
          </div>
          <div style={{ background: "#1e1e30", borderRadius: 10, padding: "10px 12px", borderLeft: "3px solid #22c55e" }}>
            <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>MARKT</div>
            <div style={{ fontSize: 12, color: "#e5e7eb", marginTop: 4 }}>$2.67B → $15.99B (2034). BeNeLux onbediend. GDPR boetes tot 4% omzet drijven vraag</div>
          </div>
          <div style={{ background: "#1e1e30", borderRadius: 10, padding: "10px 12px", borderLeft: "3px solid #a78bfa" }}>
            <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700 }}>REVENUE</div>
            <div style={{ fontSize: 12, color: "#e5e7eb", marginTop: 4 }}>Freemium extensie + GDPR scan (€29-99). Doel: €5K/mnd MRR via 1000 Pro users</div>
          </div>
        </div>
      </div>

      {/* ── USE CASES GRID ── */}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#818cf8" }}>Wat de gebruiker ziet</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {useCases.map(uc => (
          <div key={uc.title} style={{ background: "#1a1a2e", border: `1px solid ${uc.color}33`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>{uc.icon}</span>
                <div style={{ fontWeight: 700, color: uc.color, fontSize: 14 }}>{uc.title}</div>
              </div>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: uc.color + "22", color: uc.color, fontWeight: 600 }}>{uc.phase}</span>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>{uc.desc}</div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6 }}>Hoe: {uc.how}</div>
            <div style={{ marginTop: 8, padding: "4px 8px", background: "#22c55e08", border: "1px solid #22c55e22", borderRadius: 6, fontSize: 10 }}>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>USP: </span>
              <span style={{ color: "#d1d5db" }}>{uc.usp}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── ROADMAP + REVENUE naast elkaar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Roadmap */}
        <div style={{ background: "#1a1a2e", border: "1px solid #454d60", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 10 }}>Roadmap A → D</div>
          {phases.map(p => {
            const pct = Math.round((p.done / p.total) * 100);
            return (
              <div key={p.id} style={{ marginBottom: 8 }}>
                <div role="button" tabIndex="0" aria-label={`Open/sluit ${p.label || "prediction"}`} aria-expanded={!!expanded["p_" + p.id]} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("p_" + p.id)} onClick={() => toggle("p_" + p.id)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 8px", borderRadius: 8, background: expanded["p_" + p.id] ? p.color + "11" : "transparent" }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: p.color, fontFamily: "monospace", minWidth: 14 }}>{p.id}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{p.title}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: p.status === "ACTIEF" ? "#22c55e22" : "#454d60", color: p.status === "ACTIEF" ? "#4ade80" : "#6b7280", fontWeight: 600 }}>{p.status}</span>
                        <span style={{ fontSize: 9, color: "#4b5563" }}>{p.deadline}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#2d3748" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: p.color, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 9, color: p.color, fontWeight: 700, minWidth: 25 }}>{pct}%</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "#4b5563" }}>{expanded["p_" + p.id] ? "▾" : "▸"}</span>
                </div>
                {expanded["p_" + p.id] && (
                  <div style={{ paddingLeft: 30, paddingTop: 4 }}>
                    <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{p.desc}</div>
                    {p.tasks.map((t, i) => (
                      <div key={i} style={{ fontSize: 10, color: p.tasksDone[i] ? "#4ade80" : "#6b7280", padding: "2px 0" }}>
                        {p.tasksDone[i] ? "✓" : "○"} {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Revenue + USPs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Revenue */}
          <div style={{ background: "#000f00", border: "1px solid #22c55e33", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", marginBottom: 10 }}>Revenue Model</div>
            {[
              { tier: "Gratis", price: "€0", detail: "5 scans/dag — adoptie + flywheel", color: "#6b7280" },
              { tier: "Pro", price: "€4.99/mnd", detail: "Unlimited scans + priority updates", color: "#60a5fa" },
              { tier: "Gezin", price: "€9.99/mnd", detail: "5 devices + elderly dashboard", color: "#f472b6" },
              { tier: "GDPR Scan", price: "€29-99", detail: "Compliance rapport PDF (NL/FR/EN)", color: "#a78bfa" },
            ].map(r => (
              <div key={r.tier} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #2d3748" }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: r.color }}>{r.tier}</span>
                  <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 6 }}>{r.detail}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#4ade80" }}>{r.price}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, padding: "8px 10px", background: "#22c55e11", borderRadius: 8, textAlign: "center" }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#4ade80" }}>€5.000</span>
              <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>MRR doel = 1000 Pro users</span>
            </div>
          </div>

          {/* USPs */}
          <div style={{ background: "#1a1a2e", border: "1px solid #454d60", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 8 }}>Waarom SDK-HRM</div>
            {[
              { label: "Meertalig NL/FR/EN", sub: "Niemand anders doet BeNeLux", color: "#f97316" },
              { label: "100% on-device", sub: "Zero cloud, zero tracking", color: "#22c55e" },
              { label: "Scam + GDPR", sub: "Bescherming + compliance in 1 tool", color: "#a78bfa" },
              { label: "Data flywheel", sub: "User feedback = beter model", color: "#60a5fa" },
              { label: "Crypto nuance", sub: "Legit DeFi vs scam onderscheid", color: "#f59e0b" },
              { label: "Privacy-first", sub: "Geen ads, geen data verkoop", color: "#ef4444" },
            ].map(u => (
              <div key={u.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #ffffff08" }}>
                <div style={{ width: 4, height: 16, borderRadius: 2, background: u.color, flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: u.color }}>{u.label}</span>
                  <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 6 }}>{u.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUMP BAR — v4.18.0
// Simpele inbox bovenaan: plak link/tekst + opmerking, klap open voor items
// ═══════════════════════════════════════════════════════════════════════════════
function DumpBar() {
  var _dev = useDevice(), isPhone = _dev.isPhone, S = _dev.S;
  var items, setItems, inp, setInp, memo, setMemo, open, setOpen, syncing, setSyncing, lastSync, setLastSync;
  var _s1 = useState(function() { try { return JSON.parse(localStorage.getItem("ccc-dump-items") || "[]"); } catch(e) { return []; } });
  items = _s1[0]; setItems = _s1[1];
  var _s2 = useState(""); inp = _s2[0]; setInp = _s2[1];
  var _s3 = useState(""); memo = _s3[0]; setMemo = _s3[1];
  var _s4 = useState(false); open = _s4[0]; setOpen = _s4[1];
  var _s5 = useState(false); syncing = _s5[0]; setSyncing = _s5[1];
  var _s6 = useState(""); lastSync = _s6[0]; setLastSync = _s6[1];

  // Save to localStorage on every change
  useEffect(function() { localStorage.setItem("ccc-dump-items", JSON.stringify(items)); }, [items]);

  // Auto-sync: pull from cloud on mount, merge, push back
  useEffect(function() {
    var device = navigator.userAgent.indexOf("iPhone") > -1 ? "iPhone" : "Mac";
    api.getDump().then(function(data) {
      var cloudItems = (data && data.items) ? data.items : [];
      setItems(function(local) {
        // Merge: alle items van beide kanten
        var allById = {};
        local.forEach(function(i) { allById[i.id] = i; });
        cloudItems.forEach(function(ci) {
          if (!allById[ci.id]) allById[ci.id] = ci;
          // Cloud versie heeft analyse? Neem die over
          else if (ci.analysis && !allById[ci.id].analysis) allById[ci.id] = ci;
        });
        var merged = Object.keys(allById).map(function(k) { return allById[k]; });
        // Push merged set terug naar cloud
        if (merged.length > 0) {
          api.saveDump(merged, device);
        }
        if (data && data.updated) setLastSync(data.updated);
        return merged;
      });
    }).catch(function() {});
  }, []);

  var detectType = function(t) {
    var l = t.toLowerCase();
    if (l.indexOf("youtube.com") > -1 || l.indexOf("youtu.be") > -1) return "youtube";
    if (l.indexOf("instagram.com") > -1) return "instagram";
    if (l.indexOf("twitter.com") > -1 || l.indexOf("x.com/") > -1) return "twitter";
    if (l.indexOf("github.com") > -1) return "github";
    if (l.indexOf("medium.com") > -1) return "article";
    if (l.indexOf("http") === 0) return "link";
    return "note";
  };

  var icons = { youtube: "🎬", instagram: "📸", twitter: "🐦", github: "💻", article: "📰", link: "🔗", note: "📝" };
  var colors = { youtube: "#ef4444", instagram: "#e879f9", twitter: "#38bdf8", github: "#a78bfa", article: "#fb923c", link: "#60a5fa", note: "#14b8a6" };

  // Push to cloud after every change (debounced via useEffect)
  var pushRef = useState(0);
  var pushCount = pushRef[0]; var setPushCount = pushRef[1];
  useEffect(function() {
    if (pushCount === 0) return;
    var device = navigator.userAgent.indexOf("Mac") > -1 ? (navigator.userAgent.indexOf("iPhone") > -1 ? "iPhone" : "Mac") : "unknown";
    api.saveDump(items, device).then(function() { setLastSync(new Date().toISOString()); }).catch(function() {});
  }, [pushCount]);

  var syncNow = function() {
    setSyncing(true);
    api.getDump().then(function(data) {
      if (data && data.items) {
        setItems(function(local) {
          // Merge: keep all local + add cloud-only items
          var localIds = {};
          local.forEach(function(i) { localIds[i.id] = true; });
          var cloudIds = {};
          data.items.forEach(function(i) { cloudIds[i.id] = true; });
          var cloudOnly = data.items.filter(function(ci) { return !localIds[ci.id]; });
          var merged = local.concat(cloudOnly);
          // Push merged back to cloud
          var device = navigator.userAgent.indexOf("iPhone") > -1 ? "iPhone" : "Mac";
          api.saveDump(merged, device);
          return merged;
        });
        if (data.updated) setLastSync(data.updated);
      }
      setSyncing(false);
    }).catch(function() { setSyncing(false); });
  };

  var addItem = function() {
    var c = inp.trim();
    var m = memo.trim();
    if (!c && !m) return;
    var type = detectType(c || m);
    var item = { id: Date.now(), content: c, memo: m, type: type, icon: icons[type], created: new Date().toISOString(), pinned: false };
    // YouTube: haal metadata op via oEmbed (titel, auteur, thumbnail)
    if (type === "youtube") {
      fetch("https://www.youtube.com/oembed?url=" + encodeURIComponent(c) + "&format=json")
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (data) {
            setItems(function(prev) { return prev.map(function(i) {
              return i.id === item.id ? Object.assign({}, i, { title: data.title, author: data.author_name, thumbnail: data.thumbnail_url }) : i;
            }); });
            setPushCount(function(n) { return n + 1; });
          }
        }).catch(function() {});
    }
    setItems(function(prev) { return [item].concat(prev); });
    setInp(""); setMemo("");
    setPushCount(function(n) { return n + 1; });
  };

  var deleteItem = function(id) { setItems(function(prev) { return prev.filter(function(i) { return i.id !== id; }); }); setPushCount(function(n) { return n + 1; }); };
  var togglePin = function(id) { setItems(function(prev) { return prev.map(function(i) { return i.id === id ? Object.assign({}, i, { pinned: !i.pinned }) : i; }); }); setPushCount(function(n) { return n + 1; }); };

  var analyzeItem = function(id) {
    var item = items.find(function(i) { return i.id === id; });
    if (!item || item.analyzing) return;
    setItems(function(prev) { return prev.map(function(i) { return i.id === id ? Object.assign({}, i, { analyzing: true }) : i; }); });
    var prompt = "Analyseer dit item kort en bondig (max 3 zinnen NL). ";
    if (item.type === "youtube") prompt += "Dit is een YouTube video URL. Beschrijf kort wat de video waarschijnlijk bevat en wat de meerwaarde kan zijn.";
    else if (item.type === "article") prompt += "Dit is een artikel link. Vat het onderwerp samen.";
    else if (item.type === "instagram") prompt += "Dit is een Instagram post. Beschrijf kort de relevantie.";
    else prompt += "Beschrijf kort wat dit is en waarom het nuttig kan zijn.";
    if (item.memo) prompt += " Context van de gebruiker: " + item.memo;
    prompt += " Content: " + item.content;
    api.askAI([{ role: "user", content: prompt }]).then(function(r) {
      var text = "Analyse niet beschikbaar";
      if (r && r.content) {
        text = r.content.filter(function(b) { return b.type === "text"; }).map(function(b) { return b.text; }).join("");
      }
      setItems(function(prev) { return prev.map(function(i) { return i.id === id ? Object.assign({}, i, { analyzing: false, analysis: text }) : i; }); });
      setPushCount(function(n) { return n + 1; });
    }).catch(function() {
      setItems(function(prev) { return prev.map(function(i) { return i.id === id ? Object.assign({}, i, { analyzing: false, analysis: "Fout bij analyse" }) : i; }); });
      setPushCount(function(n) { return n + 1; });
    });
  };

  var sorted = items.slice().sort(function(a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created) - new Date(a.created);
  });

  return (
    <div style={{ background: "#0a1a1a", border: "1px solid #0f766e55", borderRadius: 12 }}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>📥</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#14b8a6" }}>Dump</span>
            {items.length > 0 && <span style={{ fontSize: 13, color: "#6b7280", background: "#0f766e22", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>{items.length}</span>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={syncNow} disabled={syncing} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #14b8a6", background: syncing ? "#111" : "#14b8a622", color: syncing ? "#6b7280" : "#14b8a6", fontSize: 14, fontWeight: 700, cursor: syncing ? "wait" : "pointer" }}>{syncing ? "⏳" : "🔄 Sync"}</button>
            {items.length > 0 && <button onClick={function() { setOpen(!open); }} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #454d60", background: "#1e1e30", color: "#9ca3af", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{open ? "▲ Dicht" : "▼ " + items.length + " items"}</button>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Plak URL of tekst..." value={inp} onChange={function(e) { setInp(e.target.value); }}
            onKeyDown={function(e) { if (e.key === "Enter") { addItem(); } }}
            style={{ flex: 1, minWidth: 150, padding: "12px 14px", borderRadius: 8, border: "1px solid #454d60", background: "#1e1e30", color: "#e5e7eb", fontSize: 16, outline: "none" }} />
          {inp.trim() && <span style={{ fontSize: 22, alignSelf: "center" }}>{icons[detectType(inp)]}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input type="text" placeholder="Opmerking / wat wil je eruit halen..." value={memo} onChange={function(e) { setMemo(e.target.value); }}
            onKeyDown={function(e) { if (e.key === "Enter") { addItem(); } }}
            style={{ flex: 1, padding: "12px 14px", borderRadius: 8, border: "1px solid #454d60", background: "#1e1e30", color: "#9ca3af", fontSize: 15, outline: "none" }} />
          <button onClick={addItem} style={{ padding: "12px 20px", borderRadius: 8, border: "1px solid #14b8a6", background: "#14b8a633", color: "#14b8a6", fontSize: 16, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>➕ Dump</button>
        </div>
      </div>
      {open && items.length > 0 && (
        <div style={{ borderTop: "1px solid #0f766e33", padding: 12, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {sorted.map(function(item) {
            var c = colors[item.type] || "#14b8a6";
            var isUrl = item.content && item.content.indexOf("http") === 0;
            return (
              <div key={item.id} style={{ background: "#1e1e30", border: "1px solid #2d3748", borderRadius: 10, padding: 14, borderLeft: "3px solid " + c }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{item.icon || icons[item.type]} <span style={{ fontSize: 13, color: c, fontWeight: 700 }}>{item.type}</span></span>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={function() { togglePin(item.id); }} style={{ fontSize: 18, border: "none", background: "none", color: item.pinned ? "#fbbf24" : "#4b5563", cursor: "pointer", padding: 4 }}>{item.pinned ? "📌" : "📍"}</button>
                    <button onClick={function() { deleteItem(item.id); }} style={{ fontSize: 18, border: "none", background: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}>🗑️</button>
                  </div>
                </div>
                {/* YouTube enriched card: thumbnail + titel + auteur */}
                {item.type === "youtube" && (item.title || item.thumbnail) ? (
                  <a href={item.content} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 12, textDecoration: "none", background: "#222238", borderRadius: 8, padding: 10, marginBottom: 6 }}>
                    {item.thumbnail && <img src={item.thumbnail} alt="" style={{ width: 120, height: 68, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "#e5e5e5", fontSize: 13, lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</div>
                      {item.author && <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.author}</div>}
                    </div>
                  </a>
                ) : item.content && (isUrl
                  ? <a href={item.content} target="_blank" rel="noopener noreferrer" style={{ color: c, fontSize: 14, wordBreak: "break-all", textDecoration: "none", lineHeight: 1.4 }}>{item.content}</a>
                  : <div style={{ color: "#d1d5db", fontSize: 14, lineHeight: 1.4 }}>{item.content}</div>
                )}
                {item.memo && <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 8, padding: "8px 10px", background: "#151520", borderRadius: 6, lineHeight: 1.4 }}>{item.memo}</div>}
                {item.analysis && <div style={{ fontSize: 13, color: "#22c55e", marginTop: 8, padding: "8px 10px", background: "#052e1644", borderRadius: 6, borderLeft: "3px solid #22c55e44", lineHeight: 1.5 }}>{item.analysis}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: "#4b5563" }}>{new Date(item.created).toLocaleDateString("nl-BE")}</div>
                  {!item.analysis && <button onClick={function() { analyzeItem(item.id); }} disabled={item.analyzing} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 6, border: "1px solid #14b8a644", background: "#14b8a611", color: item.analyzing ? "#6b7280" : "#14b8a6", cursor: item.analyzing ? "wait" : "pointer", fontWeight: 600 }}>{item.analyzing ? "⏳ Bezig..." : "🔍 Analyseer"}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO INTELLIGENCE TAB — v4.4.0
// Franky's crypto expertise: 10+ jaar ervaring, trading, DeFi, stablecoins
// Nuanced classificatie: scam vs legitimate crypto activiteit
// ═══════════════════════════════════════════════════════════════════════════════
function CryptoIntelligence() {
  const { isPhone, S } = useDevice();
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Scam Types Data ──
  const scamTypes = [
    { id: "fake-exchange", name: "Fake Exchange/Wallet Phishing", risk: "CRITICAL", icon: "🏦", examples: "Nepsite imiteert Binance, Coinbase, MetaMask login", status: "active", frequency: "Zeer hoog", languages: ["EN", "NL", "FR"], detection: "URL-analyse + visuele fingerprint + certificaat check" },
    { id: "seed-phrase", name: "Seed Phrase Theft", risk: "CRITICAL", icon: "🔑", examples: "'Validate your wallet', 'Sync your seed phrase'", status: "active", frequency: "Hoog", languages: ["EN", "NL"], detection: "Keyword pattern + intentie-analyse + context" },
    { id: "pig-butchering", name: "Pig Butchering (Romance→Crypto)", risk: "CRITICAL", icon: "🐷", examples: "Langzame vertrouwensopbouw → crypto investering → exit", status: "active", frequency: "Hoog", languages: ["EN", "NL", "FR"], detection: "Gedragspatroon over tijd + financieel escalatie tracking" },
    { id: "pump-dump", name: "Pump & Dump Schemes", risk: "HIGH", icon: "📈", examples: "Telegram/Discord 'guaranteed 100x moonshot'", status: "active", frequency: "Hoog", languages: ["EN"], detection: "Volume anomalie + social media sentiment + token leeftijd" },
    { id: "rug-pull", name: "Rug Pull DeFi", risk: "HIGH", icon: "🪤", examples: "Nieuwe token zonder audit, nep TVL, liquidity niet locked", status: "active", frequency: "Medium", languages: ["EN"], detection: "Smart contract audit status + liquidity lock check + team verificatie" },
    { id: "fake-airdrop", name: "Fake Airdrop / Malicious Contracts", risk: "HIGH", icon: "🎁", examples: "'Claim your free tokens' → unlimited approval → drain wallet", status: "active", frequency: "Zeer hoog", languages: ["EN", "NL"], detection: "Contract approval analyse + airdrop legitimiteit check" },
    { id: "investment-ponzi", name: "Crypto Investment Ponzi", risk: "HIGH", icon: "💸", examples: "Gegarandeerd 50-100% maandelijks rendement, referral bonus", status: "active", frequency: "Medium", languages: ["EN", "NL", "FR"], detection: "Rendement realiteitscheck + Ponzi patroon detectie" },
    { id: "nft-scam", name: "NFT Scams", risk: "MEDIUM", icon: "🖼️", examples: "Fake mints, counterfeit collecties, wash trading", status: "active", frequency: "Medium", languages: ["EN"], detection: "Collectie verificatie + creator history + volume analyse" },
  ];

  // ── Legitimate Crypto Types ──
  const legitimateTypes = [
    { id: "exchange-comms", name: "Exchange Communicatie", icon: "✅", examples: "Binance/Coinbase/Kraken account notificaties, 2FA alerts", confidence: "Hoog", markers: "Officieel domein, geen seed phrase requests, standaard security flow" },
    { id: "defi-governance", name: "DeFi Governance & Staking", icon: "🗳️", examples: "Uniswap governance proposals, AAVE staking rewards, Compound yields", confidence: "Hoog", markers: "3-8% APY realistisch, audited protocol, TVL verifieerbaar" },
    { id: "stablecoin-ops", name: "Stablecoin Operaties", icon: "💵", examples: "USDC/USDT transfers, Circle compliance, yield op gereguleerde platforms", confidence: "Hoog", markers: "Gereguleerde issuer, MiCA/GENIUS Act compliant, 1:1 backed" },
    { id: "hardware-wallet", name: "Hardware Wallet Alerts", icon: "🔐", examples: "Ledger firmware updates, Trezor security advisories", confidence: "Medium", markers: "Officieel domein check cruciaal — meest geïmiteerd" },
    { id: "regulatory", name: "Regulatory Updates", icon: "⚖️", examples: "MiCA implementatie, GENIUS Act, DORA compliance", confidence: "Hoog", markers: "Officiële overheidsbronn, geen actie-dwang, informatief" },
    { id: "institutional", name: "Institutionele Adoptie", icon: "🏛️", examples: "JPMorgan crypto custody, BNP Paribas tokenization, BlackRock ETF", confidence: "Hoog", markers: "Beursgenoteerd bedrijf, publieke aankondiging, verifieerbaar" },
  ];

  // ── Regulatory Landscape ──
  const regulations = [
    { name: "GENIUS Act (US)", status: "Aangenomen", year: "2025", scope: "Stablecoins", impact: "Stablecoins als gereguleerde financiële instrumenten", color: "#22c55e" },
    { name: "MiCA (EU)", status: "Van kracht", year: "2024", scope: "Alle crypto-assets", impact: "Uniforme EU-regulatie, licentie-eis voor exchanges", color: "#22c55e" },
    { name: "DORA (EU)", status: "Van kracht", year: "2025", scope: "Financiële sector", impact: "ICT-risicobeheer, ook voor crypto service providers", color: "#22c55e" },
    { name: "Travel Rule (FATF)", status: "Implementatie", year: "2024-2026", scope: "Cross-border transfers", impact: "KYC/AML voor alle crypto transfers >€1000", color: "#fbbf24" },
    { name: "DAC8 (EU)", status: "Goedgekeurd", year: "2026", scope: "Belasting", impact: "Automatische rapportage crypto-inkomsten", color: "#fbbf24" },
    { name: "Stablecoin Act (US)", status: "Pending", year: "2026", scope: "Reserve requirements", impact: "1:1 fiat backing vereist, audit-eis", color: "#f97316" },
  ];

  // ── Franky's Expertise Profile ──
  const expertiseAreas = [
    { area: "Trading & Technische Analyse", years: "10+", level: "Gevorderd", detail: "TradingView abonnement, chart patterns, indicatoren" },
    { area: "DeFi & Yield Farming", years: "5+", level: "Gevorderd", detail: "AAVE, Compound, Uniswap, liquidity provisioning" },
    { area: "Stablecoins & Regulatie", years: "4+", level: "Expert", detail: "USDC, USDT, MiCA, GENIUS Act, reserves" },
    { area: "Blockchain Architectuur", years: "8+", level: "Gevorderd", detail: "L1/L2, consensus, smart contracts, bridges" },
    { area: "Scam Herkenning", years: "10+", level: "Expert", detail: "Rug pulls, Ponzi's, phishing, social engineering patronen" },
    { area: "Institutionele Adoptie", years: "3+", level: "Gevorderd", detail: "ETF's, custody, tokenization, CBDC's" },
  ];

  // ── SDK-HRM Integration Points ──
  const integrationPoints = [
    { module: "Email Guardian", crypto: "Phishing detectie voor exchange/wallet emails, fake airdrop links", priority: "P0", status: "ready" },
    { module: "Website Guardian", crypto: "Fake exchange detectie, malicious dApp scanning, contract approval warnings", priority: "P0", status: "ready" },
    { module: "Mobile Agent", crypto: "Wallet app verificatie, QR code crypto scam detectie", priority: "P1", status: "planned" },
    { module: "Investment Fraud", crypto: "Ponzi patroon herkenning, unrealistisch rendement flagging", priority: "P1", status: "planned" },
    { module: "Social Graph", crypto: "Romance→crypto exit patroon, pig butchering timeline detectie", priority: "P1", status: "planned" },
    { module: "Document Verifier", crypto: "Fake whitepaper detectie, nep audit rapport herkenning", priority: "P2", status: "concept" },
    { module: "Blockchain Trust Layer", crypto: "On-chain verificatie van adressen, contract audits, scam databases", priority: "P2", status: "concept" },
  ];

  // ── Training Data Roadmap ──
  const trainingRoadmap = [
    { phase: "Phase 1", target: "100 crypto scenarios", timeline: "Week 1", langs: "EN/NL/FR", focus: "Top 4 scam types + top 3 legitimate types", status: "next" },
    { phase: "Phase 2", target: "500 crypto scenarios", timeline: "Maand 1", langs: "EN/NL/FR/DE", focus: "Alle 8 scam types + real-world phishing emails", status: "planned" },
    { phase: "Phase 3", target: "2000 crypto scenarios", timeline: "Maand 2-3", langs: "8 talen", focus: "Edge cases, nieuwe scam patronen, regulatory context", status: "planned" },
    { phase: "Phase 4", target: "5000+ continuous", timeline: "Ongoing", langs: "Multilingual", focus: "Data flywheel: user feedback → nieuwe training data", status: "concept" },
  ];

  // ── Key Insight: Fiat vs Crypto Timeline ──
  const timelineEvents = [
    { year: "2009", event: "Bitcoin genesis block", type: "crypto" },
    { year: "2015", event: "Ethereum & smart contracts", type: "crypto" },
    { year: "2020", event: "DeFi Summer — yield farming explosie", type: "crypto" },
    { year: "2021", event: "El Salvador: BTC als legal tender", type: "regulation" },
    { year: "2024", event: "MiCA van kracht in EU", type: "regulation" },
    { year: "2024", event: "Bitcoin & Ethereum ETF's goedgekeurd", type: "institutional" },
    { year: "2025", event: "GENIUS Act — stablecoin regulatie US", type: "regulation" },
    { year: "2025", event: "DORA — financiële ICT-regulatie EU", type: "regulation" },
    { year: "2026", event: "DAC8 — automatische crypto-belasting EU", type: "regulation" },
    { year: "~2030", event: "CBDC's operationeel (digitale euro)", type: "institutional" },
    { year: "~2035", event: "Blockchain-fiat integratie mainstream", type: "vision" },
  ];

  const riskColor = (r) => r === "CRITICAL" ? "#ef4444" : r === "HIGH" ? "#f97316" : "#fbbf24";
  const statusColor = (s) => s === "ready" ? "#22c55e" : s === "planned" ? "#fbbf24" : "#6b7280";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg, #0a1a0a, #0f1a2e, #1a1a0a)", border: "2px solid #f59e0b", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 24, background: "linear-gradient(90deg, #f59e0b, #f97316, #ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              🪙 Crypto Intelligence Hub
            </div>
            <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 6 }}>Nuanced crypto scam vs legitimate classificatie — powered by 10+ jaar domeinexpertise</p>
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>Franky's expertise • TradingView • DeFi • Stablecoins • MiCA/GENIUS Act</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "8", sub: "scam types", color: "#ef4444" },
              { label: "6", sub: "legit types", color: "#22c55e" },
              { label: "6", sub: "regelgeving", color: "#60a5fa" },
              { label: "10+", sub: "jaar expertise", color: "#f59e0b" },
            ].map(m => (
              <div key={m.sub} style={{ textAlign: "center", padding: "8px 14px", background: `${m.color}11`, border: `1px solid ${m.color}44`, borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.label}</div>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CORE VISION ── */}
      <div style={{ background: "#0a0f1a", border: "1px solid #f59e0b44", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#f59e0b", marginBottom: 10 }}>💡 Kernvisie: Waarom Crypto Security Een Moat Is</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <div style={{ background: "#ef444411", border: "1px solid #ef444433", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 700, color: "#ef4444", fontSize: 13 }}>❌ Het Probleem</div>
            <p style={{ color: "#d1d5db", fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
              Bestaande AI tools (Gmail, Defender) markeren ALLE crypto als verdacht. Binance emails → spam. MetaMask links → geblokkeerd.
              Dit is alsof je elke ING-brief als phishing behandelt omdat er ooit ING-phishing bestond.
            </p>
          </div>
          <div style={{ background: "#22c55e11", border: "1px solid #22c55e33", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 700, color: "#22c55e", fontSize: 13 }}>✅ SDK-HRM Oplossing</div>
            <p style={{ color: "#d1d5db", fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
              Nuanced classificatie getraind door domeinexpert. Onderscheidt 5% yield op AAVE (legit) van "stuur 1 ETH krijg 10 terug" (scam).
              Kent het verschil tussen MiCA-compliant exchange en offshore platform.
            </p>
          </div>
          <div style={{ background: "#60a5fa11", border: "1px solid #60a5fa33", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 700, color: "#60a5fa", fontSize: 13 }}>🔮 De Toekomst</div>
            <p style={{ color: "#d1d5db", fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
              Blockchain-fiat integratie is onvermijdelijk. GENIUS Act + MiCA maken stablecoins gereguleerd.
              Binnen 10 jaar: crypto volledig mainstream. SDK-HRM is klaar voor die wereld.
            </p>
          </div>
        </div>
      </div>

      {/* ── SCAM TYPES (Expandable) ── */}
      <div style={{ background: "#0f0000", border: "1px solid #ef444466", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit scam analyse sectie" aria-expanded={!!expanded.scams} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("scams")} onClick={() => toggle("scams")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.scams ? "#ef444411" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#ef4444", fontSize: 15 }}>Crypto Scam Types — 8 Categorieën</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>CRITICAL en HIGH risk patronen voor SDK-HRM training</div>
            </div>
          </div>
          <span style={{ color: "#6b7280", fontSize: 18, marginLeft: 8 }}>{expanded.scams ? "▼" : "▶"}</span>
        </div>
        {expanded.scams && (
          <div style={{ padding: 16, borderTop: "1px solid #ef444433" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {scamTypes.map(s => (
                <div key={s.id} style={{ background: "#1a0000", border: `1px solid ${riskColor(s.risk)}33`, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{s.icon}</span>
                      <span style={{ fontWeight: 700, color: "#e5e7eb", fontSize: 13 }}>{s.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ padding: "2px 8px", background: `${riskColor(s.risk)}22`, color: riskColor(s.risk), borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{s.risk}</span>
                      <span style={{ padding: "2px 8px", background: "#f59e0b22", color: "#f59e0b", borderRadius: 4, fontSize: 10 }}>{s.frequency}</span>
                      {s.languages.map(l => <span key={l} style={{ padding: "2px 6px", background: "#60a5fa11", color: "#60a5fa", borderRadius: 4, fontSize: 9 }}>{l}</span>)}
                    </div>
                  </div>
                  <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 6, fontStyle: "italic" }}>Voorbeeld: {s.examples}</p>
                  <p style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>Detectie: {s.detection}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── LEGITIMATE TYPES (Expandable) ── */}
      <div style={{ background: "#000f00", border: "1px solid #22c55e66", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit legit projecten sectie" aria-expanded={!!expanded.legit} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("legit")} onClick={() => toggle("legit")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.legit ? "#22c55e11" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#22c55e", fontSize: 15 }}>Legitimate Crypto — 6 Categorieën</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>SAFE labels: wat het model NIET mag flaggen als scam</div>
            </div>
          </div>
          <span style={{ color: "#6b7280", fontSize: 18, marginLeft: 8 }}>{expanded.legit ? "▼" : "▶"}</span>
        </div>
        {expanded.legit && (
          <div style={{ padding: 16, borderTop: "1px solid #22c55e33" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {legitimateTypes.map(l => (
                <div key={l.id} style={{ background: "#001a00", border: "1px solid #22c55e33", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{l.icon}</span>
                    <span style={{ fontWeight: 700, color: "#e5e7eb", fontSize: 13 }}>{l.name}</span>
                    <span style={{ padding: "2px 8px", background: "#22c55e22", color: "#22c55e", borderRadius: 4, fontSize: 10 }}>Confidence: {l.confidence}</span>
                  </div>
                  <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 6, fontStyle: "italic" }}>Voorbeelden: {l.examples}</p>
                  <p style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>Markers: {l.markers}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── REGULATORY LANDSCAPE ── */}
      <div style={{ background: "#000a1a", border: "1px solid #60a5fa66", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit regulatie sectie" aria-expanded={!!expanded.regs} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("regs")} onClick={() => toggle("regs")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.regs ? "#60a5fa11" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>⚖️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#60a5fa", fontSize: 15 }}>Regulatory Landscape — Crypto Wordt Mainstream</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>GENIUS Act, MiCA, DORA, DAC8 — de wettelijke integratie</div>
            </div>
          </div>
          <span style={{ color: "#6b7280", fontSize: 18, marginLeft: 8 }}>{expanded.regs ? "▼" : "▶"}</span>
        </div>
        {expanded.regs && (
          <div style={{ padding: 16, borderTop: "1px solid #60a5fa33" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {regulations.map(r => (
                <div key={r.name} style={{ background: "#0a1020", border: `1px solid ${r.color}33`, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, color: "#e5e7eb", fontSize: 13 }}>{r.name}</span>
                    <span style={{ padding: "2px 8px", background: `${r.color}22`, color: r.color, borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{r.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <span style={{ padding: "2px 6px", background: "#ffffff11", color: "#9ca3af", borderRadius: 4, fontSize: 10 }}>{r.year}</span>
                    <span style={{ padding: "2px 6px", background: "#ffffff11", color: "#9ca3af", borderRadius: 4, fontSize: 10 }}>{r.scope}</span>
                  </div>
                  <p style={{ color: "#6b7280", fontSize: 11, marginTop: 6 }}>{r.impact}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── FIAT→CRYPTO TIMELINE ── */}
      <div style={{ background: "#0a0a0f", border: "1px solid #a855f766", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit timeline sectie" aria-expanded={!!expanded.timeline} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("timeline")} onClick={() => toggle("timeline")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.timeline ? "#a855f711" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>📅</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#a855f7", fontSize: 15 }}>Fiat → Crypto Integratie Timeline</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Van Bitcoin genesis naar blockchain-fiat convergentie</div>
            </div>
          </div>
          <span style={{ color: "#6b7280", fontSize: 18, marginLeft: 8 }}>{expanded.timeline ? "▼" : "▶"}</span>
        </div>
        {expanded.timeline && (
          <div style={{ padding: 16, borderTop: "1px solid #a855f733" }}>
            <div style={{ position: "relative", paddingLeft: 24 }}>
              {timelineEvents.map((e, i) => {
                const col = e.type === "crypto" ? "#f59e0b" : e.type === "regulation" ? "#60a5fa" : e.type === "institutional" ? "#22c55e" : "#a855f7";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, position: "relative" }}>
                    <div style={{ position: "absolute", left: -18, width: 10, height: 10, borderRadius: "50%", background: col, border: `2px solid ${col}66` }} />
                    {i < timelineEvents.length - 1 && <div style={{ position: "absolute", left: -14, top: 14, width: 2, height: 26, background: "#2d3748" }} />}
                    <span style={{ color: col, fontWeight: 700, fontSize: 12, minWidth: 50 }}>{e.year}</span>
                    <span style={{ color: "#d1d5db", fontSize: 12 }}>{e.event}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
              {[{ label: "Crypto", color: "#f59e0b" }, { label: "Regulatie", color: "#60a5fa" }, { label: "Institutioneel", color: "#22c55e" }, { label: "Visie", color: "#a855f7" }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: l.color }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} /> {l.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── EXPERTISE PROFILE ── */}
      <div style={{ background: "#0f0a00", border: "1px solid #f59e0b66", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit expertise sectie" aria-expanded={!!expanded.expertise} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("expertise")} onClick={() => toggle("expertise")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.expertise ? "#f59e0b11" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>🎓</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: 15 }}>Franky's Crypto Expertise Profile</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Domeinkennis die de training data kwaliteit bepaalt</div>
            </div>
          </div>
          <span style={{ color: "#6b7280", fontSize: 18, marginLeft: 8 }}>{expanded.expertise ? "▼" : "▶"}</span>
        </div>
        {expanded.expertise && (
          <div style={{ padding: 16, borderTop: "1px solid #f59e0b33" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {expertiseAreas.map(e => (
                <div key={e.area} style={{ background: "#1a1000", border: "1px solid #f59e0b33", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: "#e5e7eb", fontSize: 13 }}>{e.area}</span>
                    <span style={{ padding: "2px 8px", background: e.level === "Expert" ? "#22c55e22" : "#f59e0b22", color: e.level === "Expert" ? "#22c55e" : "#f59e0b", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{e.level}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <span style={{ padding: "2px 6px", background: "#ffffff11", color: "#9ca3af", borderRadius: 4, fontSize: 10 }}>{e.years} jaar</span>
                  </div>
                  <p style={{ color: "#6b7280", fontSize: 11, marginTop: 6 }}>{e.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── SDK-HRM INTEGRATION ── */}
      <div style={{ background: "#0a0a0f", border: "1px solid #f9731666", borderRadius: 12, overflow: "hidden" }}>
        <div role="button" tabIndex="0" aria-label="Open/sluit integratie sectie" aria-expanded={!!expanded.integration} onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggle("integration")} onClick={() => toggle("integration")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: expanded.integration ? "#f9731611" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>🔗</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#f97316", fontSize: 15 }}>SDK-HRM Module Integratie</div>
                <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>7 Feb 2026</div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Hoe crypto intelligence in elk SDK-HRM module past</div>
            </div>
          </div>
          <span style={{ color: "#6b7280", fontSize: 18, marginLeft: 8 }}>{expanded.integration ? "▼" : "▶"}</span>
        </div>
        {expanded.integration && (
          <div style={{ padding: 16, borderTop: "1px solid #f9731633" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {integrationPoints.map(ip => (
                <div key={ip.module} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1e1e30", border: "1px solid #2d3748", borderRadius: 8, padding: 10 }}>
                  <div style={{ minWidth: 60, textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", background: ip.priority === "P0" ? "#ef444422" : ip.priority === "P1" ? "#f59e0b22" : "#6b728022", color: ip.priority === "P0" ? "#ef4444" : ip.priority === "P1" ? "#f59e0b" : "#6b7280", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{ip.priority}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: "#e5e7eb", fontSize: 12 }}>{ip.module}</span>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor(ip.status) }} />
                    </div>
                    <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>{ip.crypto}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── TRAINING DATA ROADMAP ── */}
      <div style={{ background: "#0a0f0a", border: "1px solid #22c55e66", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#22c55e", marginBottom: 12 }}>🗺️ Training Data Roadmap — Crypto</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {trainingRoadmap.map(p => (
            <div key={p.phase} style={{ background: p.status === "next" ? "#22c55e11" : "#111", border: `1px solid ${p.status === "next" ? "#22c55e" : "#2d3748"}`, borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: p.status === "next" ? "#22c55e" : "#e5e7eb", fontSize: 14 }}>{p.phase}</span>
                <span style={{ padding: "2px 8px", background: p.status === "next" ? "#22c55e22" : "#ffffff11", color: p.status === "next" ? "#22c55e" : "#6b7280", borderRadius: 4, fontSize: 10 }}>{p.status === "next" ? "VOLGENDE" : p.status.toUpperCase()}</span>
              </div>
              <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: 16, marginTop: 6 }}>{p.target}</div>
              <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>{p.timeline} • {p.langs}</p>
              <p style={{ color: "#6b7280", fontSize: 10, marginTop: 4 }}>{p.focus}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ background: "#1e1e30", border: "1px solid #2d3748", borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
          <p><strong style={{ color: "#f59e0b" }}>InfraNodus graph:</strong> SDK-HRM-crypto-security (12 clusters) — <a href="https://infranodus.com" target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>bekijk in InfraNodus</a></p>
          <p style={{ marginTop: 4 }}><strong style={{ color: "#f59e0b" }}>Kernprincipe:</strong> Precision boven paranoia — het model moet het verschil kennen tussen een Binance security alert en een phishing mail</p>
          <p style={{ marginTop: 4 }}><strong style={{ color: "#f59e0b" }}>Visie:</strong> Blockchain-technologie overtreft fiat in efficiëntie. Binnen 10 jaar volledig geïntegreerd. SDK-HRM bewaakt die transitie.</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ISSUES PANEL — Klikbare filters + opgelost/backlog functie
// ═══════════════════════════════════════════════════════════════════════════════
function IssuesPanel({ issues, allItems }) {
  const { isPhone, S, reducedMotion } = useDevice();
  const [filter, setFilter] = useState("all");
  const [resolved, setResolved] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ccc-resolved-issues") || "[]"); } catch(e) { return []; }
  });
  const [showBacklog, setShowBacklog] = useState(false);

  const resolve = (id) => {
    const now = new Date().toLocaleString("nl-BE");
    const updated = [...resolved, { id, date: now }];
    setResolved(updated);
    localStorage.setItem("ccc-resolved-issues", JSON.stringify(updated));
  };

  const unresolve = (id) => {
    const updated = resolved.filter(r => r.id !== id);
    setResolved(updated);
    localStorage.setItem("ccc-resolved-issues", JSON.stringify(updated));
  };

  const resolvedIds = resolved.map(r => r.id);
  const activeIssues = issues.filter(i => !resolvedIds.includes(i.id));
  const resolvedIssues = issues.filter(i => resolvedIds.includes(i.id));
  const errCount = activeIssues.filter(i => i.status === STATUS.ERROR).length;
  const warnCount = activeIssues.filter(i => i.status === STATUS.WARN).length;
  const okItems = allItems.filter(i => i.status === STATUS.OK || i.status === STATUS.INFO || i.status === STATUS.SYNCING);
  const okCount = okItems.length;

  const filtered = filter === "all" ? activeIssues
    : filter === "error" ? activeIssues.filter(i => i.status === STATUS.ERROR)
    : filter === "warn" ? activeIssues.filter(i => i.status === STATUS.WARN)
    : filter === "ok" ? okItems
    : activeIssues;

  const filterButtons = [
    { id: "all", count: activeIssues.length, label: "Alle Issues", color: "#60a5fa", bg: "#001a33", border: "#1e40af" },
    { id: "error", count: errCount, label: "Kritiek", color: "#ef4444", bg: "#1a0000", border: "#991b1b" },
    { id: "warn", count: warnCount, label: "Waarschuwingen", color: "#fbbf24", bg: "#1a1400", border: "#854d0e" },
    { id: "ok", count: okCount, label: "OK", color: "#4ade80", bg: "#052e16", border: "#166534" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Klikbare filter bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {filterButtons.map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => { setFilter(f.id); setShowBacklog(false); }} style={{
              background: active ? f.bg : "#111", border: `1px solid ${active ? f.border : "#454d60"}`,
              borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 90, cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s, transform 0.15s", outline: active ? `2px solid ${f.color}44` : "none", outlineOffset: 2,
              transform: active ? "scale(1.05)" : "scale(1)"
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: f.color }}>{f.count}</div>
              <div style={{ fontSize: 10, color: f.color + "cc" }}>{f.label}</div>
            </button>
          );
        })}
        {resolvedIssues.length > 0 && (
          <button onClick={() => { setShowBacklog(!showBacklog); if (!showBacklog) setFilter("backlog"); else setFilter("all"); }} style={{
            background: showBacklog ? "#0f0f23" : "#111", border: `1px solid ${showBacklog ? "#5b21b6" : "#454d60"}`,
            borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 90, cursor: "pointer", transition: "background 0.15s, border-color 0.15s, transform 0.15s",
            outline: showBacklog ? "2px solid #a78bfa44" : "none", outlineOffset: 2,
            transform: showBacklog ? "scale(1.05)" : "scale(1)"
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa" }}>{resolvedIssues.length}</div>
            <div style={{ fontSize: 10, color: "#c4b5fd" }}>Opgelost</div>
          </button>
        )}
      </div>

      {/* Actief filter label */}
      <div style={{ fontSize: 11, color: "#6b7280", borderBottom: "1px solid #2d3748", paddingBottom: 6 }}>
        {filter === "all" && `Alle issues (${activeIssues.length})`}
        {filter === "error" && `${errCount} kritieke issues`}
        {filter === "warn" && `${warnCount} waarschuwingen`}
        {filter === "ok" && `${okCount} items OK`}
        {filter === "backlog" && `${resolvedIssues.length} opgeloste issues`}
      </div>

      {/* Issues/OK items grid */}
      {filter !== "backlog" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {filtered.map(i => {
            const isErr = i.status === STATUS.ERROR;
            const isWarn = i.status === STATUS.WARN;
            const isOk = !isErr && !isWarn;
            const cardBg = isErr ? "#1a0000" : isWarn ? "#1a1400" : "#0a1a0a";
            const cardBorder = isErr ? "#991b1b" : isWarn ? "#854d0e" : "#166534";
            const nameColor = isErr ? "#fca5a5" : isWarn ? "#fde68a" : "#86efac";
            const badgeColor = isErr ? "#ef4444" : isWarn ? "#fbbf24" : "#4ade80";
            const badgeBg = isErr ? "#ef444422" : isWarn ? "#f59e0b22" : "#22c55e22";
            const badgeText = isErr ? "KRITIEK" : isWarn ? "WARN" : "OK";
            return (
              <div key={i.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                    <span style={{ fontSize: 14 }}>{i.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 12, color: nameColor }}>{i.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: badgeBg, color: badgeColor, fontWeight: 700 }}>{badgeText}</span>
                    {!isOk && <button onClick={() => resolve(i.id)} title="Markeer als opgelost" style={{
                      fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid #16653466",
                      background: "#052e1666", color: "#4ade80", cursor: "pointer", lineHeight: 1
                    }}>✓</button>}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{i.path}</div>
                {i.detail && <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{i.detail}</div>}
                {i.recommendation && <div style={{ fontSize: 10, color: "#fbbf24", padding: "3px 6px", borderRadius: 4, background: "#1a140066" }}>💡 {i.recommendation}</div>}
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 24, color: "#6b7280", fontSize: 13 }}>Geen {filter === "error" ? "kritieke" : filter === "warn" ? "waarschuwings" : filter === "ok" ? "OK" : ""} items gevonden</div>}
        </div>
      )}

      {/* Backlog - opgeloste issues */}
      {filter === "backlog" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
          {resolvedIssues.map(i => {
            const rd = resolved.find(r => r.id === i.id);
            return (
              <div key={i.id} style={{ background: "#1a1a2e", border: "1px solid #454d60", borderRadius: 10, padding: 12, opacity: 0.75 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13 }}>{i.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 12, color: "#9ca3af", textDecoration: "line-through" }}>{i.name}</span>
                  </div>
                  <button onClick={() => unresolve(i.id)} title="Terugzetten naar actief" style={{
                    fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid #854d0e66",
                    background: "#1a140066", color: "#fbbf24", cursor: "pointer", lineHeight: 1
                  }}>↩</button>
                </div>
                <div style={{ fontSize: 10, color: "#4b5563" }}>{i.path}</div>
                {rd && <div style={{ fontSize: 9, color: "#22c55e", marginTop: 4 }}>✓ Opgelost op {rd.date}</div>}
              </div>
            );
          })}
          {resolvedIssues.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 24, color: "#6b7280", fontSize: 13 }}>Geen opgeloste issues</div>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALL TOOLS PANEL — Overzicht van alle tools, plugins, MCP, skills
// ═══════════════════════════════════════════════════════════════════════════════

var TOOLS_DATA = {
  builtin: [
    { id: "bash", name: "Bash", desc: "Terminal command uitvoering", icon: "🖥️", status: "installed" },
    { id: "edit", name: "Edit", desc: "Bestanden bewerken", icon: "✏️", status: "installed" },
    { id: "read", name: "Read", desc: "Bestanden lezen (tekst, afbeeldingen, PDF)", icon: "📖", status: "installed" },
    { id: "write", name: "Write", desc: "Bestanden schrijven", icon: "📝", status: "installed" },
    { id: "glob", name: "Glob", desc: "Bestanden zoeken op patroon", icon: "🔍", status: "installed" },
    { id: "grep", name: "Grep", desc: "Zoeken in bestandsinhoud (ripgrep)", icon: "🔎", status: "installed" },
    { id: "websearch", name: "WebSearch", desc: "Web zoeken met AI", icon: "🌐", status: "installed" },
    { id: "webfetch", name: "WebFetch", desc: "URL ophalen en verwerken", icon: "📡", status: "installed" },
    { id: "agent", name: "Agent", desc: "Sub-agent taken delegeren", icon: "🤖", status: "installed" },
    { id: "todowrite", name: "TodoWrite", desc: "Takenlijst beheer", icon: "✅", status: "installed" },
    { id: "listmcpresources", name: "ListMcpResources", desc: "MCP resources oplijsten", icon: "📋", status: "installed" },
    { id: "readmcpresource", name: "ReadMcpResource", desc: "MCP resource uitlezen", icon: "📄", status: "installed" },
    { id: "notebookedit", name: "NotebookEdit", desc: "Jupyter notebooks bewerken", icon: "📓", status: "installed" },
    { id: "taskoutput", name: "TaskOutput", desc: "Achtergrondtaak output lezen", icon: "📊", status: "installed" },
    { id: "askuser", name: "AskUserQuestion", desc: "Gebruiker een vraag stellen", icon: "❓", status: "installed" },
  ],
  plugins: [
    { id: "claude-mem", name: "claude-mem", version: "v9.0.17", author: "thedotmack", desc: "Persistent memory met hooks, MCP server, 2 commands", icon: "🧠", status: "installed", url: "https://github.com/thedotmack/claude-mem", devices: ["MM4"] },
  ],
  mcpServers: [
    { id: "claude-mem-mcp", name: "claude-mem:mcp-search", type: "stdio", desc: "Memory search via Chroma vector DB", icon: "🔍", status: "connected", tools: ["search", "timeline", "get_observations"], devices: ["MM4"] },
    { id: "infranodus", name: "infranodus", type: "stdio (npx)", desc: "Knowledge graphs, text analysis, SEO, research", icon: "🕸️", status: "connected", tools: ["generate_knowledge_graph", "create_knowledge_graph", "search", "+20 meer"], devices: ["MM4"] },
    { id: "screencast", name: "Screencast (Chrome)", type: "stdio", desc: "Browser automation, screenshots, DOM interactie", icon: "🖥️", status: "connected", tools: ["read_page", "find", "navigate", "computer", "+10 meer"], devices: ["MM4"] },
  ],
  skills: [
    { id: "make-plan", name: "/make-plan", source: "claude-mem", desc: "Implementatieplan maken met subagents", icon: "📐", status: "installed", devices: ["MM4"] },
    { id: "do", name: "/do", source: "claude-mem", desc: "Plan uitvoeren met subagent orchestratie", icon: "▶️", status: "installed", devices: ["MM4"] },
    { id: "feature-dev", name: "/feature-dev", source: "marketplace", desc: "Feature development workflow", icon: "🛠️", status: "installed" },
    { id: "code-review", name: "/code-review", source: "marketplace", desc: "Code review uitvoeren", icon: "👀", status: "installed" },
    { id: "revise-claude-md", name: "/revise-claude-md", source: "marketplace", desc: "CLAUDE.md revisie", icon: "📄", status: "installed" },
    { id: "create-plugin", name: "/create-plugin", source: "marketplace", desc: "Plugin aanmaken", icon: "🔌", status: "installed" },
    { id: "review-pr", name: "/review-pr", source: "marketplace", desc: "Pull request reviewen", icon: "🔀", status: "installed" },
    { id: "new-sdk-app", name: "/new-sdk-app", source: "marketplace", desc: "SDK app bootstrappen", icon: "📦", status: "installed" },
    { id: "commit-push-pr", name: "/commit-push-pr", source: "marketplace", desc: "Commit, push, PR in 1 stap", icon: "🚀", status: "installed" },
    { id: "ralph-loop", name: "/ralph-loop", source: "marketplace", desc: "Iterative development loop", icon: "🔄", status: "installed" },
    { id: "analyze-video", name: "/analyze-video", source: "custom", desc: "Video analyse", icon: "🎬", status: "installed" },
    { id: "smart-tools", name: "/smart-tools", source: "custom", desc: "Slimme tools beheer", icon: "🧰", status: "installed" },
    { id: "wiggins-loop", name: "/wiggins-loop", source: "custom", desc: "Wiggins development loop", icon: "🔁", status: "installed" },
    { id: "serena-herstel", name: "/serena-herstel", source: "custom", desc: "Serena herstel procedure", icon: "🔧", status: "error" },
  ],
  vercelSkills: [
    { id: "react-best-practices", name: "React Best Practices", version: "v1.0.0", author: "Vercel Engineering", desc: "40+ React/Next.js optimalisatie regels (8 categorieeen, CRITICAL→LOW)", icon: "⚛️", status: "installed", url: "https://github.com/vercel-labs/agent-skills", devices: ["MM4"] },
    { id: "web-design-guidelines", name: "Web Design Guidelines", version: "v1.0.0", author: "Vercel Engineering", desc: "100+ UI audit regels (accessibility, performance, UX)", icon: "🎨", status: "installed", url: "https://github.com/vercel-labs/agent-skills", devices: ["MM4"] },
    { id: "composition-patterns", name: "Composition Patterns", version: "v1.0.0", author: "Vercel Engineering", desc: "Scalable React component architectuur, anti-prop drilling", icon: "🧩", status: "installed", url: "https://github.com/vercel-labs/agent-skills", devices: ["MM4"] },
    { id: "react-native-skills", name: "React Native Guidelines", version: "v1.0.0", author: "Vercel Engineering", desc: "16 regels voor React Native/Expo mobile apps", icon: "📱", status: "installed", url: "https://github.com/vercel-labs/agent-skills", devices: ["MM4"] },
  ],
  marketplaces: [
    { id: "official", name: "claude-plugins-official", org: "Anthropic", desc: "Officieel Anthropic plugin repository", icon: "🏛️", status: "connected", url: "https://github.com/anthropics/claude-plugins-official" },
    { id: "thedotmack", name: "thedotmack", org: "Community", desc: "Community plugins (claude-mem, etc.)", icon: "🌍", status: "connected", url: "https://github.com/thedotmack" },
    { id: "vercel-labs", name: "vercel-labs/agent-skills", org: "Vercel", desc: "AI agent skills (React, Design, Native)", icon: "▲", status: "connected", url: "https://github.com/vercel-labs/agent-skills" },
  ],
};


// ==================== GDPR ARTES TAB ====================
// v4.24.0 - Statische GDPR Command Center (geen hooks)
function GDPRArtes() {
  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      
      <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)", borderRadius: 12, padding: 20, marginBottom: 16, border: "2px solid #3b82f6" }}>
        <h2 style={{ margin: 0, color: "#60a5fa", fontSize: 20 }}>GDPR Compliance Command Center</h2>
        <p style={{ margin: "4px 0 0 0", color: "#9ca3af", fontSize: 11 }}>Artes.law - EU Digital Omnibus (19 nov 2024) - Wekelijkse monitoring actief</p>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ background: "#22c55e22", color: "#22c55e", padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600 }}>GPC: 3/3 websites</span>
          <span style={{ background: "#3b82f622", color: "#60a5fa", padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600 }}>Monitoring: Ma 9u</span>
          <span style={{ background: "#f59e0b22", color: "#f59e0b", padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600 }}>Datalek: 96u</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, border: "1px solid #22c55e" }}>
          <div style={{ color: "#22c55e", fontSize: 28, fontWeight: 700, textAlign: "center" }}>3/3</div>
          <div style={{ color: "#9ca3af", fontSize: 11, textAlign: "center" }}>GPC Compliant</div>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, border: "1px solid #3b82f6" }}>
          <div style={{ color: "#3b82f6", fontSize: 28, fontWeight: 700, textAlign: "center" }}>96u</div>
          <div style={{ color: "#9ca3af", fontSize: 11, textAlign: "center" }}>Datalek Termijn</div>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, border: "1px solid #f59e0b" }}>
          <div style={{ color: "#f59e0b", fontSize: 28, fontWeight: 700, textAlign: "center" }}>9</div>
          <div style={{ color: "#9ca3af", fontSize: 11, textAlign: "center" }}>GDPR Wijzigingen</div>
        </div>
      </div>

      <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, marginBottom: 16, border: "1px solid #374151" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#22c55e", fontSize: 14 }}>Website Compliance Status</h3>
        <div style={{ marginBottom: 10, padding: 12, background: "#111827", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ color: "#e5e5e5", fontWeight: 600, fontSize: 13 }}>BlackFuel Whiskey</div>
            <a href="https://github.com/DS2036/BlackFuelWhiskey" target="_blank" rel="noopener noreferrer" style={{ color: "#6b7280", fontSize: 10 }}>DS2036/BlackFuelWhiskey</a>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ background: "#22c55e22", color: "#22c55e", padding: "3px 8px", borderRadius: 4, fontSize: 10 }}>GPC OK</span>
            <span style={{ background: "#22c55e22", color: "#22c55e", padding: "3px 8px", borderRadius: 4, fontSize: 10 }}>Consent OK</span>
          </div>
        </div>
        <div style={{ marginBottom: 10, padding: 12, background: "#111827", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ color: "#e5e5e5", fontWeight: 600, fontSize: 13 }}>IDGS Constructions</div>
            <a href="https://github.com/DS2036/IDGS-Constructions" target="_blank" rel="noopener noreferrer" style={{ color: "#6b7280", fontSize: 10 }}>DS2036/IDGS-Constructions</a>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ background: "#22c55e22", color: "#22c55e", padding: "3px 8px", borderRadius: 4, fontSize: 10 }}>GPC OK</span>
            <span style={{ background: "#22c55e22", color: "#22c55e", padding: "3px 8px", borderRadius: 4, fontSize: 10 }}>Consent OK</span>
          </div>
        </div>
        <div style={{ padding: 12, background: "#111827", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ color: "#e5e5e5", fontWeight: 600, fontSize: 13 }}>Econation</div>
            <span style={{ color: "#f59e0b", fontSize: 10 }}>Geen GitHub repo</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ background: "#22c55e22", color: "#22c55e", padding: "3px 8px", borderRadius: 4, fontSize: 10 }}>GPC OK</span>
            <span style={{ background: "#f59e0b22", color: "#f59e0b", padding: "3px 8px", borderRadius: 4, fontSize: 10 }}>Privacy !</span>
          </div>
        </div>
      </div>

      <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, marginBottom: 16, border: "1px solid #f59e0b" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#f59e0b", fontSize: 14 }}>GDPR Wijzigingen (EU Digital Omnibus)</h3>
        <div style={{ marginBottom: 8, padding: 10, background: "#ef444411", borderRadius: 6, borderLeft: "3px solid #ef4444" }}>
          <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>1. Browser Privacy Signal (GPC)</div>
          <div style={{ color: "#d1d5db", fontSize: 11 }}>Websites MOETEN browser privacy instelling respecteren</div>
          <span style={{ background: "#ef444433", color: "#ef4444", padding: "2px 6px", borderRadius: 3, fontSize: 9 }}>VERPLICHT - NU</span>
        </div>
        <div style={{ marginBottom: 8, padding: 10, background: "#f59e0b11", borderRadius: 6, borderLeft: "3px solid #f59e0b" }}>
          <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>2. Datalek Melding</div>
          <div style={{ color: "#d1d5db", fontSize: 11 }}>72u naar 96u, alleen bij HOOG risico melden aan GBA</div>
        </div>
        <div style={{ marginBottom: 8, padding: 10, background: "#3b82f611", borderRadius: 6, borderLeft: "3px solid #3b82f6" }}>
          <div style={{ color: "#3b82f6", fontSize: 12, fontWeight: 600 }}>3. Artikel 88a/88b AVG (NIEUW)</div>
          <div style={{ color: "#d1d5db", fontSize: 11 }}>Eindapparatuur bescherming verhuist van e-Privacy naar AVG</div>
        </div>
        <div style={{ marginBottom: 8, padding: 10, background: "#8b5cf611", borderRadius: 6, borderLeft: "3px solid #8b5cf6" }}>
          <div style={{ color: "#8b5cf6", fontSize: 12, fontWeight: 600 }}>4. Notie Persoonsgegevens</div>
          <div style={{ color: "#d1d5db", fontSize: 11 }}>Niet redelijkerwijs identificeerbaar = buiten AVG</div>
        </div>
        <div style={{ marginBottom: 8, padding: 10, background: "#22c55e11", borderRadius: 6, borderLeft: "3px solid #22c55e" }}>
          <div style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>5-9. Overige wijzigingen</div>
          <div style={{ color: "#d1d5db", fontSize: 11 }}>Wetenschappelijk onderzoek, Art 9.2, DPIA lijsten, Inzagerecht, Transparantieplicht</div>
        </div>
      </div>

      <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, marginBottom: 16, border: "1px solid #22c55e" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#22c55e", fontSize: 14 }}>Data Act Wijzigingen</h3>
        <div style={{ color: "#d1d5db", fontSize: 11, lineHeight: 1.8 }}>
          1. Bedrijfsgeheimen beter beschermd<br/>
          2. Data delen bedrijven-overheden alleen bij publieke noodzaak<br/>
          3. Art.23 - Makkelijker overstappen cloudproviders<br/>
          4. Art.31 - Lichter regime maatwerk cloud<br/>
          5. Free Flow Non-Personal Data naar Data Act<br/>
          6. European Data Innovation Board
        </div>
      </div>

      <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, marginBottom: 16, border: "1px solid #374151" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#60a5fa", fontSize: 14 }}>Monitoring Bronnen</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a href="https://artes.law" target="_blank" rel="noopener noreferrer" style={{ padding: 10, background: "#111827", borderRadius: 6, textDecoration: "none" }}>
            <div style={{ color: "#60a5fa", fontSize: 12, fontWeight: 600 }}>Artes.law</div>
            <div style={{ color: "#6b7280", fontSize: 10 }}>Belgische juridische updates - primaire bron</div>
          </a>
          <a href="https://edpb.europa.eu/news/news_en" target="_blank" rel="noopener noreferrer" style={{ padding: 10, background: "#111827", borderRadius: 6, textDecoration: "none" }}>
            <div style={{ color: "#60a5fa", fontSize: 12, fontWeight: 600 }}>EDPB</div>
            <div style={{ color: "#6b7280", fontSize: 10 }}>European Data Protection Board</div>
          </a>
          <a href="https://gegevensbeschermingsautoriteit.be" target="_blank" rel="noopener noreferrer" style={{ padding: 10, background: "#111827", borderRadius: 6, textDecoration: "none" }}>
            <div style={{ color: "#60a5fa", fontSize: 12, fontWeight: 600 }}>GBA Belgie</div>
            <div style={{ color: "#6b7280", fontSize: 10 }}>Gegevensbeschermingsautoriteit</div>
          </a>
        </div>
      </div>

      <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, border: "1px solid #ef4444" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#ef4444", fontSize: 14 }}>Scripts en Acties</h3>
        <div style={{ marginBottom: 12, padding: 10, background: "#111827", borderRadius: 6 }}>
          <div style={{ color: "#22c55e", fontSize: 11, fontWeight: 600 }}>Monitoring Script</div>
          <code style={{ color: "#9ca3af", fontSize: 10 }}>~/Projects/GDPR-COMPLIANCE-MODULE/gdpr-monitor.sh</code>
        </div>
        <div style={{ marginBottom: 12, padding: 10, background: "#111827", borderRadius: 6 }}>
          <div style={{ color: "#3b82f6", fontSize: 11, fontWeight: 600 }}>Schedule</div>
          <code style={{ color: "#9ca3af", fontSize: 10 }}>Elke maandag 09:00 (LaunchAgent)</code>
        </div>
        <div style={{ padding: 10, background: "#111827", borderRadius: 6 }}>
          <div style={{ color: "#f59e0b", fontSize: 11, fontWeight: 600 }}>GPC Code voor websites</div>
          <pre style={{ color: "#60a5fa", fontSize: 9, margin: "6px 0 0 0", whiteSpace: "pre-wrap" }}>if (navigator.globalPrivacyControl) return opt-out;</pre>
        </div>
      </div>

    </div>
  );
}


function AllToolsPanel() {
  const { isPhone, S, reducedMotion } = useDevice();
  var _f = useState("all"), filter = _f[0], setFilter = _f[1];
  var _e = useState({ builtin: false, plugins: true, mcpServers: true, skills: true, vercelSkills: true, marketplaces: true }), expanded = _e[0], setExpanded = _e[1];

  function toggle(id) {
    setExpanded(function(prev) {
      var next = {};
      for (var k in prev) next[k] = prev[k];
      next[id] = !prev[id];
      return next;
    });
  }

  var f = {
    title: isPhone ? 20 : 16,
    body: isPhone ? 14 : 12,
    small: isPhone ? 12 : 10,
    micro: isPhone ? 10 : 8,
    input: isPhone ? 16 : 13,
    btnPad: isPhone ? "10px 16px" : "6px 12px",
    cardPad: isPhone ? 14 : 10,
    touchMin: isPhone ? 44 : 28,
    gap: isPhone ? 8 : 6,
    gridMin: isPhone ? 160 : 200,
    bgCard: isPhone ? "#1e1e32" : "#0a0a1a",
    bgCardInner: isPhone ? "#252538" : "#111118",
    bgInput: isPhone ? "#1c1c2a" : "#111",
  };

  var categories = [
    { id: "builtin", label: "Built-in Tools", icon: "🔧", color: "#60a5fa", items: TOOLS_DATA.builtin },
    { id: "plugins", label: "Plugins", icon: "🔌", color: "#a78bfa", items: TOOLS_DATA.plugins },
    { id: "mcpServers", label: "MCP Servers", icon: "🔗", color: "#22c55e", items: TOOLS_DATA.mcpServers },
    { id: "skills", label: "Skills & Commands", icon: "⚡", color: "#f97316", items: TOOLS_DATA.skills },
    { id: "vercelSkills", label: "Vercel Agent Skills", icon: "▲", color: "#00d4ff", items: TOOLS_DATA.vercelSkills },
    { id: "marketplaces", label: "Marketplaces", icon: "🏪", color: "#06b6d4", items: TOOLS_DATA.marketplaces },
  ];

  var totalTools = 0;
  categories.forEach(function(c) { totalTools += c.items.length; });

  var filtered = filter === "all" ? categories : categories.filter(function(c) { return c.id === filter; });

  var statusColors = {
    installed: { bg: "#052e16", color: "#22c55e", label: "INSTALLED", short: "✓" },
    connected: { bg: "#052e16", color: "#22c55e", label: "CONNECTED", short: "●" },
    error: { bg: "#1a0000", color: "#ef4444", label: "ERROR", short: "✗" },
    "not-installed": { bg: "#111", color: "#6b7280", label: "NOT INSTALLED", short: "—" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0a1628, #0f1a2e)", border: "1px solid #1e3a5f", borderRadius: 12, padding: f.cardPad + 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: f.title, fontWeight: 800, color: "#14b8a6" }}>🧰 All Tools</div>
            <div style={{ fontSize: f.small, color: "#6b7280", marginTop: 2 }}>{totalTools} tools actief op dit systeem</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ c: TOOLS_DATA.builtin.length, label: "Built-in", color: "#60a5fa" }, { c: TOOLS_DATA.plugins.length, label: "Plugins", color: "#a78bfa" }, { c: TOOLS_DATA.mcpServers.length, label: "MCP", color: "#22c55e" }, { c: TOOLS_DATA.skills.length + TOOLS_DATA.vercelSkills.length, label: "Skills", color: "#f97316" }].map(function(s, i) {
              return <div key={i} style={{ padding: isPhone ? "6px 10px" : "3px 8px", borderRadius: 6, background: s.color + "15", border: "1px solid " + s.color + "33", fontSize: f.small }}>
                <span style={{ color: s.color, fontWeight: 800 }}>{s.c}</span> <span style={{ color: s.color + "99" }}>{s.label}</span>
              </div>;
            })}
          </div>
        </div>
      </div>

      {/* Filter buttons */}
      <div style={{ display: "flex", gap: f.gap, flexWrap: "wrap" }}>
        {[{ id: "all", label: "Alle", color: "#14b8a6" }].concat(categories.map(function(c) { return { id: c.id, label: c.label, color: c.color }; })).map(function(btn) {
          var active = filter === btn.id;
          return <button key={btn.id} onClick={function() { setFilter(btn.id); }} style={{
            padding: f.btnPad,
            borderRadius: 8,
            border: "1px solid " + (active ? btn.color + "66" : "#2d3748"),
            background: active ? btn.color + "22" : f.bgInput,
            color: active ? btn.color : "#6b7280",
            fontSize: f.small,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: f.touchMin,
          }}>{btn.label}</button>;
        })}
      </div>

      {/* Category sections */}
      {filtered.map(function(cat) {
        var isOpen = expanded[cat.id];
        return <div key={cat.id} style={{ background: f.bgCard, border: "1px solid " + cat.color + "33", borderRadius: 12, overflow: "hidden" }}>
          {/* Section header - clickable */}
          <div role="button" tabIndex="0" aria-label={"Open/sluit " + cat.label} aria-expanded={!!isOpen} onKeyDown={function(e) { if (e.key === "Enter" || e.key === " ") toggle(cat.id); }} onClick={function() { toggle(cat.id); }} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: isPhone ? "14px 16px" : "10px 14px",
            cursor: "pointer", background: cat.color + "0a",
            minHeight: f.touchMin,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: isPhone ? 20 : 16 }}>{cat.icon}</span>
              <span style={{ fontSize: isPhone ? 16 : 14, fontWeight: 700, color: cat.color }}>{cat.label}</span>
              <span style={{ fontSize: f.small, color: "#6b7280" }}>({cat.items.length})</span>
            </div>
            <span style={{ fontSize: isPhone ? 16 : 12, color: "#6b7280" }}>{isOpen ? "▾" : "▸"}</span>
          </div>

          {/* Items grid */}
          {isOpen && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(" + f.gridMin + "px, 1fr))", gap: f.gap, padding: f.cardPad }}>
            {cat.items.map(function(tool) {
              var st = statusColors[tool.status] || statusColors["not-installed"];
              return <div key={tool.id} style={{
                background: f.bgCardInner, border: "1px solid #2d3748", borderRadius: 10,
                padding: f.cardPad, display: "flex", flexDirection: "column", gap: 4,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: isPhone ? 18 : 14, flexShrink: 0 }}>{tool.icon}</span>
                    <span style={{ fontSize: f.body, fontWeight: 700, color: "#e5e5e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tool.name}</span>
                  </div>
                  <span style={{ fontSize: f.micro, padding: "2px 6px", borderRadius: 4, background: st.bg, color: st.color, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>{isPhone ? st.short : st.label}</span>
                </div>
                {tool.version && <div style={{ fontSize: f.micro, color: "#6b7280" }}>{tool.version}{tool.author ? " • " + tool.author : ""}</div>}
                <div style={{ fontSize: f.small, color: "#9ca3af", lineHeight: 1.4 }}>{tool.desc}</div>
                {tool.source && <div style={{ fontSize: f.micro, color: "#4b5563" }}>bron: {tool.source}</div>}
                {tool.devices && <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                  {tool.devices.map(function(d) { return <span key={d} style={{ fontSize: f.micro, padding: "1px 5px", borderRadius: 3, background: "#22c55e15", color: "#4ade80", border: "1px solid #16653433" }}>{d}</span>; })}
                </div>}
                {tool.tools && <div style={{ fontSize: f.micro, color: "#4b5563", marginTop: 2 }}>tools: {tool.tools.join(", ")}</div>}
                {tool.url && <a href={tool.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: f.micro, color: cat.color, textDecoration: "none", marginTop: 2 }}>GitHub →</a>}
              </div>;
            })}
          </div>}
        </div>;
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ECOSYSTEM GRID — Blokken met expandable children (alle niveaus zichtbaar)
// ═══════════════════════════════════════════════════════════════════════════════
function EcoChildItem({ node, depth = 0 }) {
  const [open, setOpen] = useState(false);
  const cs = node.status || STATUS.INFO;
  const has = node.children?.length > 0;
  return (
    <div style={{ marginLeft: depth > 0 ? 12 : 0 }}>
      <div onClick={() => has && setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 6,
        cursor: has ? "pointer" : "default",
        background: cs === STATUS.ERROR ? "#1a000044" : cs === STATUS.WARN ? "#1a140044" : "transparent",
        transition: "background 0.1s"
      }}
        onMouseEnter={e => { if (has) e.currentTarget.style.background = "#ffffff08"; }}
        onMouseLeave={e => { e.currentTarget.style.background = cs === STATUS.ERROR ? "#1a000044" : cs === STATUS.WARN ? "#1a140044" : "transparent"; }}
      >
        {has ? <span style={{ fontSize: 9, color: "#555", width: 10, flexShrink: 0 }}>{open ? "▾" : "▸"}</span> : <span style={{ width: 10, flexShrink: 0 }} />}
        <span style={{ fontSize: 13, flexShrink: 0 }}>{node.icon}</span>
        <span style={{ fontSize: 11, color: "#d1d5db", flex: 1 }}>{node.name}</span>
        <span style={{ fontSize: 9, color: cs.color, flexShrink: 0 }}>{cs.icon}</span>
        {has && <span style={{ fontSize: 9, color: "#6b7280", flexShrink: 0 }}>({node.children.length})</span>}
      </div>
      {node.detail && !has && <div style={{ fontSize: 10, color: "#6b7280", marginLeft: has ? 22 : 22, padding: "0 8px", lineHeight: 1.3 }}>{node.detail}</div>}
      {node.tags && <div style={{ display: "flex", gap: 3, marginLeft: 22, padding: "2px 8px", flexWrap: "wrap" }}>
        {node.tags.map((t, i) => <span key={i} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "#22c55e15", color: "#4ade80", border: "1px solid #16653433" }}>{t}</span>)}
      </div>}
      {node.recommendation && <div style={{ fontSize: 9, color: "#fbbf24", marginLeft: 22, padding: "2px 8px" }}>💡 {node.recommendation}</div>}
      {open && has && (
        <div style={{ borderLeft: "1px solid #454d60", marginLeft: 12, marginTop: 2 }}>
          {node.children.map(c => <EcoChildItem key={c.id} node={c} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

function EcosystemGrid({ search, setSearch }) {
  const { isPhone, S } = useDevice();
  return (
    <>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Zoek in ecosystem..." style={{ width: "100%", padding: isPhone ? "14px 16px" : "10px 14px", borderRadius: 10, border: "1px solid #2d3748", background: "#1e1e30", color: "#e5e5e5", fontSize: isPhone ? 16 : 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(" + (isPhone ? 240 : 280) + "px, 1fr))", gap: 10 }}>
        {ECOSYSTEM.filter(n => {
          if (!search) return true;
          const s = search.toLowerCase();
          const self = (n.name + (n.detail || "")).toLowerCase().includes(s);
          const child = n.children?.some(function chk(c) { return (c.name + (c.detail||"")).toLowerCase().includes(s) || (c.children ? c.children.some(chk) : false); });
          return self || child;
        }).map(n => {
          const s = n.status || STATUS.INFO;
          const allChildren = [];
          function walk(list) { for (const c of list) { allChildren.push(c); if (c.children) walk(c.children); } }
          if (n.children) walk(n.children);
          const okCount = allChildren.filter(c => c.status === STATUS.OK).length;
          const warnCount = allChildren.filter(c => c.status === STATUS.WARN).length;
          const errCount = allChildren.filter(c => c.status === STATUS.ERROR).length;
          return (
            <div key={n.id} style={{ background: "#1a1a2e", border: `1px solid ${s.border}44`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{n.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#e5e5e5" }}>{n.name}</span>
                </div>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600 }}>{s.icon}</span>
              </div>
              {n.detail && <div style={{ fontSize: 11, color: "#888", marginBottom: 6, lineHeight: 1.4 }}>{n.detail}</div>}
              {allChildren.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 10 }}>
                  {okCount > 0 && <span style={{ color: "#4ade80" }}>✓ {okCount}</span>}
                  {warnCount > 0 && <span style={{ color: "#fbbf24" }}>⚠ {warnCount}</span>}
                  {errCount > 0 && <span style={{ color: "#ef4444" }}>✗ {errCount}</span>}
                  <span style={{ color: "#6b7280" }}>({allChildren.length} totaal)</span>
                </div>
              )}
              {n.children && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {n.children.filter(c => {
                    if (!search) return true;
                    const sl = search.toLowerCase();
                    return (c.name + (c.detail||"")).toLowerCase().includes(sl) || (c.children ? c.children.some(function chk(x) { return (x.name + (x.detail||"")).toLowerCase().includes(sl) || (x.children ? x.children.some(chk) : false); }) : false);
                  }).map(c => <EcoChildItem key={c.id} node={c} />)}
                </div>
              )}
              {n.recommendation && <div style={{ fontSize: 10, color: "#fbbf24", marginTop: 6, padding: "3px 6px", borderRadius: 4, background: "#1a1400" }}>💡 {n.recommendation}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function ControlCenter() {
  // Tab state with URL hash support (FIX 5)
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.slice(1);
    return hash && ["ecosystem","issues","memory","git","versions","activity","staging","sync","infranodus","agents","knowledge","updates","openbot","sdkhrm","benchmarks","crypto","revenue","usecases","alltools","advisor"].includes(hash) ? hash : "ecosystem";
  });
  const [search, setSearch] = useState("");

  // FIX 7: useMemo op dure berekeningen (ECOSYSTEM is statisch)
  const counts = useMemo(() => countByStatus(ECOSYSTEM), []);
  const issues = useMemo(() => collectIssues(ECOSYSTEM), []);
  const allItems = useMemo(() => collectAllItems(ECOSYSTEM), []);
  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  // Device auto-detection
  const [currentDevice, setCurrentDevice] = useState(() => detectDevice());
  const [showDeviceSelector, setShowDeviceSelector] = useState(() => needsDeviceSelection());

  // iPhone responsive scaling + reduced motion (FIX 1 + FIX 6)
  const isPhone = currentDevice === 'iPhone';
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const S = useMemo(() => ({
    tabFont: isPhone ? 13 : 10,
    tabPad: isPhone ? "10px 14px 8px" : "6px 10px 4px",
    tabMinWidth: isPhone ? 120 : 100,
    bodyFont: isPhone ? 15 : 13,
    smallFont: isPhone ? 12 : 10,
    microFont: isPhone ? 10 : 8,
    tinyFont: isPhone ? 9 : 7,
    headerFont: isPhone ? 22 : 20,
    inputFont: isPhone ? 16 : 13,
    buttonPad: isPhone ? "12px 18px" : "8px 14px",
    smallButtonPad: isPhone ? "8px 14px" : "6px 10px",
    containerPad: isPhone ? 16 : 12,
    touchMin: isPhone ? 44 : 28,
    gap: isPhone ? 8 : 4,
    cardPad: isPhone ? 14 : 10,
    statusFont: isPhone ? 13 : 11,
    bgBody: isPhone ? "#2a2a44" : "#171724",
    bgCard: isPhone ? "#262640" : "#1a1a2e",
    bgInput: isPhone ? "#222236" : "#1e1e30",
    bgCardInner: isPhone ? "#2d2d46" : "#222238",
    bgFooter: isPhone ? "#2a2a44" : "#1a1a28",
  }), [isPhone]);

  // Log page load
  useEffect(() => {
    logActivity("page_load", `Dashboard opened on ${currentDevice}`, currentDevice);
  }, []);

  // FIX 5: Sync tab state to URL hash
  useEffect(() => { window.location.hash = tab; }, [tab]);
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && hash !== tab) setTab(hash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [tab]);

  // Device selector for manual override
  const setDeviceManually = (device) => {
    localStorage.setItem('ccc-device', device);
    setCurrentDevice(device);
    setShowDeviceSelector(false);
    logActivity("device_set", `Device set to ${device}`, device);
  };

  // Tabs - reorganized for better visibility
  const tabs = [
    { id: "ecosystem", label: "🗺️ Ecosystem", color: "#22c55e", lastUpdated: "8 Feb" },
    { id: "issues", label: "⚠️ Issues", color: "#f59e0b", lastUpdated: "8 Feb" },
    { id: "memory", label: "🧠 Memory", color: "#60a5fa", lastUpdated: "8 Feb" },
    { id: "git", label: "📂 Git", color: "#06b6d4", lastUpdated: "7 Feb" },
    { id: "versions", label: "📸 Versions", color: "#f472b6", lastUpdated: "7 Feb" },
    { id: "activity", label: "📜 Activity", color: "#fbbf24", lastUpdated: "8 Feb" },
    { id: "staging", label: "🌐 Staging", color: "#8b5cf6", lastUpdated: "7 Feb" },
    { id: "sync", label: "🔄 Cross-Sync", color: "#10b981", lastUpdated: "7 Feb" },
    { id: "infranodus", label: "🕸️ InfraNodus", color: "#a855f7", lastUpdated: "8 Feb" },
    { id: "agents", label: "👥 Agents", color: "#f59e0b", lastUpdated: "7 Feb" },
    { id: "knowledge", label: "🧠 Knowledge", color: "#ec4899", lastUpdated: "7 Feb" },
    { id: "updates", label: "📡 Updates", color: "#06b6d4", lastUpdated: "7 Feb" },
    { id: "openbot", label: "🤖 OpenClaw", color: "#7c3aed", lastUpdated: "7 Feb" },
    { id: "sdkhrm", label: "🧠 SDK-HRM", color: "#f97316", lastUpdated: "8 Feb" },
    { id: "benchmarks", label: "📊 Benchmarks", color: "#60a5fa", lastUpdated: "8 Feb" },
    { id: "crypto", label: "🪙 Crypto", color: "#f59e0b", lastUpdated: "7 Feb" },
    { id: "revenue", label: "💰 Revenue", color: "#22c55e", lastUpdated: "7 Feb" },
    { id: "usecases", label: "🎯 Use Cases", color: "#818cf8", lastUpdated: "8 Feb" },
    { id: "alltools", label: "🧰 All Tools", color: "#14b8a6", lastUpdated: "9 Feb" },
    { id: "gdpr", label: "🔒 GDPR Artes", color: "#3b82f6", lastUpdated: "9 Feb" },
    { id: "advisor", label: "🤖 Advisor", color: "#a78bfa", lastUpdated: "8 Feb" },
  ];

  // Device display config
  const devices = [
    { id: "MBA", label: "MBA", icon: "💻" },
    { id: "MM4", label: "MM4", icon: "🖥️" },
    { id: "MM2", label: "MM2", icon: "🖥️" },
    { id: "iPhone", label: "iPhone", icon: "📱" },
  ];

  return (
    <DeviceContext.Provider value={{ isPhone, S, reducedMotion }}>
    <div style={{ fontFamily: "'SF Pro Text', -apple-system, sans-serif", background: S.bgBody, color: "#e5e5e5", minHeight: "100vh", padding: S.containerPad }}>

      {/* Device Selector Modal - Eerste keer op nieuwe desktop */}
      {showDeviceSelector && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#1e1e34", border: "2px solid #5b21b6", borderRadius: 16, padding: 24, maxWidth: 400, textAlign: "center" }} role="dialog" aria-label="Selecteer je apparaat">
            <div style={{ fontSize: 40, marginBottom: 16 }}>🖥️</div>
            <h2 style={{ color: "#a78bfa", margin: "0 0 8px 0", fontSize: 20 }}>Welkom op Cloud Control Center!</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 6 }}>Op welk Mac device ben je nu?</p>
            <p style={{ color: "#22c55e", fontSize: 12, marginBottom: 20 }}>✓ Eenmalig kiezen — wordt voor altijd onthouden</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { id: "MBA", label: "MacBook Air", icon: "💻", color: "#22c55e" },
                { id: "MM4", label: "Mac Mini M4", icon: "🖥️", color: "#60a5fa" },
                { id: "MM2", label: "Mac Mini M2", icon: "🖥️", color: "#a78bfa" },
              ].map(d => (
                <button
                  key={d.id}
                  onClick={() => setDeviceManually(d.id)}
                  aria-label={`Selecteer ${d.label}`}
                  style={{
                    padding: "14px 20px",
                    borderRadius: 10,
                    border: `2px solid ${d.color}`,
                    background: `${d.color}22`,
                    color: d.color,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 100
                  }}
                >
                  <span style={{ fontSize: 24 }}>{d.icon}</span>
                  {d.label}
                </button>
              ))}
            </div>
            <p style={{ color: "#6b7280", fontSize: 11, marginTop: 16 }}>Je kunt dit later wijzigen door op de device knoppen te klikken.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f0f23, #1a0a2e, #0a1628)", border: "1px solid #2d2a5e", borderRadius: 16, padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: S.headerFont, fontWeight: 800, margin: 0, background: "linear-gradient(90deg, #a78bfa, #60a5fa, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Claude Control Center</h1>
            <div style={{ fontSize: S.smallFont, color: "#6b7280", marginTop: 2 }}>DS2036 — Franky | v4.23.0 | {new Date().toLocaleDateString("nl-BE")}</div>
          </div>
          {/* Device indicators - ACTIVE device is GREEN */}
          <nav aria-label="Apparaat selectie" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {devices.map(d => {
              const isActive = currentDevice === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDeviceManually(d.id)}
                  aria-label={isActive ? `Actief op ${d.label}` : `Wissel naar ${d.label}`}
                  aria-pressed={isActive}
                  style={{
                    fontSize: S.smallFont,
                    padding: S.smallButtonPad,
                    borderRadius: 6,
                    background: isActive ? "#22c55e22" : "#454d6022",
                    color: isActive ? "#4ade80" : "#6b7280",
                    border: `1px solid ${isActive ? "#166534" : "#454d60"}`,
                    cursor: "pointer",
                    transition: reducedMotion ? "none" : "background 0.15s, color 0.15s, border-color 0.15s"
                  }}
                >
                  {isActive ? "●" : "◌"} {d.icon} {d.label}
                </button>
              );
            })}
          </nav>
        </div>
        {/* Status Bar */}
        <div style={{ display: "flex", gap: S.gap, marginTop: 10, flexWrap: "wrap" }} role="status" aria-label="Systeem status overzicht">
          {[{ k: "OK", ...STATUS.OK, c: counts.OK }, { k: "WARN", ...STATUS.WARN, c: counts.WARN }, { k: "ERROR", ...STATUS.ERROR, c: counts.ERROR }, { k: "PENDING", ...STATUS.PENDING, c: counts.PENDING }].map(s => (
            <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 4, padding: isPhone ? "6px 12px" : "3px 8px", borderRadius: 6, background: `${s.color}15`, border: `1px solid ${s.color}33`, fontSize: S.statusFont }} aria-label={`${s.c} ${s.k}`}>
              <span style={{ color: s.color, fontWeight: 800 }}>{s.c}</span>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 10, background: "#1a1a2e" }} role="progressbar" aria-label="Status verdeling">
          {[{ c: counts.OK, color: STATUS.OK.color }, { c: counts.WARN, color: STATUS.WARN.color }, { c: counts.ERROR, color: STATUS.ERROR.color }, { c: counts.PENDING, color: STATUS.PENDING.color }].map((s, i) => <div key={i} style={{ width: `${(s.c / total) * 100}%`, background: s.color }} />)}
        </div>
      </div>

      {/* DUMP - Altijd zichtbaar bovenaan */}
      <DumpBar />

      {/* ADVISOR - Prominent bar (always visible) */}
      <AIAdvisor issues={issues} compact={true} onNavigate={setTab} currentDevice={currentDevice} />

      {/* Tabs - Responsive grid layout (wraps instead of scrolling) */}
      <nav aria-label="Dashboard navigatie" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(" + S.tabMinWidth + "px, 1fr))",
        gap: S.gap,
        marginBottom: 12
      }}>
        {tabs.filter(t => t.id !== "advisor").map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); logActivity("tab_switch", `Opened ${t.label}`, currentDevice); }} aria-label={`${t.label} tab`} aria-pressed={tab === t.id} style={{
            padding: S.tabPad,
            borderRadius: 8,
            border: `1px solid ${tab === t.id ? t.color + "66" : "#2d3748"}`,
            background: tab === t.id ? t.color + "22" : S.bgInput,
            color: tab === t.id ? t.color : "#6b7280",
            fontSize: S.tabFont,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            minHeight: S.touchMin
          }}>
            <span>{t.label}</span>
            {t.lastUpdated && <span style={{ fontSize: S.tinyFont, color: tab === t.id ? t.color + "99" : "#454d60", fontWeight: 400 }}>{t.lastUpdated}</span>}
          </button>
        ))}
      </nav>

      {/* Content */}
      {tab === "ecosystem" && <EcosystemGrid search={search} setSearch={setSearch} />}

      {tab === "issues" && <IssuesPanel issues={issues} allItems={allItems} />}

      {tab === "advisor" && <AIAdvisor issues={issues} onNavigate={setTab} currentDevice={currentDevice} />}
      {tab === "memory" && <MemoryCenter />}
      {tab === "git" && <GitDeployCenter />}
      {tab === "versions" && <VersionSnapshots />}
      {tab === "activity" && <ActivityLog />}
      {tab === "staging" && <StagingVariants />}
      {tab === "sync" && <CrossDeviceSync />}
      {tab === "infranodus" && <InfraNodusDashboard />}
      {tab === "agents" && <AgentHierarchy />}
      {tab === "knowledge" && <SystemKnowledgeBase />}
      {tab === "updates" && <ClaudeUpdates />}
      {tab === "openbot" && <OpenClaudeBot />}
      {tab === "sdkhrm" && <SDKHRMHub />}
      {tab === "benchmarks" && <TrainingBenchmarks />}
      {tab === "crypto" && <CryptoIntelligence />}
      {tab === "revenue" && <RevenueIntelligence />}
      {tab === "usecases" && <UseCases />}
      {tab === "alltools" && <AllToolsPanel />}
      {tab === "gdpr" && <GDPRArtes />}

      {/* Footer */}
      <footer style={{ marginTop: 16, padding: S.containerPad, background: S.bgFooter, border: "1px solid #2d3748", borderRadius: 10, textAlign: "center" }}>
        <div style={{ fontSize: S.smallFont, color: "#4b5563" }}>Claude Control Center v4.23.0 • {total} nodes • 21 tabs • Perplexity Intelligence • Device: {currentDevice} • Cloudflare: claude-ecosystem-dashboard.pages.dev</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
          {Object.entries(STATUS).filter(([k]) => k !== "SYNCING").map(([k, s]) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: S.microFont, color: s.color }}><span style={{ fontWeight: 800 }}>{s.icon}</span> {s.label}</div>)}
        </div>
      </footer>
    </div>
    </DeviceContext.Provider>
  );
}

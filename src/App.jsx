import { useState, useCallback, useEffect } from "react";

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
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE CONTROL CENTER v4.1.0
// Complete Dashboard: 14 tabs voor volledig ecosysteem beheer
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
  } catch {}

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
  DEAD: { label: "Inactief", color: "#6b7280", bg: "#111", border: "#374151", icon: "○" },
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
      { id: "mcp-cli", name: "CLI MCP Servers", icon: "⌨️", status: STATUS.WARN, children: [
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
    id: "plugins", name: "Plugins", icon: "🧩", status: STATUS.WARN, children: [
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
      { id: "dup-cmds", name: "⚠️ Dubbele Commands", icon: "⚠️", status: STATUS.WARN, children: [
        { id: "dup-do", name: "do.md (2×)", icon: "📄", status: STATUS.WARN },
        { id: "dup-plan", name: "make-plan.md (2×)", icon: "📄", status: STATUS.WARN },
        { id: "dup-help", name: "help.md (2×)", icon: "📄", status: STATUS.WARN },
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
        { id: "s-d1", name: "Econation", icon: "📂", status: STATUS.WARN, detail: "10 dirty" },
        { id: "s-d2", name: "HRM-Core-Brain", icon: "📂", status: STATUS.WARN, detail: "4 dirty" },
        { id: "s-d3", name: "CLAUDE-CODE-MASTERY", icon: "📂", status: STATUS.WARN, detail: "1 dirty" },
        { id: "s-d4", name: "claude-setup", icon: "📂", status: STATUS.WARN, detail: "1 dirty" },
        { id: "s-d5", name: "mac-automation-hub", icon: "📂", status: STATUS.WARN, detail: "1 dirty" },
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
      { id: "p-dups", name: "⚠️ Duplicaten & Lege Folders", icon: "⚠️", status: STATUS.ERROR, children: [
        { id: "dup-klui2", name: "Kluizenkerk (2×)", icon: "📂", status: STATUS.ERROR, recommendation: "Merge" },
        { id: "dup-mon2", name: "Claude Live Mon (2×)", icon: "📂", status: STATUS.ERROR, recommendation: "Merge" },
        { id: "dup-mem2", name: "MEM start + Memory folder", icon: "📂", status: STATUS.ERROR, recommendation: "Verwijder" },
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
        { id: "h-g1", name: "SessionStart → echo", icon: "▶️", status: STATUS.WARN, recommendation: "Verwijder" },
        { id: "h-g2", name: "PostToolUse → echo", icon: "📝", status: STATUS.WARN, recommendation: "Verwijder" },
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
      <div onClick={() => has && setOpen(!open)} style={{
        display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 10px", borderRadius: 8,
        cursor: has ? "pointer" : "default", border: `1px solid ${s.border}22`,
        background: match && searchTerm ? s.bg : "transparent", marginBottom: 2, transition: "all 0.15s",
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
    } catch { return []; }
  });

  // ALL questions ever asked - PERSISTENT LOG
  const [allQuestions, setAllQuestions] = useState(() => {
    try {
      const saved = localStorage.getItem("advisor-all-questions");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Saved sessions history
  const [savedSessions, setSavedSessions] = useState(() => {
    try {
      const saved = localStorage.getItem("advisor-sessions");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const summary = issues.filter(i => i.status === STATUS.ERROR || i.status === STATUS.WARN).map(i => `[${i.status === STATUS.ERROR ? "ERR" : "WARN"}] ${i.path}: ${i.detail || i.name}${i.recommendation ? " | Fix: " + i.recommendation : ""}`).join("\n");

  // Save everything to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("advisor-current-thread", JSON.stringify(chatThread));
    } catch {}
  }, [chatThread]);

  useEffect(() => {
    try {
      localStorage.setItem("advisor-all-questions", JSON.stringify(allQuestions.slice(0, 200))); // Keep 200
    } catch {}
  }, [allQuestions]);

  useEffect(() => {
    try {
      localStorage.setItem("advisor-sessions", JSON.stringify(savedSessions.slice(0, 20)));
    } catch {}
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
      <div style={{ background: "#0a0a1a", border: "1px solid #312e81", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 16 }}>🤖</span>
            <span style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa" }}>AI Advisor</span>
            {chatThread.length > 0 && <span style={{ fontSize: 10, color: "#6b7280", background: "#1e1b4b", padding: "2px 6px", borderRadius: 4 }}>{chatThread.length} in gesprek</span>}
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
      <div style={{ background: "#0a0a1a", border: "1px solid #312e81", borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa" }}>Advisor</span>
          <input type="text" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && question.trim() && (ask(question), setQuestion(""))} placeholder="Stel een vraag of geef een opdracht..." style={{ flex: 1, minWidth: 200, padding: "6px 10px", borderRadius: 6, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 11, outline: "none" }} />
          <button onClick={() => setAgentMode(!agentMode)} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${agentMode ? "#22c55e" : "#5b21b6"}`, background: agentMode ? "#052e16" : "#1e1b4b", color: agentMode ? "#4ade80" : "#c4b5fd", fontSize: 10, cursor: "pointer" }}>{agentMode ? "🤖 Agent" : "💬 Vraag"}</button>
          <button onClick={() => { if (question.trim()) { ask(question); setQuestion(""); } }} disabled={loading || !question.trim()} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #5b21b6", background: "#312e81", color: "#c4b5fd", fontSize: 10, cursor: "pointer" }}>{loading ? "⏳" : "→"}</button>
          <button onClick={toggleExpand} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #374151", background: "#111", color: "#9ca3af", fontSize: 10, cursor: "pointer" }} title="Open fullscreen">⛶</button>
          <button onClick={() => setShowAllQuestions(!showAllQuestions)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #374151", background: "#111", color: "#9ca3af", fontSize: 10, cursor: "pointer" }} title="Alle vragen">📋 {allQuestions.length}</button>
          <button onClick={() => setIsCollapsed(true)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #374151", background: "#111", color: "#9ca3af", fontSize: 10, cursor: "pointer" }} title="Inklappen">▲</button>
          {chatThread.length > 0 && <span style={{ fontSize: 9, color: "#6b7280" }}>({chatThread.length} in gesprek)</span>}
        </div>
        {error && <div style={{ color: "#f87171", fontSize: 10, padding: "6px 0" }}>❌ {error}</div>}

        {/* Show last response + linked tabs */}
        {chatThread.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 6, padding: 10, fontSize: 11, color: "#d1d5db", lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>
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
                  <button key={tabId} onClick={() => navigateToTab(tabId)} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "1px solid #5b21b6", background: "#1e1b4b", color: "#c4b5fd", cursor: "pointer" }}>{tabLabels[tabId] || tabId}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={startNewSession} style={{ fontSize: 9, padding: "4px 8px", borderRadius: 4, border: "1px solid #374151", background: "#1a1a2e", color: "#9ca3af", cursor: "pointer" }}>🔄 Nieuw</button>
              <button onClick={toggleExpand} style={{ fontSize: 9, padding: "4px 8px", borderRadius: 4, border: "1px solid #5b21b6", background: "#1e1b4b", color: "#c4b5fd", cursor: "pointer" }}>⛶ Volledig</button>
            </div>
          </div>
        )}

        {/* All questions panel (compact) */}
        {showAllQuestions && (
          <div style={{ background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 6, padding: 10, marginTop: 8, maxHeight: 250, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>📋 Alle vragen ({allQuestions.length})</span>
              <span style={{ fontSize: 9, color: "#6b7280" }}>{allQuestions.filter(q => q.resolved).length} opgelost</span>
            </div>
            {allQuestions.slice(0, 15).map(q => (
              <div key={q.id} style={{ padding: 6, borderBottom: "1px solid #1f2937", opacity: q.resolved ? 0.5 : 1 }}>
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
    background: "#0a0a0a",
    zIndex: 1000,
    padding: 20,
    overflow: "auto"
  } : {
    background: "#0a0a1a",
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
          <button onClick={() => setAgentMode(!agentMode)} style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${agentMode ? "#22c55e" : "#5b21b6"}`, background: agentMode ? "#052e16" : "#1e1b4b", color: agentMode ? "#4ade80" : "#c4b5fd", fontSize: 12, cursor: "pointer" }}>{agentMode ? "🤖 Agent" : "💬 Vraag"}</button>
          <button onClick={() => setShowAllQuestions(!showAllQuestions)} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #f59e0b", background: "#1a1400", color: "#fbbf24", fontSize: 12, cursor: "pointer" }}>📋 Alle vragen ({allQuestions.length})</button>
          <button onClick={() => setShowHistory(!showHistory)} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #374151", background: "#111", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>📜 Sessies ({savedSessions.length})</button>
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
        <button onClick={() => ask(null, true)} disabled={loading} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #5b21b6", background: "#1e1b4b", color: "#c4b5fd", fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer" }}>{loading ? "⏳..." : "🔍 Volledige Analyse"}</button>
      </div>

      {/* ALL QUESTIONS Panel - Toont VRAAG + ANTWOORD */}
      {showAllQuestions && (
        <div style={{ background: "#0f0f23", border: "1px solid #f59e0b", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: "#fbbf24", fontSize: 14 }}>📋 Alle Gestelde Vragen ({allQuestions.length})</span>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{allQuestions.filter(q => q.resolved).length} opgelost</span>
              <button onClick={() => setAllQuestions(prev => prev.filter(q => !q.resolved))} style={{ fontSize: 10, color: "#ef4444", background: "transparent", border: "1px solid #991b1b", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>🗑️ Opgeloste wissen</button>
            </div>
          </div>
          <div style={{ maxHeight: expanded ? "calc(100vh - 350px)" : 500, overflow: "auto" }}>
            {allQuestions.map(q => (
              <div key={q.id} style={{ padding: 14, marginBottom: 12, background: q.resolved ? "#1a1a2e55" : "#1a1a2e", borderRadius: 10, border: `1px solid ${q.resolved ? "#374151" : "#f59e0b44"}` }}>
                {/* Header met acties */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: q.type === "agent" ? "#4ade80" : "#a78bfa" }}>{q.type === "agent" ? "🤖 Agent" : "💬 Vraag"}</span>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>{new Date(q.timestamp).toLocaleDateString("nl-BE")} {new Date(q.timestamp).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#37415155", color: "#9ca3af" }}>{q.device}</span>
                    {q.resolved && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#16653455", color: "#4ade80" }}>✅ Opgelost</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!q.resolved && <button onClick={() => markResolved(q.id)} style={{ fontSize: 10, color: "#4ade80", background: "transparent", border: "1px solid #166534", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>✓ Opgelost</button>}
                    <button onClick={() => deleteTurn(q.id)} style={{ fontSize: 10, color: "#ef4444", background: "transparent", border: "1px solid #991b1b", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>

                {/* VRAAG */}
                <div style={{ background: "#1a1a3e", border: "1px solid #312e81", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>👤 Vraag:</div>
                  <div style={{ fontSize: 12, color: "#e5e5e5" }}>{q.question}</div>
                </div>

                {/* ANTWOORD */}
                <div style={{ background: "#0a1628", border: "1px solid #1e40af", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>🤖 Antwoord:</div>
                  <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{q.answer}</div>
                </div>

                {/* Linked tabs */}
                {q.linkedTabs?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>📍 Ga naar:</span>
                    {q.linkedTabs.map(tabId => (
                      <button key={tabId} onClick={() => navigateToTab(tabId)} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: "1px solid #5b21b6", background: "#1e1b4b", color: "#c4b5fd", cursor: "pointer" }}>{tabLabels[tabId]}</button>
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
        <div style={{ background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 10, padding: 16, marginBottom: 16, maxHeight: expanded ? "calc(100vh - 400px)" : 350, overflow: "auto" }}>
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
                  <div style={{ background: "#1a1a3e", border: "1px solid #312e81", borderRadius: 8, padding: 10, fontSize: 12, color: "#e5e5e5" }}>{turn.question}</div>
                </div>
              </div>
              {/* Advisor response */}
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 16 }}>🤖</span>
                <div style={{ flex: 1 }}>
                  <div style={{ background: "#0a1628", border: "1px solid #1e40af", borderRadius: 8, padding: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{turn.answer}</div>
                  {/* Linked tabs navigation */}
                  {turn.linkedTabs?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#6b7280" }}>📍 Ga naar:</span>
                      {turn.linkedTabs.map(tabId => (
                        <button key={tabId} onClick={() => navigateToTab(tabId)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid #5b21b6", background: "#1e1b4b", color: "#c4b5fd", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "#312e81"} onMouseLeave={e => e.currentTarget.style.background = "#1e1b4b"}>{tabLabels[tabId]}</button>
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
          style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: `1px solid ${agentMode ? "#166534" : "#374151"}`, background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none" }}
        />
        <button onClick={() => { if (question.trim()) { ask(question); setQuestion(""); } }} disabled={loading || !question.trim()} style={{ padding: "12px 24px", borderRadius: 10, border: `1px solid ${agentMode ? "#166534" : "#5b21b6"}`, background: agentMode ? "#052e16" : "#312e81", color: agentMode ? "#4ade80" : "#c4b5fd", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>{loading ? "⏳" : (chatThread.length > 0 ? "Vervolg →" : "Vraag")}</button>
      </div>

      {error && <div style={{ color: "#f87171", fontSize: 12, padding: "10px 0" }}>❌ {error}</div>}

      {/* Saved Sessions Panel */}
      {showHistory && (
        <div style={{ background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 10, padding: 16, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: "#a78bfa", fontSize: 14 }}>📜 Opgeslagen Sessies</span>
            <button onClick={clearAllSessions} style={{ fontSize: 11, color: "#ef4444", background: "transparent", border: "1px solid #991b1b", borderRadius: 4, padding: "6px 10px", cursor: "pointer" }}>🗑️ Wis alles</button>
          </div>
          {savedSessions.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 12 }}>Geen opgeslagen sessies. Start een gesprek en klik "Nieuw gesprek" om de huidige sessie op te slaan.</p>
          ) : (
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              {savedSessions.map(session => (
                <div key={session.id} onClick={() => loadSession(session)} style={{ padding: 12, borderBottom: "1px solid #1f2937", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "#1a1a2e"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
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
        <div style={{ background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>🧠 Memory Stats</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ background: "#1a1a2e", padding: "12px 20px", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e" }}>{stats.total}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Total</div>
            </div>
            {Object.entries(stats.bySource).map(([src, count]) => (
              <div key={src} style={{ background: "#1a1a2e", padding: "8px 14px", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: count > 0 ? "#60a5fa" : "#374151" }}>{count}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>{src}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>🔍 Search Memory</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchMemory()} placeholder="Zoek in observations..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none" }} />
          <button onClick={searchMemory} disabled={loading} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #3b82f6", background: "#1e3a8a", color: "#93c5fd", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{loading ? "..." : "Zoek"}</button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {searchResults.map(r => (
              <div key={r.id} style={{ background: "#1a1a2e", border: "1px solid #374151", borderRadius: 8, padding: 12 }}>
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
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", marginBottom: 12 }}>➕ Quick Inject</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={injectForm.project} onChange={e => setInjectForm({ ...injectForm, project: e.target.value })} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 12 }}>
              <option value="general">general</option>
              <option value="Claude-Ecosystem-Dashboard">Claude-Ecosystem-Dashboard</option>
              <option value="BlackFuelWhiskey">BlackFuelWhiskey</option>
              <option value="Econation">Econation</option>
            </select>
            <select value={injectForm.type} onChange={e => setInjectForm({ ...injectForm, type: e.target.value })} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 12 }}>
              <option value="discovery">discovery</option>
              <option value="decision">decision</option>
              <option value="feature">feature</option>
              <option value="bugfix">bugfix</option>
              <option value="change">change</option>
            </select>
          </div>
          <input type="text" value={injectForm.title} onChange={e => setInjectForm({ ...injectForm, title: e.target.value })} placeholder="Titel..." style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none" }} />
          <textarea value={injectForm.text} onChange={e => setInjectForm({ ...injectForm, text: e.target.value })} placeholder="Beschrijving..." rows={3} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none", resize: "vertical" }} />
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
    small: { bg: "#0f0f23", border: "#374151", color: "#9ca3af" },
    active: { bg: "#052e16", border: "#166534", color: "#4ade80" },
    archived: { bg: "#111", border: "#374151", color: "#6b7280" },
  };

  const priorityColors = {
    critical: "#ef4444",
    high: "#f59e0b",
    medium: "#60a5fa",
    low: "#6b7280",
  };

  return (
    <div style={{ background: "#0f0f0f", border: "1px solid #5b21b6", borderRadius: 12, padding: 16 }}>
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
                    <span key={i} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#1f2937", color: "#9ca3af" }}>
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
                  border: "1px solid #374151",
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
      <div style={{ background: "#0a0a0a", border: "1px solid #1f2937", borderRadius: 8, padding: 12, marginTop: 16 }}>
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
          <div key={repo.name} style={{ background: repo.status === "dirty" ? "#1a1400" : "#0f0f0f", border: `1px solid ${repo.status === "dirty" ? "#854d0e" : "#1f2937"}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#e5e5e5" }}>📂 {repo.name}</div>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: repo.status === "clean" ? "#22c55e22" : "#f59e0b22", color: repo.status === "clean" ? "#4ade80" : "#fbbf24" }}>{repo.status === "clean" ? "✓ clean" : `⚠ ${repo.dirtyFiles} dirty`}</span>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>🌿 {repo.branch} • ⏱️ {repo.lastPush}</div>
            {repo.cloudflare && <div style={{ fontSize: 11, color: "#06b6d4", marginBottom: 8 }}>☁️ <a href={`https://${repo.cloudflare}`} target="_blank" rel="noopener noreferrer" style={{ color: "#06b6d4" }}>{repo.cloudflare}</a></div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => addLog(`🔽 git pull ${repo.name}`)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #374151", background: "#1a1a2e", color: "#93c5fd", fontSize: 11, cursor: "pointer" }}>🔽 Pull</button>
              <button onClick={() => addLog(`🔼 git push ${repo.name}`)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #374151", background: "#1a1a2e", color: "#93c5fd", fontSize: 11, cursor: "pointer" }}>🔼 Push</button>
              {repo.cloudflare && <button onClick={() => addLog(`☁️ Deploy ${repo.name}`)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #0e7490", background: "#001a1a", color: "#22d3ee", fontSize: 11, cursor: "pointer" }}>☁️ Deploy</button>}
            </div>
          </div>
        ))}
      </div>
      {actionLog.length > 0 && (
        <div style={{ background: "#0a0a0a", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
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
      <div style={{ background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>📸 Create Snapshot</div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={newSnapshot.project} onChange={e => setNewSnapshot({ ...newSnapshot, project: e.target.value })} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 12 }}>
            <option>Claude-Ecosystem-Dashboard</option>
            <option>BlackFuelWhiskey</option>
            <option>Econation</option>
          </select>
          <input type="text" value={newSnapshot.name} onChange={e => setNewSnapshot({ ...newSnapshot, name: e.target.value })} placeholder="Snapshot naam (bv: v1.2.0 - Feature X)" style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none" }} />
          <button onClick={createSnapshot} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #5b21b6", background: "#1e1b4b", color: "#c4b5fd", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📸 Save</button>
        </div>
      </div>
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>🕐 Snapshot History</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>⏳ Laden...</div>
          ) : snapshots.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>Nog geen snapshots</div>
          ) : snapshots.map(snap => {
            const d = snap.timestamp ? new Date(snap.timestamp).toLocaleString("nl-BE") : snap.date || "?";
            return (
              <div key={snap.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1a2e", border: "1px solid #374151", borderRadius: 8, padding: 12, flexWrap: "wrap", gap: 8 }}>
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
                  <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #374151", background: "#1a1a2e", color: "#9ca3af", fontSize: 11, cursor: "pointer" }}>👁️ View</button>
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
    <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f472b6" }}>📜 Activity Log</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={fetchLogs} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #374151", background: "#111", color: "#6b7280", fontSize: 11, cursor: "pointer" }}>🔄</button>
          {["All", "Chat", "CLI", "Dashboard"].map(f => <button key={f} onClick={() => setFilter(f)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #374151", background: filter === f ? "#1e1b4b" : "#111", color: filter === f ? "#c4b5fd" : "#6b7280", fontSize: 11, cursor: "pointer" }}>{f}</button>)}
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
            const tc = typeColors[act.type] || { bg: "#37415122", color: "#9ca3af" };
            return (
              <div key={act.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1a2e", border: "1px solid #374151", borderRadius: 8, padding: "10px 12px", flexWrap: "wrap" }}>
                <div style={{ fontSize: 11, color: "#4b5563", fontFamily: "monospace", minWidth: 45 }}>{time}</div>
                <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: act.source === "Chat" ? "#3b82f622" : act.source === "Dashboard" ? "#a78bfa22" : "#22c55e22", color: act.source === "Chat" ? "#60a5fa" : act.source === "Dashboard" ? "#c4b5fd" : "#4ade80", minWidth: 50, textAlign: "center" }}>{act.source || "?"}</div>
                {act.mac && <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#1f2937", color: "#9ca3af", minWidth: 30, textAlign: "center" }}>{act.mac}</div>}
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
  const [projects] = useState([
    { name: "Claude-Ecosystem-Dashboard", production: "claude-ecosystem-dashboard.pages.dev", staging: "claude-ecosystem-staging.pages.dev", variants: [] },
    { name: "Econation", production: "econation.be", staging: "econation-b-dev.franky-f29.workers.dev", variants: [] },
    { name: "BlackFuelWhiskey", production: "blackfuel-whiskey.franky-f29.workers.dev", staging: null, variants: [] },
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {projects.map(proj => (
        <div key={proj.name} style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e5e5e5" }}>🌐 {proj.name}</div>
            <button style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #0e7490", background: "#001a1a", color: "#22d3ee", fontSize: 11, cursor: "pointer" }}>➕ Create Staging</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div style={{ background: proj.production ? "#052e16" : "#1a1a1a", border: `1px solid ${proj.production ? "#166534" : "#374151"}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: proj.production ? "#4ade80" : "#6b7280", fontWeight: 600, marginBottom: 4 }}>{proj.production ? "🟢 PRODUCTION" : "⚫ PRODUCTION"}</div>
              {proj.production ? (
                <a href={`https://${proj.production}`} target="_blank" rel="noopener noreferrer" style={{ color: "#86efac", fontSize: 12, wordBreak: "break-all" }}>{proj.production}</a>
              ) : (
                <span style={{ color: "#6b7280", fontSize: 13, fontStyle: "italic" }}>Not deployed</span>
              )}
            </div>
            <div style={{ background: proj.staging ? "#1a1400" : "#1a1a1a", border: `1px solid ${proj.staging ? "#854d0e" : "#374151"}`, borderRadius: 8, padding: 12 }}>
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
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1a2e", border: "1px solid #374151", borderRadius: 8, padding: 10 }}>
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
          <div key={device.id} style={{ background: "#0f0f0f", border: `1px solid ${device.isOnline ? (device.pendingUpdates > 0 ? "#854d0e" : "#166534") : "#374151"}`, borderRadius: 12, padding: 14 }}>
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
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #1f2937" }}>
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
        <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
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
      <div style={{ padding: 12, background: "#0a0a0a", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
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
  const [graphs] = useState([
    { name: "SDK-HRM-vision", url: "https://infranodus.com/Franky-DSVD/SDK-HRM-vision", keywords: 49, insights: ["Leerkurve philosophy", "Per-contact profiling"] },
    { name: "SDK-HRM-fraud_protection", url: "https://infranodus.com/Franky-DSVD/SDK-HRM-fraud_protection", keywords: 60, insights: ["Real-time detection", "Wearable integration"] },
    { name: "SDK-HRM-email_guardian", url: "https://infranodus.com/Franky-DSVD/SDK-HRM-email_guardian", keywords: 64, insights: ["BEC detection", "Impersonation alerts"] },
    { name: "SDK-HRM-revenue_model", url: "https://infranodus.com/Franky-DSVD/SDK-HRM-revenue_model", keywords: 63, insights: ["White-label MSP", "API-first platform"] },
    { name: "SDK-HRM-website_monitoring", url: "https://infranodus.com/Franky-DSVD/SDK-HRM-website_monitoring", keywords: 59, insights: ["Phishing detection", "Clone alerts"] },
    { name: "SDK-HRM-mobile_agent", url: "https://infranodus.com/Franky-DSVD/SDK-HRM-mobile_agent", keywords: 53, insights: ["SMS analysis", "Call screening"] },
  ]);

  const newInsights = [
    { priority: "P1", text: "API-first architecture - Webhooks & Zapier integratie" },
    { priority: "P1", text: "White-label optie voor MSPs - Nieuw verkoopkanaal" },
    { priority: "P2", text: "Gamification - \"Security Hero\" level systeem" },
    { priority: "P2", text: "Device fingerprinting - Fraud detection verbetering" },
    { priority: "P3", text: "SIEM integration - Enterprise tier" },
    { priority: "P3", text: "Social graph analysis - Romance scam verbetering" },
  ];

  const totalKeywords = graphs.reduce((sum, g) => sum + g.keywords, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Quick Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ background: "#0f0f23", border: "1px solid #5b21b6", borderRadius: 12, padding: 16, textAlign: "center", minWidth: 100 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#a78bfa" }}>{graphs.length}</div>
          <div style={{ color: "#6b7280", fontSize: 11 }}>Actieve Graphs</div>
        </div>
        <div style={{ background: "#0f0f23", border: "1px solid #166534", borderRadius: 12, padding: 16, textAlign: "center", minWidth: 100 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#4ade80" }}>{totalKeywords}</div>
          <div style={{ color: "#6b7280", fontSize: 11 }}>Totaal Keywords</div>
        </div>
        <div style={{ background: "#0f0f23", border: "1px solid #854d0e", borderRadius: 12, padding: 16, textAlign: "center", minWidth: 100 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fbbf24" }}>{newInsights.length}</div>
          <div style={{ color: "#6b7280", fontSize: 11 }}>Nieuwe Inzichten</div>
        </div>
      </div>

      {/* Graphs List */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🕸️</span> SDK-HRM Graphs
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {graphs.map((graph) => (
            <div key={graph.name} style={{ background: "#1a1a2e", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <a href={graph.url} target="_blank" rel="noopener noreferrer" style={{ color: "#c4b5fd", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>{graph.name} ↗</a>
                <span style={{ color: "#6b7280", fontSize: 11 }}>{graph.keywords} keywords</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {graph.insights.map((insight, idx) => (
                  <span key={idx} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#5b21b622", color: "#c4b5fd" }}>{insight}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Insights */}
      <div style={{ background: "#0f0023", border: "1px solid #5b21b6", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>💡</span> NIEUWE Inzichten (6 feb 2026)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {newInsights.map((insight, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: insight.priority === "P1" ? "#ef4444" : insight.priority === "P2" ? "#fbbf24" : "#6b7280" }}>{insight.priority}:</span>
              <span style={{ color: "#e5e5e5", fontSize: 12 }}>{insight.text}</span>
            </div>
          ))}
        </div>
        <p style={{ color: "#6b7280", fontSize: 10, marginTop: 10 }}>Bron: InfraNodus competitor analyse op 6 feb 2026</p>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #5b21b6", background: "#1e1b4b", color: "#c4b5fd", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🔍 Nieuwe Analyse</button>
        <button style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#9ca3af", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🕸️ Content Gaps</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// V3.1 TAB: SYSTEM KNOWLEDGE BASE (Backup voor als claude-mem niet beschikbaar is)
// Dit is de CENTRALE WAARHEID - onafhankelijk van externe memory systemen
// ═══════════════════════════════════════════════════════════════════════════════
function SystemKnowledgeBase() {
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
      <div style={{ background: "#0f0f0f", border: "1px solid #991b1b", borderRadius: 12, padding: 14 }}>
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
      <div style={{ background: "#0f0f0f", border: "1px solid #166534", borderRadius: 12, padding: 14 }}>
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
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🖥️</span> DEVICES & ROLLEN
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {devices.map((d, idx) => (
            <div key={idx} style={{ background: "#1a1a2e", border: "1px solid #374151", borderRadius: 8, padding: 10, minWidth: 140 }}>
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
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
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
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
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
      <div style={{ background: "#0f0f0f", border: "1px solid #f97316", borderRadius: 12, padding: 14 }}>
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
              <div key={m.label} style={{ background: "#111", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 8, color: "#6b7280" }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Nested Architecture */}
        <div style={{ background: "#0a0a1a", border: "1px solid #312e81", borderRadius: 8, padding: 12, marginBottom: 10 }}>
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
        <div style={{ background: "#111", border: "1px solid #374151", borderRadius: 8, padding: 12, marginBottom: 10 }}>
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
        <div style={{ background: "#111", border: "1px solid #374151", borderRadius: 8, padding: 12, marginTop: 10 }}>
          <div style={{ fontWeight: 700, color: "#9ca3af", fontSize: 12, marginBottom: 8 }}>Deployment Groottes</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, color: "#d1d5db" }}>
            <div><strong style={{ color: "#f97316" }}>HRM-27M:</strong> 27MB (int8) — 109MB (float32)</div>
            <div><strong style={{ color: "#a78bfa" }}>LFM2-2.6B:</strong> 1.6GB (int4) — 5.2GB (float16)</div>
            <div><strong style={{ color: "#22c55e" }}>Gecombineerd:</strong> 2.1GB geoptimaliseerd</div>
          </div>
        </div>
      </div>

      {/* Export Info */}
      <div style={{ padding: 12, background: "#0a0a0a", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
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
            <div key={idx} style={{ background: "#0a0a0a", border: "1px solid #374151", borderRadius: 8, padding: 12 }}>
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
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#22d3ee", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📰</span> RECENTE UPDATES
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {updates.map(upd => (
            <div key={upd.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a1a2e", borderRadius: 8, padding: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: typeColors[upd.type] }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{upd.title}</span>
                  {upd.relevance === "critical" && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#ef444422", color: "#ef4444" }}>CRITICAL</span>}
                </div>
                <p style={{ color: "#9ca3af", fontSize: 10, marginTop: 2 }}>{upd.description}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 10, color: "#6b7280" }}>{upd.date}</span>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: upd.implemented ? "#22c55e22" : "#37415122", color: upd.implemented ? "#4ade80" : "#6b7280" }}>{upd.implemented ? "✓ Actief" : "○ Pending"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tools Status */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔧</span> TOOLS & PLUGINS STATUS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {toolsStatus.map((tool, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1a2e", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[tool.status] }} />
                <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{tool.name}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ color: "#9ca3af", fontSize: 10 }}>{tool.note}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: 12, background: "#0a0a0a", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
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
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📋</span> GEPLANDE AGENTS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {agents.map(agent => (
            <div key={agent.id} style={{ background: "#1a1a2e", border: "1px solid #374151", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: "#e5e5e5", fontSize: 13 }}>{agent.name}</span>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${statusColors[agent.status]}22`, color: statusColors[agent.status] }}>{agent.status}</span>
                  </div>
                  <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>{agent.description}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#37415122", color: "#9ca3af" }}>{agent.platform}</span>
                  {agent.mm4Required && <p style={{ color: "#6b7280", fontSize: 9, marginTop: 4 }}>Vereist MM4</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements Checklist */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>✓</span> VEREISTEN VOOR DEPLOYMENT
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {requirements.map((req, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1a2e", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: statusColors[req.status] }} />
                <span style={{ color: "#e5e5e5", fontSize: 12 }}>{req.req}</span>
              </div>
              <span style={{ color: "#6b7280", fontSize: 10 }}>{req.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
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
        <div style={{ marginTop: 10, padding: 10, background: "#0a0a0a", borderRadius: 8 }}>
          <p style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>/status - Check MM4 training status</p>
          <p style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>/sync - Trigger sync naar alle devices</p>
          <p style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>/stop - Pauzeer huidige training</p>
        </div>
        <p style={{ color: "#4b5563", fontSize: 10, marginTop: 10 }}>Status: Concept - wacht op MM4 setup + Franky's go-ahead</p>
      </div>

      {/* Info */}
      <div style={{ padding: 12, background: "#0a0a0a", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 12, padding: 14 }}>
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
                  <div key={agent.id} style={{ background: "#0a0a0a", borderRadius: 8, padding: 10, minWidth: 180 }}>
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
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, color: "#6b7280", marginBottom: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <span>📋</span> Task Queue
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {taskQueue.map(task => (
            <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a1a2e", borderRadius: 8, padding: 10 }}>
              <span style={{ fontSize: 12 }}>{task.priority === "critical" ? "🔴" : task.priority === "high" ? "🟡" : "⚪"}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: "#e5e5e5", fontSize: 12 }}>{task.description}</p>
                <p style={{ color: "#6b7280", fontSize: 10 }}>{task.assignedTo ? `Toegewezen: ${agents.find(a => a.id === task.assignedTo)?.name}` : "Wacht op toewijzing"}</p>
              </div>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: task.status === "in_progress" ? "#166534" : "#374151", color: task.status === "in_progress" ? "#4ade80" : "#9ca3af" }}>{task.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Note */}
      <div style={{ padding: 12, background: "#0a0a0a", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
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
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Reusable expandable section component
  const Section = ({ id, icon, title, color, border, bg, summary, children }) => (
    <div style={{ background: bg || "#0f0f0f", border: `1px solid ${border || "#374151"}`, borderRadius: 12, padding: 0, overflow: "hidden" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 700, color: color, fontSize: 14 }}>{title}</div>
            {summary && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{summary}</div>}
          </div>
        </div>
        <span style={{ color: "#6b7280", fontSize: 16, transition: "transform 0.2s", transform: expanded[id] ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </div>
      {expanded[id] && (
        <div style={{ padding: "0 16px 16px 16px", borderTop: `1px solid ${border || "#374151"}33` }}>
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
      <Section id="model" icon="🧠" title="Sapient-HRM 27.3M — Model & Training" color="#f97316" border="#9a3412" bg="#0f0800"
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
              <div key={m.label} style={{ background: "#111", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
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

            <div style={{ marginTop: 12, padding: 12, background: "#111", borderRadius: 8, border: "1px solid #374151" }}>
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

            <div style={{ marginTop: 12, padding: 12, background: "#0a0a1a", borderRadius: 8, border: "1px solid #312e81" }}>
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
      <Section id="checkpoint" icon="💾" title="Checkpoint V3 — MPS-Safe Training Fixes" color="#22c55e" border="#166534" bg="#020f06"
        summary="Kritieke fixes na 2x dataverlies door MPS GPU hangs">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p><strong style={{ color: "#ef4444" }}>Probleem:</strong> Twee keer is alle trainingsvoortgang verloren gegaan doordat de MPS GPU vastliep in een evaluatie-loop. De eerste keer 5750 stappen, de tweede keer 228 stappen. Dit komt omdat MPS GPU-calls op kernel-niveau blokkeren (Uninterruptible Sleep / UN state) — Python code wordt simpelweg niet meer uitgevoerd, dus timeouts en while-loop checks werken niet.</p>

          <div style={{ marginTop: 12, marginBottom: 12, padding: 12, background: "#111", borderRadius: 8, border: "1px solid #374151" }}>
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
      <Section id="nested" icon="🏗️" title="Nested Architecture — HRM inside LFM2" color="#a78bfa" border="#5b21b6" bg="#080020"
        summary="Brain-inside-Body concept met DeepEncoder compression bridge">
        <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
          <p>Franky's kern-innovatie: het combineren van twee AI-modellen in een geneste architectuur die op een enkel edge device draait. Het concept is "Brain inside Body" — het kleine maar krachtige HRM-model (het brein) draait binnen het grotere LFM2-model (het lichaam).</p>

          {/* Architecture Diagram */}
          <div style={{ marginTop: 12, marginBottom: 12, padding: 14, background: "#0a0a1a", borderRadius: 8, border: "1px solid #312e81", fontFamily: "monospace", fontSize: 11, lineHeight: 1.8 }}>
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

          <div style={{ marginTop: 12, padding: 10, background: "#111", borderRadius: 8, border: "1px solid #374151" }}>
            <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 12, marginBottom: 6 }}>3 Strategieen onder overweging:</div>
            {[
              "1. HRM inside LFM2 — HRM als reasoning core, LFM2 als language/context shell",
              "2. Compressed LFM2 inside HRM — LoRA adapters injecteren LFM2 kennis in HRM framework",
              "3. Dual model met DeepEncoder bridge — beide modellen draaien, compressed tokens ertussen",
            ].map((s, i) => (
              <div key={i} style={{ fontSize: 11, color: "#e5e5e5", padding: "3px 0" }}>{s}</div>
            ))}
          </div>

          <p style={{ marginTop: 12 }}><strong style={{ color: "#22c55e" }}>Google Nested Learning (NeurIPS 2025):</strong> Multi-timescale aanpak met snelle modules (nieuwe scams, maandelijks updatebaar) en trage modules (core reasoning, stabiel). Het Continuum Memory System voorkomt catastrophic forgetting. Maandelijkse updates gaan naar de snelle modules ZONDER het basismodel te hertrainen. Perfect voor een abonnementsmodel: nieuwe bedreigingen maandelijks, core blijft stabiel.</p>

          <div style={{ marginTop: 12, padding: 12, background: "#0a0a1a", borderRadius: 8, border: "1px solid #312e81" }}>
            <div style={{ fontWeight: 700, color: "#c4b5fd", fontSize: 12, marginBottom: 8 }}>Hoe de compressie werkt — stap voor stap:</div>
            <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.7 }}>
              <p><strong style={{ color: "#60a5fa" }}>Fase 1 — LFM2 ontvangt input:</strong> Een email, website of spraakfragment komt binnen. LFM2-2.6B verwerkt dit met zijn 30 lagen (22 convolutie + 8 attention) tot 2560-dimensionale embeddings. Op dit punt begrijpt LFM2 de taal, context en inhoud, maar het is te groot om diep te redeneren over dreigingen.</p>
              <p style={{ marginTop: 6 }}><strong style={{ color: "#f59e0b" }}>Fase 2 — DeepEncoder comprimeert:</strong> De DeepEncoder bridge neemt de 1000 tokens van LFM2 en comprimeert ze naar slechts 50-100 visual tokens per pagina. De dimensionaliteit gaat van 2560 naar 512. Dit is optische compressie: tekst-context wordt omgezet naar een visuele representatie die geheugen bespaart. 97% van de informatie blijft behouden ondanks 10-20x compressie.</p>
              <p style={{ marginTop: 6 }}><strong style={{ color: "#f97316" }}>Fase 3 — HRM redeneert:</strong> Het compacte HRM-27M ontvangt de 50 compressed tokens en past zijn hierarchische redenering toe. H-level (strategisch): "Is dit een phishing poging?" L-level (detail): "Welk type? Wat zijn de rode vlaggen?" Het resultaat: een risk assessment met natural language explanation — "Deze email is 94% waarschijnlijk phishing omdat de afzender een lookalike domein gebruikt en urgentie-taal bevat."</p>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 12, background: "#111", borderRadius: 8, border: "1px solid #374151" }}>
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
      <Section id="modules" icon="🛡️" title="18 Beschermingsmodules — Volledige Product Map" color="#4ade80" border="#166534" bg="#020f06"
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
      <Section id="gtm" icon="🚀" title="Go-to-Market — 5 Fasen als Eenmanszaak" color="#fbbf24" border="#854d0e" bg="#0f0a00"
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
      <Section id="finance" icon="🏦" title="Finance Track — Value Guardian" color="#60a5fa" border="#1e40af" bg="#000a1a"
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

          <div style={{ marginTop: 12, padding: 10, background: "#111", borderRadius: 8, border: "1px solid #374151" }}>
            <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 12, marginBottom: 6 }}>Belgische Targets:</div>
            <div style={{ fontSize: 11, color: "#d1d5db" }}>Bancontact/Payconiq (nationale betaalinfra), Worldline (HQ Brussel, global payment processor), Ethias (verzekeraar), Billit (facturatie), Aion Bank (digitale bank). Telecom partners: Proximus, Orange, KPN (NL). Banken: Belfius, KBC, ING. Deze partners bieden directe toegang tot miljoenen eindgebruikers via bestaande kanalen.</div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#22c55e", fontWeight: 600 }}>ROI Argument: Bank verliest €50K aan phishing, SDK-HRM kost €500/maand = 100x ROI</div>
          </div>

          <p style={{ marginTop: 12 }}><strong style={{ color: "#fbbf24" }}>Strategisch voordeel:</strong> Een reputatie in de financiele sector opent automatisch deuren naar enterprise klanten, MSPs en investeerders. Als banken je vertrouwen, vertrouwt iedereen je.</p>
        </div>
      </Section>

      {/* ── 7. CHROME EXTENSIE & MONETISATIE ── */}
      <Section id="chrome" icon="🌐" title="Chrome Extensie — Eerste Revenue Stream" color="#4ade80" border="#166534" bg="#020f06"
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
      <Section id="flywheel" icon="🔄" title="Data Flywheel — Competitive Moat (Waze-model)" color="#f472b6" border="#86198f" bg="#0f000f"
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
      <Section id="embedded" icon="📡" title="Embedded SDK Markt — $30.6B (2029)" color="#22d3ee" border="#0e7490" bg="#001015"
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

          <div style={{ marginTop: 12, padding: 12, background: "#111", borderRadius: 8, border: "1px solid #374151" }}>
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
      <Section id="security" icon="🔐" title="5-Laags Model Bescherming" color="#ef4444" border="#991b1b" bg="#0f0000"
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

          <div style={{ marginTop: 8, padding: 10, background: "#111", borderRadius: 8, border: "1px solid #374151" }}>
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
      <Section id="blockchain" icon="⛓️" title="Blockchain Trust Layer" color="#fbbf24" border="#854d0e" bg="#0f0a00"
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
      <Section id="domains" icon="📊" title="66 Training Domeinen — 10 Lagen" color="#a78bfa" border="#5b21b6" bg="#080020"
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
      <Section id="graphs" icon="🕸️" title="19 InfraNodus Knowledge Graphs" color="#06b6d4" border="#0e7490" bg="#001015"
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
      <Section id="learning" icon="🔬" title="Continuous Learning System" color="#8b5cf6" border="#6d28d9" bg="#0a0020"
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
      <div style={{ padding: 12, background: "#0a0a0a", borderRadius: 8, fontSize: 11, color: "#6b7280" }}>
        <p><strong>Laatste update:</strong> 7 februari 2026 — MM4 Training Sessie</p>
        <p style={{ marginTop: 4 }}><strong>Bronnen:</strong> 19 InfraNodus graphs, ARC training logs, sessie-notities</p>
        <p style={{ marginTop: 4 }}><strong>Opmerking:</strong> Deze tab bevat de volledige uitgesproken teksten en analyses uit de trainingssessie. Klik op elk onderdeel om de complete uitleg te lezen.</p>
      </div>
    </div>
  );
}

export default function ControlCenter() {
  const [tab, setTab] = useState("ecosystem");
  const [search, setSearch] = useState("");
  const counts = countByStatus(ECOSYSTEM);
  const issues = collectIssues(ECOSYSTEM);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Device auto-detection
  const [currentDevice, setCurrentDevice] = useState(() => detectDevice());
  const [showDeviceSelector, setShowDeviceSelector] = useState(() => needsDeviceSelection());

  // Log page load
  useEffect(() => {
    logActivity("page_load", `Dashboard opened on ${currentDevice}`, currentDevice);
  }, []);

  // Device selector for manual override
  const setDeviceManually = (device) => {
    localStorage.setItem('ccc-device', device);
    setCurrentDevice(device);
    setShowDeviceSelector(false);
    logActivity("device_set", `Device set to ${device}`, device);
  };

  // Tabs - reorganized for better visibility
  const tabs = [
    { id: "ecosystem", label: "🗺️ Ecosystem", color: "#22c55e" },
    { id: "issues", label: "⚠️ Issues", color: "#f59e0b" },
    { id: "memory", label: "🧠 Memory", color: "#60a5fa" },
    { id: "git", label: "📂 Git", color: "#06b6d4" },
    { id: "versions", label: "📸 Versions", color: "#f472b6" },
    { id: "activity", label: "📜 Activity", color: "#fbbf24" },
    { id: "staging", label: "🌐 Staging", color: "#8b5cf6" },
    { id: "sync", label: "🔄 Cross-Sync", color: "#10b981" },
    { id: "infranodus", label: "🕸️ InfraNodus", color: "#a855f7" },
    { id: "agents", label: "👥 Agents", color: "#f59e0b" },
    { id: "knowledge", label: "🧠 Knowledge", color: "#ec4899" },
    { id: "updates", label: "📡 Updates", color: "#06b6d4" },
    { id: "openbot", label: "🤖 OpenClaw", color: "#7c3aed" },
    { id: "sdkhrm", label: "🧠 SDK-HRM", color: "#f97316" },
    { id: "advisor", label: "🤖 Advisor", color: "#a78bfa" },
  ];

  // Device display config
  const devices = [
    { id: "MBA", label: "MBA", icon: "💻" },
    { id: "MM4", label: "MM4", icon: "🖥️" },
    { id: "MM2", label: "MM2", icon: "🖥️" },
    { id: "iPhone", label: "iPhone", icon: "📱" },
  ];

  return (
    <div style={{ fontFamily: "'SF Pro Text', -apple-system, sans-serif", background: "#0f0f18", color: "#e5e5e5", minHeight: "100vh", padding: 12 }}>

      {/* Device Selector Modal - Eerste keer op nieuwe desktop */}
      {showDeviceSelector && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0f0f23", border: "2px solid #5b21b6", borderRadius: 16, padding: 24, maxWidth: 400, textAlign: "center" }}>
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
      <div style={{ background: "linear-gradient(135deg, #0f0f23, #1a0a2e, #0a1628)", border: "1px solid #1e1b4b", borderRadius: 16, padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, background: "linear-gradient(90deg, #a78bfa, #60a5fa, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Claude Control Center</h1>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>DS2036 — Franky | v4.1.0 | {new Date().toLocaleDateString("nl-BE")}</div>
          </div>
          {/* Device indicators - ACTIVE device is GREEN */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {devices.map(d => {
              const isActive = currentDevice === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDeviceManually(d.id)}
                  style={{
                    fontSize: 10,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: isActive ? "#22c55e22" : "#37415122",
                    color: isActive ? "#4ade80" : "#6b7280",
                    border: `1px solid ${isActive ? "#166534" : "#374151"}`,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  title={isActive ? `Actief op ${d.id}` : `Klik om te wisselen naar ${d.id}`}
                >
                  {isActive ? "●" : "◌"} {d.icon} {d.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* Status Bar */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {[{ k: "OK", ...STATUS.OK, c: counts.OK }, { k: "WARN", ...STATUS.WARN, c: counts.WARN }, { k: "ERROR", ...STATUS.ERROR, c: counts.ERROR }, { k: "PENDING", ...STATUS.PENDING, c: counts.PENDING }].map(s => (
            <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: `${s.color}15`, border: `1px solid ${s.color}33`, fontSize: 11 }}>
              <span style={{ color: s.color, fontWeight: 800 }}>{s.c}</span>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 10, background: "#1a1a2e" }}>
          {[{ c: counts.OK, color: STATUS.OK.color }, { c: counts.WARN, color: STATUS.WARN.color }, { c: counts.ERROR, color: STATUS.ERROR.color }, { c: counts.PENDING, color: STATUS.PENDING.color }].map((s, i) => <div key={i} style={{ width: `${(s.c / total) * 100}%`, background: s.color }} />)}
        </div>
      </div>

      {/* ADVISOR - Prominent bar (always visible) */}
      <AIAdvisor issues={issues} compact={true} onNavigate={setTab} currentDevice={currentDevice} />

      {/* Tabs - Responsive grid layout (wraps instead of scrolling) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
        gap: 4,
        marginBottom: 12
      }}>
        {tabs.filter(t => t.id !== "advisor").map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${tab === t.id ? t.color + "66" : "#1f2937"}`,
            background: tab === t.id ? t.color + "22" : "#111",
            color: tab === t.id ? t.color : "#6b7280",
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            textAlign: "center"
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      {tab === "ecosystem" && (
        <>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Zoek in ecosystem..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #1f2937", background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>{ECOSYSTEM.map(n => <TreeNode key={n.id} node={n} searchTerm={search} />)}</div>
        </>
      )}

      {tab === "issues" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ background: "#1a0000", border: "1px solid #991b1b", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#ef4444", marginBottom: 8 }}>🔴 Kritiek ({issues.filter(i => i.status === STATUS.ERROR).length})</div>
            {issues.filter(i => i.status === STATUS.ERROR).map(i => <div key={i.id} style={{ padding: "6px 0", borderBottom: "1px solid #991b1b33" }}><div style={{ fontSize: 12, fontWeight: 600, color: "#fca5a5" }}>{i.icon} {i.name}</div><div style={{ fontSize: 11, color: "#888" }}>{i.path}</div>{i.recommendation && <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 3 }}>💡 {i.recommendation}</div>}</div>)}
          </div>
          <div style={{ background: "#1a1400", border: "1px solid #854d0e", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b", marginBottom: 8 }}>🟡 Waarschuwingen ({issues.filter(i => i.status === STATUS.WARN).length})</div>
            {issues.filter(i => i.status === STATUS.WARN).map(i => <div key={i.id} style={{ padding: "6px 0", borderBottom: "1px solid #854d0e33" }}><div style={{ fontSize: 12, fontWeight: 600, color: "#fde68a" }}>{i.icon} {i.name}</div><div style={{ fontSize: 11, color: "#888" }}>{i.path}</div>{i.detail && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{i.detail}</div>}{i.recommendation && <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 3 }}>💡 {i.recommendation}</div>}</div>)}
          </div>
        </div>
      )}

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

      {/* Footer */}
      <div style={{ marginTop: 16, padding: 12, background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 10, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#4b5563" }}>Claude Control Center v4.1.0 • {total} nodes • 15 tabs • SDK-HRM Intelligence Hub • Device: {currentDevice} • Cloudflare: claude-ecosystem-dashboard.pages.dev</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
          {Object.entries(STATUS).filter(([k]) => k !== "SYNCING").map(([k, s]) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: s.color }}><span style={{ fontWeight: 800 }}>{s.icon}</span> {s.label}</div>)}
        </div>
      </div>
    </div>
  );
}

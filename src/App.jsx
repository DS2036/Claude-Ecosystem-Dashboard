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
// CLAUDE CONTROL CENTER v3.0 - MERGED (v1 Ecosystem + v2 Features)
// Complete Dashboard: Ecosystem Map + Memory + Git + Deploy + Versions + Activity + Staging
// ═══════════════════════════════════════════════════════════════════════════════

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
// V1 COMPONENT: AI ADVISOR
// ═══════════════════════════════════════════════════════════════════════════════
function AIAdvisor({ issues }) {
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [question, setQuestion] = useState("");
  const summary = issues.filter(i => i.status === STATUS.ERROR || i.status === STATUS.WARN).map(i => `[${i.status === STATUS.ERROR ? "ERR" : "WARN"}] ${i.path}: ${i.detail || i.name}${i.recommendation ? " | Fix: " + i.recommendation : ""}`).join("\n");
  
  const ask = useCallback(async (q) => {
    setLoading(true); setError(null);
    try {
      const prompt = q ? `Expert Claude ecosystem advisor. Issues:\n${summary}\nVraag: ${q}\nNederlands, kort, actionable.` : `Expert Claude ecosystem advisor. Issues:\n${summary}\nGeef: 1) TOP 5 acties NU 2) Lange termijn 3) Risico's. Nederlands, kort.`;
      const r = await api.askAI([{ role: "user", content: prompt }]);
      if (!r) throw new Error("Geen verbinding met AI backend");
      if (r.error) throw new Error(r.error?.message || "API fout");
      setAdvice(r.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "Geen antwoord.");
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [summary]);

  return (
    <div style={{ background: "#0a0a1a", border: "1px solid #312e81", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🤖</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#a78bfa" }}>AI Ecosystem Advisor</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => ask(null)} disabled={loading} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #5b21b6", background: "#1e1b4b", color: "#c4b5fd", fontSize: 12, fontWeight: 600, cursor: loading ? "wait" : "pointer" }}>{loading ? "⏳..." : "🔍 Analyse"}</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input type="text" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && question.trim() && (ask(question), setQuestion(""))} placeholder="Stel een vraag..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 12, outline: "none" }} />
        <button onClick={() => { if (question.trim()) { ask(question); setQuestion(""); } }} disabled={loading || !question.trim()} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #5b21b6", background: "#312e81", color: "#c4b5fd", fontSize: 12, cursor: "pointer" }}>Vraag</button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, padding: 8 }}>❌ {error}</div>}
      {advice && <div style={{ background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 8, padding: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto" }}>{advice}</div>}
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
export default function ControlCenter() {
  const [tab, setTab] = useState("ecosystem");
  const [search, setSearch] = useState("");
  const counts = countByStatus(ECOSYSTEM);
  const issues = collectIssues(ECOSYSTEM);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const tabs = [
    { id: "ecosystem", label: "🗺️ Ecosystem", color: "#22c55e" },
    { id: "issues", label: "⚠️ Issues", color: "#f59e0b" },
    { id: "advisor", label: "🤖 Advisor", color: "#a78bfa" },
    { id: "memory", label: "🧠 Memory", color: "#60a5fa" },
    { id: "git", label: "📂 Git", color: "#06b6d4" },
    { id: "versions", label: "📸 Versions", color: "#f472b6" },
    { id: "activity", label: "📜 Activity", color: "#fbbf24" },
    { id: "staging", label: "🌐 Staging", color: "#8b5cf6" },
  ];

  return (
    <div style={{ fontFamily: "'SF Pro Text', -apple-system, sans-serif", background: "#0a0a0a", color: "#e5e5e5", minHeight: "100vh", padding: 12 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f0f23, #1a0a2e, #0a1628)", border: "1px solid #1e1b4b", borderRadius: 16, padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, background: "linear-gradient(90deg, #a78bfa, #60a5fa, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Claude Control Center</h1>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>DS2036 — Franky | v3.0 Merged | {new Date().toLocaleDateString("nl-BE")}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "#22c55e22", color: "#4ade80", border: "1px solid #166534" }}>● MBA</span>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "#a78bfa22", color: "#c4b5fd", border: "1px solid #5b21b6" }}>◌ MM4</span>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "#a78bfa22", color: "#c4b5fd", border: "1px solid #5b21b6" }}>◌ MM2</span>
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

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 12px", borderRadius: 8, minWidth: 80, border: `1px solid ${tab === t.id ? t.color + "66" : "#1f2937"}`, background: tab === t.id ? t.color + "22" : "#111", color: tab === t.id ? t.color : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{t.label}</button>
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

      {tab === "advisor" && <AIAdvisor issues={issues} />}
      {tab === "memory" && <MemoryCenter />}
      {tab === "git" && <GitDeployCenter />}
      {tab === "versions" && <VersionSnapshots />}
      {tab === "activity" && <ActivityLog />}
      {tab === "staging" && <StagingVariants />}

      {/* Footer */}
      <div style={{ marginTop: 16, padding: 12, background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 10, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#4b5563" }}>Claude Control Center v3.0 • {total} nodes • 40 memories • Syncthing: 1/3 Macs • Last deploy: just now</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
          {Object.entries(STATUS).filter(([k]) => k !== "SYNCING").map(([k, s]) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: s.color }}><span style={{ fontWeight: 800 }}>{s.icon}</span> {s.label}</div>)}
        </div>
      </div>
    </div>
  );
}

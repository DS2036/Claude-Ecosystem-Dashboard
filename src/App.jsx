import { useState, useCallback, useEffect, useRef } from "react";

// ─── STATUS DEFINITIONS ───
const STATUS = {
  OK: { label: "OK", color: "#22c55e", bg: "#052e16", border: "#166534", icon: "●" },
  WARN: { label: "Waarschuwing", color: "#f59e0b", bg: "#1a1400", border: "#854d0e", icon: "▲" },
  ERROR: { label: "Probleem", color: "#ef4444", bg: "#1a0000", border: "#991b1b", icon: "✖" },
  INFO: { label: "Info", color: "#60a5fa", bg: "#001a33", border: "#1e40af", icon: "ℹ" },
  PENDING: { label: "Wachtend", color: "#a78bfa", bg: "#0f0033", border: "#5b21b6", icon: "◌" },
  DEAD: { label: "Inactief", color: "#6b7280", bg: "#111", border: "#374151", icon: "○" },
};

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
      { id: "claude-code", name: "Claude Code CLI v2.1.19", icon: "⌨️", status: STATUS.OK, children: [
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
        { id: "cm-worker", name: "Worker Service", icon: "⚙️", status: STATUS.OK, tags: ["PID:5755"] },
        { id: "cm-db", name: "SQLite DB", icon: "🗄️", status: STATUS.OK, detail: "29 observations, 561KB" },
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
      { id: "s-scripts", name: "Setup Scripts", icon: "📜", status: STATUS.OK },
    ],
  },
  {
    id: "projects", name: "Projects (40)", icon: "📂", status: STATUS.WARN, children: [
      { id: "p-active", name: "Actieve Projecten", icon: "🟢", status: STATUS.OK, children: [
        { id: "p-eco", name: "Econation", icon: "♻️", status: STATUS.WARN, detail: "10 dirty files", tags: ["CLAUDE.md","Git","Brain"] },
        { id: "p-bfw", name: "BlackFuelWhiskey", icon: "🥃", status: STATUS.OK, tags: ["CLAUDE.md","Git","Brain"] },
        { id: "p-hrm", name: "HRM-Core-Brain", icon: "🧠", status: STATUS.WARN, detail: "4 dirty, geen CLAUDE.md" },
        { id: "p-klui", name: "Kluizenkerk Lier", icon: "⛪", status: STATUS.WARN, detail: "DUPLICATE folders" },
        { id: "p-clawdbot", name: "ClawdBot Rewind", icon: "🤖", status: STATUS.OK, tags: ["Git","Brain"] },
        { id: "p-idgs", name: "IDGS-Constructions", icon: "🏗️", status: STATUS.OK },
        { id: "p-beau", name: "beaufuel-platform", icon: "⛽", status: STATUS.OK },
        { id: "p-sapi", name: "Sapienthinc-HRM-SDK-1", icon: "📦", status: STATUS.OK },
        { id: "p-dbo", name: "DEEP BLUE OCEAN", icon: "🌊", status: STATUS.OK },
        { id: "p-solar", name: "Solar-Sales-App", icon: "☀️", status: STATUS.OK },
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
];

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
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
      if (!r.ok) throw new Error(`API ${r.status}`);
      const d = await r.json();
      setAdvice(d.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "Geen antwoord.");
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
        <input type="text" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && question.trim() && ask(question)} placeholder="Stel een vraag..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 12, outline: "none" }} />
        <button onClick={() => question.trim() && ask(question)} disabled={loading || !question.trim()} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #5b21b6", background: "#312e81", color: "#c4b5fd", fontSize: 12, cursor: "pointer" }}>Vraag</button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, padding: 8 }}>❌ {error}</div>}
      {advice && <div style={{ background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 8, padding: 12, fontSize: 12, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto" }}>{advice}</div>}
    </div>
  );
}

export default function EcosystemDashboard() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("tree");
  const counts = countByStatus(ECOSYSTEM);
  const issues = collectIssues(ECOSYSTEM);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ fontFamily: "'SF Pro Text', -apple-system, sans-serif", background: "#0a0a0a", color: "#e5e5e5", minHeight: "100vh", padding: 12 }}>
      <div style={{ background: "linear-gradient(135deg, #0f0f23, #1a0a2e, #0a1628)", border: "1px solid #1e1b4b", borderRadius: 16, padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, background: "linear-gradient(90deg, #a78bfa, #60a5fa, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Claude Ecosystem Dashboard</h1>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>DS2036 — Franky | {new Date().toLocaleDateString("nl-BE")}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ k: "OK", ...STATUS.OK, c: counts.OK }, { k: "WARN", ...STATUS.WARN, c: counts.WARN }, { k: "ERROR", ...STATUS.ERROR, c: counts.ERROR }, { k: "PENDING", ...STATUS.PENDING, c: counts.PENDING }, { k: "DEAD", ...STATUS.DEAD, c: counts.DEAD }].map(s => (
              <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: `${s.color}15`, border: `1px solid ${s.color}33`, fontSize: 11 }}>
                <span style={{ color: s.color, fontWeight: 800 }}>{s.c}</span>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 10, background: "#1a1a2e" }}>
          {[{ c: counts.OK, color: STATUS.OK.color }, { c: counts.WARN, color: STATUS.WARN.color }, { c: counts.ERROR, color: STATUS.ERROR.color }, { c: counts.PENDING, color: STATUS.PENDING.color }, { c: counts.DEAD, color: STATUS.DEAD.color }].map((s, i) => <div key={i} style={{ width: `${(s.c / total) * 100}%`, background: s.color }} />)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {[{ id: "tree", l: "🗺️ Mind Map" }, { id: "issues", l: "⚠️ Issues" }, { id: "advisor", l: "🤖 AI Advisor" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${tab === t.id ? "#5b21b6" : "#1f2937"}`, background: tab === t.id ? "#1e1b4b" : "#111", color: tab === t.id ? "#c4b5fd" : "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t.l}</button>
        ))}
      </div>

      {tab === "tree" && <>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Zoek..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #1f2937", background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
        <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>{ECOSYSTEM.map(n => <TreeNode key={n.id} node={n} searchTerm={search} />)}</div>
      </>}

      {tab === "issues" && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ background: "#1a0000", border: "1px solid #991b1b", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#ef4444", marginBottom: 8 }}>🔴 Kritiek ({issues.filter(i => i.status === STATUS.ERROR).length})</div>
          {issues.filter(i => i.status === STATUS.ERROR).map(i => <div key={i.id} style={{ padding: "6px 0", borderBottom: "1px solid #991b1b33" }}><div style={{ fontSize: 12, fontWeight: 600, color: "#fca5a5" }}>{i.icon} {i.name}</div><div style={{ fontSize: 11, color: "#888" }}>{i.path}</div>{i.recommendation && <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 3 }}>💡 {i.recommendation}</div>}</div>)}
        </div>
        <div style={{ background: "#1a1400", border: "1px solid #854d0e", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b", marginBottom: 8 }}>🟡 Waarschuwingen ({issues.filter(i => i.status === STATUS.WARN).length})</div>
          {issues.filter(i => i.status === STATUS.WARN).map(i => <div key={i.id} style={{ padding: "6px 0", borderBottom: "1px solid #854d0e33" }}><div style={{ fontSize: 12, fontWeight: 600, color: "#fde68a" }}>{i.icon} {i.name}</div><div style={{ fontSize: 11, color: "#888" }}>{i.path}</div>{i.detail && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{i.detail}</div>}{i.recommendation && <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 3 }}>💡 {i.recommendation}</div>}</div>)}
        </div>
      </div>}

      {tab === "advisor" && <AIAdvisor issues={issues} />}

      <div style={{ marginTop: 12, padding: 10, background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 10, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {Object.entries(STATUS).map(([k, s]) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: s.color }}><span style={{ fontWeight: 800 }}>{s.icon}</span> {s.label}</div>)}
      </div>
    </div>
  );
}

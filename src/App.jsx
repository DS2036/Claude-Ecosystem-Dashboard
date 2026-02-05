import { useState, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE CONTROL CENTER v2.0
// Dashboard + Memory + Git + Deploy + Versioning + Activity Log
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS = {
  OK: { label: "OK", color: "#22c55e", bg: "#052e16", border: "#166534", icon: "●" },
  WARN: { label: "Waarschuwing", color: "#f59e0b", bg: "#1a1400", border: "#854d0e", icon: "▲" },
  ERROR: { label: "Probleem", color: "#ef4444", bg: "#1a0000", border: "#991b1b", icon: "✖" },
  INFO: { label: "Info", color: "#60a5fa", bg: "#001a33", border: "#1e40af", icon: "ℹ" },
  PENDING: { label: "Wachtend", color: "#a78bfa", bg: "#0f0033", border: "#5b21b6", icon: "◌" },
  SYNCING: { label: "Syncing", color: "#06b6d4", bg: "#001a1a", border: "#0e7490", icon: "↻" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: MEMORY CENTER
// ═══════════════════════════════════════════════════════════════════════════════
function MemoryCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [injectForm, setInjectForm] = useState({ project: "general", type: "discovery", title: "", text: "" });

  const runCommand = async (cmd) => {
    // In real implementation, this would call your backend/API
    // For now, this is a placeholder showing the UI
    console.log("Would run:", cmd);
    return { success: true, output: "Command executed (demo mode)" };
  };

  const searchMemory = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    // Simulated search - in production this calls the bridge
    setTimeout(() => {
      setSearchResults([
        { id: 1, title: "[CHAT] Dashboard deployed to Cloudflare", project: "Claude-Ecosystem-Dashboard", type: "feature", date: "2026-02-05" },
        { id: 2, title: "[CHAT] Privacy regel: altijd privé", project: "general", type: "decision", date: "2026-02-05" },
        { id: 3, title: "[ABSORBED] Multi-Mac Setup", project: "general", type: "discovery", date: "2026-02-05" },
      ]);
      setLoading(false);
    }, 500);
  };

  const loadStats = async () => {
    setStats({
      total: 40,
      bySource: { CHAT: 10, CLI: 17, BRAIN: 12, COWORK: 0, SYNC: 1 },
      byType: { discovery: 31, decision: 4, feature: 4, change: 1 },
    });
  };

  useEffect(() => { loadStats(); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats Overview */}
      {stats && (
        <div style={{ background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>🧠 Memory Stats</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ background: "#1a1a2e", padding: "12px 20px", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e" }}>{stats.total}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Total Observations</div>
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

      {/* Search */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>🔍 Search Memory</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchMemory()}
            placeholder="Zoek in observations..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none" }}
          />
          <button onClick={searchMemory} disabled={loading} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #3b82f6", background: "#1e3a8a", color: "#93c5fd", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "..." : "Zoek"}
          </button>
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

      {/* Quick Inject */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", marginBottom: 12 }}>➕ Quick Inject</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={injectForm.project}
              onChange={e => setInjectForm({ ...injectForm, project: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 12 }}
            >
              <option value="general">general</option>
              <option value="Claude-Ecosystem-Dashboard">Claude-Ecosystem-Dashboard</option>
              <option value="BlackFuelWhiskey">BlackFuelWhiskey</option>
              <option value="Econation">Econation</option>
            </select>
            <select
              value={injectForm.type}
              onChange={e => setInjectForm({ ...injectForm, type: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 12 }}
            >
              <option value="discovery">discovery</option>
              <option value="decision">decision</option>
              <option value="feature">feature</option>
              <option value="bugfix">bugfix</option>
              <option value="change">change</option>
            </select>
          </div>
          <input
            type="text"
            value={injectForm.title}
            onChange={e => setInjectForm({ ...injectForm, title: e.target.value })}
            placeholder="Titel..."
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none" }}
          />
          <textarea
            value={injectForm.text}
            onChange={e => setInjectForm({ ...injectForm, text: e.target.value })}
            placeholder="Beschrijving / notities..."
            rows={3}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none", resize: "vertical" }}
          />
          <button style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #166534", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            💾 Inject naar Claude-Mem
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: GIT & DEPLOY CENTER
// ═══════════════════════════════════════════════════════════════════════════════
function GitDeployCenter() {
  const [repos, setRepos] = useState([
    { name: "Claude-Ecosystem-Dashboard", status: "clean", branch: "main", lastPush: "2 min ago", cloudflare: "claude-ecosystem-dashboard.pages.dev" },
    { name: "Claude-Code-Mac-Sync", status: "clean", branch: "main", lastPush: "1 day ago", cloudflare: null },
    { name: "Econation", status: "dirty", branch: "main", lastPush: "3 days ago", dirtyFiles: 10, cloudflare: null },
    { name: "BlackFuelWhiskey", status: "clean", branch: "main", lastPush: "5 days ago", cloudflare: "blackfuelwhiskey.pages.dev" },
  ]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [actionLog, setActionLog] = useState([]);

  const addLog = (msg) => setActionLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);

  const gitPull = (repo) => {
    addLog(`🔽 git pull ${repo.name}...`);
    setTimeout(() => addLog(`✅ ${repo.name} up to date`), 1000);
  };

  const gitPush = (repo) => {
    addLog(`🔼 git push ${repo.name}...`);
    setTimeout(() => addLog(`✅ ${repo.name} pushed to origin/main`), 1500);
  };

  const deployCloudflare = (repo) => {
    addLog(`☁️ Deploying ${repo.name} to Cloudflare...`);
    setTimeout(() => addLog(`✅ ${repo.cloudflare} deployed!`), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Repos Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {repos.map(repo => (
          <div key={repo.name} style={{
            background: repo.status === "dirty" ? "#1a1400" : "#0f0f0f",
            border: `1px solid ${repo.status === "dirty" ? "#854d0e" : "#1f2937"}`,
            borderRadius: 12, padding: 14
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#e5e5e5" }}>📂 {repo.name}</div>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 4,
                background: repo.status === "clean" ? "#22c55e22" : "#f59e0b22",
                color: repo.status === "clean" ? "#4ade80" : "#fbbf24"
              }}>{repo.status === "clean" ? "✓ clean" : `⚠ ${repo.dirtyFiles} dirty`}</span>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
              🌿 {repo.branch} • ⏱️ {repo.lastPush}
            </div>
            {repo.cloudflare && (
              <div style={{ fontSize: 11, color: "#06b6d4", marginBottom: 8 }}>
                ☁️ <a href={`https://${repo.cloudflare}`} target="_blank" rel="noopener noreferrer" style={{ color: "#06b6d4" }}>{repo.cloudflare}</a>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => gitPull(repo)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #374151", background: "#1a1a2e", color: "#93c5fd", fontSize: 11, cursor: "pointer" }}>🔽 Pull</button>
              <button onClick={() => gitPush(repo)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #374151", background: "#1a1a2e", color: "#93c5fd", fontSize: 11, cursor: "pointer" }}>🔼 Push</button>
              {repo.cloudflare && (
                <button onClick={() => deployCloudflare(repo)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #0e7490", background: "#001a1a", color: "#22d3ee", fontSize: 11, cursor: "pointer" }}>☁️ Deploy</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action Log */}
      {actionLog.length > 0 && (
        <div style={{ background: "#0a0a0a", border: "1px solid #1f2937", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>📋 Action Log</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af", maxHeight: 150, overflow: "auto" }}>
            {actionLog.map((log, i) => (
              <div key={i}><span style={{ color: "#4b5563" }}>{log.time}</span> {log.msg}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: VERSION SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════════════
function VersionSnapshots() {
  const [snapshots, setSnapshots] = useState([
    { id: 1, name: "v1.0.0 - Initial Dashboard", date: "2026-02-05 17:30", project: "Claude-Ecosystem-Dashboard", type: "manual" },
    { id: 2, name: "Pre-Cloudflare deploy", date: "2026-02-05 23:00", project: "Claude-Ecosystem-Dashboard", type: "auto" },
    { id: 3, name: "Memory Bridge added", date: "2026-02-05 23:15", project: "Claude-Ecosystem-Dashboard", type: "manual" },
  ]);
  const [newSnapshot, setNewSnapshot] = useState({ name: "", project: "Claude-Ecosystem-Dashboard" });

  const createSnapshot = () => {
    if (!newSnapshot.name.trim()) return;
    setSnapshots(prev => [{
      id: Date.now(),
      name: newSnapshot.name,
      date: new Date().toLocaleString("nl-BE"),
      project: newSnapshot.project,
      type: "manual"
    }, ...prev]);
    setNewSnapshot({ ...newSnapshot, name: "" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Create Snapshot */}
      <div style={{ background: "#0f0f23", border: "1px solid #1e1b4b", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>📸 Create Snapshot</div>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={newSnapshot.project}
            onChange={e => setNewSnapshot({ ...newSnapshot, project: e.target.value })}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 12 }}
          >
            <option>Claude-Ecosystem-Dashboard</option>
            <option>BlackFuelWhiskey</option>
            <option>Econation</option>
          </select>
          <input
            type="text"
            value={newSnapshot.name}
            onChange={e => setNewSnapshot({ ...newSnapshot, name: e.target.value })}
            placeholder="Snapshot naam (bv: v1.2.0 - Feature X)"
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111", color: "#e5e5e5", fontSize: 13, outline: "none" }}
          />
          <button onClick={createSnapshot} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #5b21b6", background: "#1e1b4b", color: "#c4b5fd", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            📸 Save
          </button>
        </div>
      </div>

      {/* Snapshots List */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>🕐 Snapshot History</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {snapshots.map(snap => (
            <div key={snap.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1a2e", border: "1px solid #374151", borderRadius: 8, padding: 12 }}>
              <div>
                <div style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 13 }}>{snap.name}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>{snap.date}</span>
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#22c55e22", color: "#4ade80" }}>{snap.project}</span>
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: snap.type === "auto" ? "#3b82f622" : "#a78bfa22", color: snap.type === "auto" ? "#60a5fa" : "#c4b5fd" }}>{snap.type}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #166534", background: "#052e16", color: "#4ade80", fontSize: 11, cursor: "pointer" }}>🔄 Restore</button>
                <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #374151", background: "#1a1a2e", color: "#9ca3af", fontSize: 11, cursor: "pointer" }}>👁️ View</button>
                <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #0e7490", background: "#001a1a", color: "#22d3ee", fontSize: 11, cursor: "pointer" }}>🌿 Clone</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════════
function ActivityLog() {
  const [activities, setActivities] = useState([
    { id: 1, time: "00:35", source: "Chat", mac: "MBA", action: "Memory inject", detail: "Claude Code updated v2.1.32", type: "change" },
    { id: 2, time: "00:30", source: "Chat", mac: "MBA", action: "Cloudflare deploy", detail: "claude-ecosystem-dashboard.pages.dev", type: "deploy" },
    { id: 3, time: "00:25", source: "Chat", mac: "MBA", action: "Git push", detail: "GitHub Actions auto-deploy", type: "git" },
    { id: 4, time: "00:20", source: "Chat", mac: "MBA", action: "File created", detail: "bridge/claude-mem-bridge.py", type: "file" },
    { id: 5, time: "00:15", source: "Chat", mac: "MBA", action: "API Token created", detail: "Cloudflare GitHub Actions", type: "config" },
    { id: 6, time: "23:30", source: "CLI", mac: "MBA", action: "Session start", detail: "Econation project", type: "session" },
    { id: 7, time: "23:00", source: "CLI", mac: "MBA", action: "Brain save", detail: "12 observations stored", type: "memory" },
  ]);

  const typeColors = {
    change: { bg: "#22c55e22", color: "#4ade80" },
    deploy: { bg: "#06b6d422", color: "#22d3ee" },
    git: { bg: "#a78bfa22", color: "#c4b5fd" },
    file: { bg: "#3b82f622", color: "#60a5fa" },
    config: { bg: "#f59e0b22", color: "#fbbf24" },
    session: { bg: "#ec489922", color: "#f472b6" },
    memory: { bg: "#8b5cf622", color: "#a78bfa" },
  };

  return (
    <div style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f472b6" }}>📜 Activity Log</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Chat", "CLI", "All"].map(f => (
            <button key={f} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #374151", background: f === "All" ? "#1e1b4b" : "#111", color: f === "All" ? "#c4b5fd" : "#6b7280", fontSize: 11, cursor: "pointer" }}>{f}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {activities.map(act => (
          <div key={act.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1a1a2e", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: "#4b5563", fontFamily: "monospace", width: 50 }}>{act.time}</div>
            <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: act.source === "Chat" ? "#3b82f622" : "#22c55e22", color: act.source === "Chat" ? "#60a5fa" : "#4ade80", width: 40, textAlign: "center" }}>{act.source}</div>
            <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#1f2937", color: "#9ca3af", width: 35, textAlign: "center" }}>{act.mac}</div>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: 12 }}>{act.action}</span>
              <span style={{ color: "#6b7280", fontSize: 12 }}> — {act.detail}</span>
            </div>
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, ...typeColors[act.type] }}>{act.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: STAGING & VARIANTS (Client Preview System)
// ═══════════════════════════════════════════════════════════════════════════════
function StagingVariants() {
  const [projects, setProjects] = useState([
    {
      name: "BlackFuelWhiskey",
      production: "blackfuelwhiskey.com",
      staging: "staging.blackfuelwhiskey.pages.dev",
      variants: [
        { id: 1, name: "Variant A - Dark Theme", url: "bfw-variant-a.pages.dev", status: "ready" },
        { id: 2, name: "Variant B - Gold Accents", url: "bfw-variant-b.pages.dev", status: "building" },
      ]
    },
    {
      name: "Econation",
      production: "econation.be",
      staging: "staging.econation.pages.dev",
      variants: []
    },
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {projects.map(proj => (
        <div key={proj.name} style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e5e5e5" }}>🌐 {proj.name}</div>
            <button style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #0e7490", background: "#001a1a", color: "#22d3ee", fontSize: 11, cursor: "pointer" }}>➕ New Variant</button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 600, marginBottom: 4 }}>🟢 PRODUCTION</div>
              <a href={`https://${proj.production}`} target="_blank" rel="noopener noreferrer" style={{ color: "#86efac", fontSize: 13 }}>{proj.production}</a>
            </div>
            <div style={{ background: "#1a1400", border: "1px solid #854d0e", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600, marginBottom: 4 }}>🟡 STAGING</div>
              <a href={`https://${proj.staging}`} target="_blank" rel="noopener noreferrer" style={{ color: "#fde68a", fontSize: 13 }}>{proj.staging}</a>
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
                      <button style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #374151", background: "#1a1a2e", color: "#9ca3af", fontSize: 10, cursor: "pointer" }}>🔗 Share</button>
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
// MAIN: CONTROL CENTER
// ═══════════════════════════════════════════════════════════════════════════════
export default function ControlCenter() {
  const [tab, setTab] = useState("memory");

  const tabs = [
    { id: "memory", label: "🧠 Memory", color: "#a78bfa" },
    { id: "git", label: "📂 Git & Deploy", color: "#60a5fa" },
    { id: "versions", label: "📸 Versions", color: "#22c55e" },
    { id: "activity", label: "📜 Activity", color: "#f472b6" },
    { id: "staging", label: "🌐 Staging", color: "#06b6d4" },
  ];

  return (
    <div style={{ fontFamily: "'SF Pro Text', -apple-system, sans-serif", background: "#0a0a0a", color: "#e5e5e5", minHeight: "100vh", padding: 12 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f0f23, #1a0a2e, #0a1628)", border: "1px solid #1e1b4b", borderRadius: 16, padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, background: "linear-gradient(90deg, #a78bfa, #60a5fa, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Claude Control Center
            </h1>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              DS2036 — Franky | Memory + Git + Deploy + Versions | {new Date().toLocaleDateString("nl-BE")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "#22c55e22", color: "#4ade80", border: "1px solid #166534" }}>● MBA Online</span>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "#a78bfa22", color: "#c4b5fd", border: "1px solid #5b21b6" }}>◌ MM4 Pending</span>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "#a78bfa22", color: "#c4b5fd", border: "1px solid #5b21b6" }}>◌ MM2 Pending</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto" }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 8, minWidth: 100,
              border: `1px solid ${tab === t.id ? t.color + "66" : "#1f2937"}`,
              background: tab === t.id ? t.color + "22" : "#111",
              color: tab === t.id ? t.color : "#6b7280",
              fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "memory" && <MemoryCenter />}
      {tab === "git" && <GitDeployCenter />}
      {tab === "versions" && <VersionSnapshots />}
      {tab === "activity" && <ActivityLog />}
      {tab === "staging" && <StagingVariants />}

      {/* Footer */}
      <div style={{ marginTop: 16, padding: 12, background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 10, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#4b5563" }}>
          Claude Control Center v2.0 • Memory: 40 observations • Syncthing: 1/3 Macs • Last sync: just now
        </div>
      </div>
    </div>
  );
}

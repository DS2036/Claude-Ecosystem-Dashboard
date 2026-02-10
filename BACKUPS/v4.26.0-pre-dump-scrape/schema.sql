-- CCC D1 Database Schema v3.0
-- Universal Knowledge Graph — alles gevectorized en doorzoekbaar

-- Activity logs (was: KV LOGS met log: prefix)
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'action',
  action TEXT,
  detail TEXT,
  source TEXT DEFAULT 'Unknown',
  mac TEXT DEFAULT 'Unknown',
  project TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_type ON activity_logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_source ON activity_logs(source);

-- Dump items (was: KV LOGS met dump:items key — 1 grote JSON blob)
CREATE TABLE IF NOT EXISTS dump_items (
  id INTEGER PRIMARY KEY,
  content TEXT,
  memo TEXT,
  type TEXT NOT NULL DEFAULT 'note',
  icon TEXT,
  title TEXT,
  author TEXT,
  thumbnail TEXT,
  analysis TEXT,
  analyzed INTEGER DEFAULT 0,
  analyzed_by TEXT,
  analyzed_at TEXT,
  extra_analyses TEXT,
  routed_to TEXT,
  pinned INTEGER DEFAULT 0,
  source TEXT DEFAULT 'unknown',
  created TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dump_type ON dump_items(type);
CREATE INDEX IF NOT EXISTS idx_dump_analyzed ON dump_items(analyzed);
CREATE INDEX IF NOT EXISTS idx_dump_created ON dump_items(created DESC);

-- Snapshots (was: KV SNAPSHOTS)
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  name TEXT,
  project TEXT,
  type TEXT DEFAULT 'manual',
  timestamp TEXT NOT NULL,
  commit_hash TEXT,
  branch TEXT DEFAULT 'main',
  files TEXT,
  metadata TEXT,
  created_by TEXT DEFAULT 'Dashboard'
);
CREATE INDEX IF NOT EXISTS idx_snap_project ON snapshots(project);
CREATE INDEX IF NOT EXISTS idx_snap_timestamp ON snapshots(timestamp DESC);

-- Tools per machine (was: KV LOGS met tools: prefix)
CREATE TABLE IF NOT EXISTS machine_tools (
  machine TEXT PRIMARY KEY,
  plugins TEXT,
  mcp_servers TEXT,
  skills TEXT,
  vercel_skills TEXT,
  scanned_at TEXT
);

-- Routed analyses (nieuw: info doorgestuurd naar tabs)
CREATE TABLE IF NOT EXISTS routed_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER,
  source_url TEXT,
  source_title TEXT,
  analysis TEXT,
  extra_analyses TEXT,
  memo TEXT,
  target_tab TEXT NOT NULL,
  routed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES dump_items(id)
);
CREATE INDEX IF NOT EXISTS idx_routed_tab ON routed_items(target_tab);

-- Knowledge items (universeel: SDK-HRM, session memories, crypto, training data, etc.)
CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  subcategory TEXT,
  title TEXT,
  content TEXT NOT NULL,
  summary TEXT,
  tags TEXT,
  source TEXT DEFAULT 'manual',
  source_machine TEXT,
  project TEXT,
  tab TEXT,
  metadata TEXT,
  vectorized INTEGER DEFAULT 0,
  vectorized_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_tab ON knowledge_items(tab);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_items(project);
CREATE INDEX IF NOT EXISTS idx_knowledge_vectorized ON knowledge_items(vectorized);
CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge_items(created_at DESC);

-- Vectorize tracking — welke items zijn al ge-indexed
CREATE TABLE IF NOT EXISTS vectorize_log (
  vector_id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  text_hash TEXT,
  vectorized_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_veclog_source ON vectorize_log(source_type, source_id);

-- Directives — togglebare prompt-context items die via SessionStart hook worden opgehaald
CREATE TABLE IF NOT EXISTS directives (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  description TEXT,
  content TEXT NOT NULL,
  icon TEXT DEFAULT '📌',
  color TEXT DEFAULT '#8b5cf6',
  active INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual',
  machine TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_directives_active ON directives(active);
CREATE INDEX IF NOT EXISTS idx_directives_category ON directives(category);

-- To Do items — simpele cross-device takenlijst
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  notes TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  project TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_created ON todos(created_at DESC);

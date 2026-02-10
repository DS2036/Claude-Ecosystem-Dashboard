-- CCC D1 Database Schema
-- Vervangt KV voor gestructureerde data

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

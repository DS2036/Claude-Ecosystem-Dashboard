/**
 * CLAUDE CONTROL CENTER - CLOUDFLARE WORKER
 * Central Control Plane: API Proxy + Logging + Versioning + Activity
 * 
 * Endpoints:
 * - POST /api/ai          → Anthropic API proxy
 * - POST /api/log         → Log activity
 * - GET  /api/logs        → Get activity logs
 * - POST /api/snapshot    → Create version snapshot
 * - GET  /api/snapshots   → List snapshots
 * - POST /api/restore     → Restore from snapshot
 * - GET  /api/health      → Health check
 * - GET  /api/dump        → Get all dump items (cloud sync)
 * - POST /api/dump        → Save all dump items (cloud sync)
 * - GET  /api/tools       → Get tools per machine
 * - POST /api/tools       → Save tools for a machine
 */

// KV Namespaces (bind in wrangler.toml):
// - LOGS: Activity logging
// - SNAPSHOTS: Version snapshots
// - CONFIG: Configuration

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route handlers
      if (path === '/api/ai' && request.method === 'POST') {
        return await handleAIProxy(request, env);
      }
      if (path === '/api/log' && request.method === 'POST') {
        return await handleLog(request, env);
      }
      if (path === '/api/logs' && request.method === 'GET') {
        return await handleGetLogs(request, env);
      }
      if (path === '/api/snapshot' && request.method === 'POST') {
        return await handleSnapshot(request, env);
      }
      if (path === '/api/snapshots' && request.method === 'GET') {
        return await handleGetSnapshots(request, env);
      }
      if (path === '/api/restore' && request.method === 'POST') {
        return await handleRestore(request, env);
      }
      if (path === '/api/dump' && request.method === 'GET') {
        return await handleGetDump(request, env);
      }
      if (path === '/api/dump' && request.method === 'POST') {
        return await handleSaveDump(request, env);
      }
      if (path === '/api/dump/add' && request.method === 'POST') {
        return await handleAddDumpItem(request, env);
      }
      if (path === '/api/tools' && request.method === 'GET') {
        return await handleGetTools(request, env);
      }
      if (path === '/api/tools' && request.method === 'POST') {
        return await handleSaveTools(request, env);
      }
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROXY - Anthropic API
// ═══════════════════════════════════════════════════════════════════════════════
async function handleAIProxy(request, env) {
  const body = await request.json();
  
  // Log the AI request
  await logActivity(env, {
    type: 'ai_request',
    action: 'AI Advisor query',
    detail: body.messages?.[0]?.content?.substring(0, 100) + '...',
    source: 'Dashboard',
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: body.model || 'claude-sonnet-4-20250514',
      max_tokens: body.max_tokens || 1000,
      messages: body.messages,
    }),
  });

  const data = await response.json();
  
  // Log the response
  await logActivity(env, {
    type: 'ai_response',
    action: 'AI Advisor response',
    detail: `${data.usage?.output_tokens || 0} tokens`,
    source: 'Dashboard',
  });

  return jsonResponse(data);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
async function logActivity(env, activity) {
  if (!env.LOGS) return;
  
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...activity,
  };

  // Store with timestamp key for ordering
  const key = `log:${Date.now()}:${entry.id}`;
  await env.LOGS.put(key, JSON.stringify(entry), {
    expirationTtl: 60 * 60 * 24 * 30, // 30 days
  });

  return entry;
}

async function handleLog(request, env) {
  const body = await request.json();
  
  const entry = await logActivity(env, {
    type: body.type || 'action',
    action: body.action,
    detail: body.detail,
    source: body.source || 'Unknown',
    mac: body.mac || 'Unknown',
    project: body.project,
    metadata: body.metadata,
  });

  return jsonResponse({ success: true, entry });
}

async function handleGetLogs(request, env) {
  if (!env.LOGS) {
    return jsonResponse({ logs: [], error: 'LOGS KV not configured' });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit')) || 100;
  const type = url.searchParams.get('type');
  const source = url.searchParams.get('source');

  // List all logs (newest first)
  const list = await env.LOGS.list({ prefix: 'log:', limit: limit * 2 });
  
  const logs = [];
  for (const key of list.keys.reverse()) {
    const value = await env.LOGS.get(key.name);
    if (value) {
      const log = JSON.parse(value);
      // Filter if needed
      if (type && log.type !== type) continue;
      if (source && log.source !== source) continue;
      logs.push(log);
      if (logs.length >= limit) break;
    }
  }

  return jsonResponse({ logs, total: list.keys.length });
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSIONING / SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSnapshot(request, env) {
  if (!env.SNAPSHOTS) {
    return jsonResponse({ error: 'SNAPSHOTS KV not configured' }, 500);
  }

  const body = await request.json();
  
  const snapshot = {
    id: crypto.randomUUID(),
    name: body.name,
    project: body.project,
    type: body.type || 'manual',
    timestamp: new Date().toISOString(),
    commit: body.commit,
    branch: body.branch || 'main',
    files: body.files || [],
    metadata: body.metadata,
    createdBy: body.createdBy || 'Dashboard',
  };

  const key = `snapshot:${body.project}:${Date.now()}:${snapshot.id}`;
  await env.SNAPSHOTS.put(key, JSON.stringify(snapshot));

  // Log the snapshot creation
  await logActivity(env, {
    type: 'snapshot',
    action: 'Snapshot created',
    detail: `${snapshot.name} (${snapshot.project})`,
    source: snapshot.createdBy,
    project: snapshot.project,
  });

  return jsonResponse({ success: true, snapshot });
}

async function handleGetSnapshots(request, env) {
  if (!env.SNAPSHOTS) {
    return jsonResponse({ snapshots: [], error: 'SNAPSHOTS KV not configured' });
  }

  const url = new URL(request.url);
  const project = url.searchParams.get('project');
  const limit = parseInt(url.searchParams.get('limit')) || 50;

  const prefix = project ? `snapshot:${project}:` : 'snapshot:';
  const list = await env.SNAPSHOTS.list({ prefix, limit: limit * 2 });

  const snapshots = [];
  for (const key of list.keys.reverse()) {
    const value = await env.SNAPSHOTS.get(key.name);
    if (value) {
      snapshots.push(JSON.parse(value));
      if (snapshots.length >= limit) break;
    }
  }

  return jsonResponse({ snapshots, total: list.keys.length });
}

async function handleRestore(request, env) {
  const body = await request.json();
  
  if (!body.snapshotId) {
    return jsonResponse({ error: 'snapshotId required' }, 400);
  }

  // Find the snapshot
  const list = await env.SNAPSHOTS.list({ prefix: 'snapshot:' });
  let snapshot = null;
  
  for (const key of list.keys) {
    if (key.name.includes(body.snapshotId)) {
      const value = await env.SNAPSHOTS.get(key.name);
      if (value) {
        snapshot = JSON.parse(value);
        break;
      }
    }
  }

  if (!snapshot) {
    return jsonResponse({ error: 'Snapshot not found' }, 404);
  }

  // Log the restore action
  await logActivity(env, {
    type: 'restore',
    action: 'Snapshot restored',
    detail: `${snapshot.name} (${snapshot.project}) → restored`,
    source: body.source || 'Dashboard',
    project: snapshot.project,
  });

  return jsonResponse({ 
    success: true, 
    snapshot,
    message: `Restore initiated for ${snapshot.name}. Git checkout ${snapshot.commit} required.`,
    command: snapshot.commit ? `git checkout ${snapshot.commit}` : null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUMP SYNC - Cross-device sync via KV
// ═══════════════════════════════════════════════════════════════════════════════
const DUMP_KEY = 'dump:items';

async function handleGetDump(request, env) {
  if (!env.LOGS) {
    return jsonResponse({ items: [], error: 'KV not configured' });
  }
  const value = await env.LOGS.get(DUMP_KEY);
  if (!value) {
    return jsonResponse({ items: [], updated: null });
  }
  const data = JSON.parse(value);
  return jsonResponse(data);
}

// ── YouTube oEmbed metadata fetch ──
async function fetchYouTubeMetadata(url) {
  try {
    const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const r = await fetch(oembed, { headers: { 'User-Agent': 'CCC-Worker/1.0' } });
    if (!r.ok) return null;
    const data = await r.json();
    return {
      title: data.title || '',
      author: data.author_name || '',
      thumbnail: data.thumbnail_url || '',
    };
  } catch (e) {
    console.error('YouTube oEmbed failed:', e);
    return null;
  }
}

async function handleAddDumpItem(request, env) {
  if (!env.LOGS) {
    return jsonResponse({ error: 'KV not configured' }, 500);
  }
  const body = await request.json();
  const content = (body.content || body.url || body.text || '').trim();
  const memo = (body.memo || body.note || '').trim();
  if (!content && !memo) {
    return jsonResponse({ error: 'content or memo required' }, 400);
  }
  // Auto-detect type
  const l = content.toLowerCase();
  let type = 'note', icon = '📝';
  if (l.includes('youtube.com') || l.includes('youtu.be')) { type = 'youtube'; icon = '🎬'; }
  else if (l.includes('instagram.com')) { type = 'instagram'; icon = '📸'; }
  else if (l.includes('twitter.com') || l.includes('x.com/')) { type = 'twitter'; icon = '🐦'; }
  else if (l.includes('github.com')) { type = 'github'; icon = '💻'; }
  else if (l.includes('medium.com')) { type = 'article'; icon = '📰'; }
  else if (l.startsWith('http')) { type = 'link'; icon = '🔗'; }

  const item = {
    id: Date.now(),
    content,
    memo,
    type,
    icon,
    created: new Date().toISOString(),
    pinned: false,
    source: body.source || 'shortcut',
  };

  // Enrich YouTube items with metadata (title, author, thumbnail)
  if (type === 'youtube') {
    const meta = await fetchYouTubeMetadata(content);
    if (meta) {
      item.title = meta.title;
      item.author = meta.author;
      item.thumbnail = meta.thumbnail;
    }
  }

  // Get existing items, add new one at top
  const value = await env.LOGS.get(DUMP_KEY);
  const existing = value ? JSON.parse(value) : { items: [] };
  const items = [item, ...(existing.items || [])];
  await env.LOGS.put(DUMP_KEY, JSON.stringify({ items, updated: new Date().toISOString(), source: 'shortcut' }));

  return jsonResponse({ success: true, item, total: items.length });
}

async function handleSaveDump(request, env) {
  if (!env.LOGS) {
    return jsonResponse({ error: 'KV not configured' }, 500);
  }
  const body = await request.json();
  const data = {
    items: body.items || [],
    updated: new Date().toISOString(),
    source: body.source || 'unknown',
  };
  await env.LOGS.put(DUMP_KEY, JSON.stringify(data));
  return jsonResponse({ success: true, count: data.items.length, updated: data.updated });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS PER MACHINE
// ═══════════════════════════════════════════════════════════════════════════════
const TOOLS_PREFIX = 'tools:';

async function handleGetTools(request, env) {
  if (!env.LOGS) {
    return jsonResponse({ error: 'KV not configured' }, 500);
  }
  // Get all machines
  const machines = {};
  for (const id of ['MM4', 'MBA', 'MM2']) {
    const value = await env.LOGS.get(TOOLS_PREFIX + id);
    if (value) {
      machines[id] = JSON.parse(value);
    }
  }
  return jsonResponse({ machines, updated: new Date().toISOString() });
}

async function handleSaveTools(request, env) {
  if (!env.LOGS) {
    return jsonResponse({ error: 'KV not configured' }, 500);
  }
  const body = await request.json();
  const machine = (body.machine || '').toUpperCase();
  if (!machine) {
    return jsonResponse({ error: 'machine required' }, 400);
  }
  const data = {
    plugins: body.plugins || [],
    mcpServers: body.mcpServers || [],
    skills: body.skills || [],
    vercelSkills: body.vercelSkills || [],
    scannedAt: new Date().toISOString(),
  };
  await env.LOGS.put(TOOLS_PREFIX + machine, JSON.stringify(data));
  return jsonResponse({ success: true, machine, scannedAt: data.scannedAt });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

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

// D1 helper: schrijf mee naar D1 zonder KV te breken
async function d1Safe(fn) {
  try { return await fn(); } catch (e) { console.error('D1 error (non-fatal):', e.message); return null; }
}

export default {
  // Queue consumer: verwerk analyse-klare items
  async queue(batch, env) {
    for (const msg of batch.messages) {
      const { itemId, action } = msg.body;
      if (action === 'vectorize' && env.DB) {
        const item = await d1Safe(() => env.DB.prepare('SELECT * FROM dump_items WHERE id = ?').bind(itemId).first());
        if (item) await vectorizeItem(env, item);
      }
      msg.ack();
    }
  },

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
      if (path === '/api/search' && request.method === 'GET') {
        return await handleSearch(request, env);
      }
      if (path === '/api/route' && request.method === 'POST') {
        return await handleRoute(request, env);
      }
      if (path === '/api/stats' && request.method === 'GET') {
        return await handleStats(request, env);
      }
      if (path === '/api/semantic-search' && request.method === 'GET') {
        return await handleSemanticSearch(request, env);
      }
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0', d1: !!env.DB, vectorize: !!env.VECTORIZE, queue: !!env.ANALYZE_QUEUE, ai: !!env.AI });
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
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...activity,
  };

  // KV (bestaand — blijft werken)
  if (env.LOGS) {
    const key = `log:${Date.now()}:${entry.id}`;
    await env.LOGS.put(key, JSON.stringify(entry), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  }

  // D1 (nieuw — schrijft mee, faalt niet-fataal)
  if (env.DB) {
    await d1Safe(() => env.DB.prepare(
      'INSERT INTO activity_logs (id, timestamp, type, action, detail, source, mac, project, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(entry.id, entry.timestamp, entry.type || 'action', entry.action || '', entry.detail || '', entry.source || 'Unknown', entry.mac || 'Unknown', entry.project || '', JSON.stringify(entry.metadata || null)).run());
  }

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
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit')) || 100;
  const type = url.searchParams.get('type');
  const source = url.searchParams.get('source');

  // Probeer D1 eerst (sneller, SQL filtering)
  if (env.DB) {
    const d1Result = await d1Safe(async () => {
      let sql = 'SELECT * FROM activity_logs WHERE 1=1';
      const params = [];
      if (type) { sql += ' AND type = ?'; params.push(type); }
      if (source) { sql += ' AND source = ?'; params.push(source); }
      sql += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);
      const stmt = env.DB.prepare(sql);
      return params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
    });
    if (d1Result && d1Result.results) {
      return jsonResponse({ logs: d1Result.results, total: d1Result.results.length, source: 'd1' });
    }
  }

  // Fallback: KV (bestaand)
  if (!env.LOGS) {
    return jsonResponse({ logs: [], error: 'No storage configured' });
  }
  const list = await env.LOGS.list({ prefix: 'log:', limit: limit * 2 });
  const logs = [];
  for (const key of list.keys.reverse()) {
    const value = await env.LOGS.get(key.name);
    if (value) {
      const log = JSON.parse(value);
      if (type && log.type !== type) continue;
      if (source && log.source !== source) continue;
      logs.push(log);
      if (logs.length >= limit) break;
    }
  }
  return jsonResponse({ logs, total: list.keys.length, source: 'kv' });
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
  // Probeer D1 eerst
  if (env.DB) {
    const d1Result = await d1Safe(async () => {
      return await env.DB.prepare('SELECT * FROM dump_items ORDER BY created DESC').all();
    });
    if (d1Result && d1Result.results && d1Result.results.length > 0) {
      // D1 rows → items format (extra_analyses en routed_to zijn JSON strings)
      const items = d1Result.results.map(r => ({
        ...r,
        analyzed: !!r.analyzed,
        pinned: !!r.pinned,
        extraAnalyses: r.extra_analyses ? JSON.parse(r.extra_analyses) : undefined,
        routedTo: r.routed_to ? JSON.parse(r.routed_to) : undefined,
      }));
      return jsonResponse({ items, updated: new Date().toISOString(), source: 'd1' });
    }
  }

  // Fallback: KV
  if (!env.LOGS) {
    return jsonResponse({ items: [], error: 'No storage configured' });
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

  // KV (bestaand)
  if (env.LOGS) {
    const value = await env.LOGS.get(DUMP_KEY);
    const existing = value ? JSON.parse(value) : { items: [] };
    const items = [item, ...(existing.items || [])];
    await env.LOGS.put(DUMP_KEY, JSON.stringify({ items, updated: new Date().toISOString(), source: 'shortcut' }));
  }

  // D1 (nieuw)
  if (env.DB) {
    await d1Safe(() => env.DB.prepare(`
      INSERT INTO dump_items (id, content, memo, type, icon, title, author, thumbnail, pinned, source, created)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(item.id, item.content, item.memo || '', type, icon, item.title || null, item.author || null, item.thumbnail || null, item.source || 'shortcut', item.created).run());
  }

  return jsonResponse({ success: true, item });
}

async function handleSaveDump(request, env) {
  const body = await request.json();
  const items = body.items || [];
  const data = {
    items,
    updated: new Date().toISOString(),
    source: body.source || 'unknown',
  };

  // KV (bestaand)
  if (env.LOGS) {
    await env.LOGS.put(DUMP_KEY, JSON.stringify(data));
  }

  // D1 (nieuw — upsert elk item individueel)
  if (env.DB) {
    await d1Safe(async () => {
      for (const item of items) {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO dump_items (id, content, memo, type, icon, title, author, thumbnail, analysis, analyzed, analyzed_by, analyzed_at, extra_analyses, routed_to, pinned, source, created)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          item.id, item.content || '', item.memo || '', item.type || 'note', item.icon || '📝',
          item.title || null, item.author || null, item.thumbnail || null,
          item.analysis || null, item.analyzed ? 1 : 0, item.analyzed_by || null, item.analyzed_at || null,
          item.extraAnalyses ? JSON.stringify(item.extraAnalyses) : null,
          item.routedTo ? JSON.stringify(item.routedTo) : null,
          item.pinned ? 1 : 0, item.source || 'unknown', item.created || new Date().toISOString()
        ).run();
      }
    });
  }

  // Vectorize geanalyseerde items (via queue of direct)
  if (env.ANALYZE_QUEUE) {
    const analyzed = items.filter(i => i.analyzed && i.analysis);
    for (const item of analyzed) {
      await d1Safe(() => env.ANALYZE_QUEUE.send({ itemId: item.id, action: 'vectorize' }));
    }
  } else if (env.VECTORIZE && env.AI) {
    // Direct vectorize als geen queue beschikbaar
    const analyzed = items.filter(i => i.analyzed && i.analysis);
    for (const item of analyzed) {
      ctx && ctx.waitUntil(vectorizeItem(env, item));
    }
  }

  return jsonResponse({ success: true, count: items.length, updated: data.updated });
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

  // KV
  if (env.LOGS) {
    await env.LOGS.put(TOOLS_PREFIX + machine, JSON.stringify(data));
  }

  // D1
  if (env.DB) {
    await d1Safe(() => env.DB.prepare(`
      INSERT OR REPLACE INTO machine_tools (machine, plugins, mcp_servers, skills, vercel_skills, scanned_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(machine, JSON.stringify(data.plugins), JSON.stringify(data.mcpServers), JSON.stringify(data.skills), JSON.stringify(data.vercelSkills), data.scannedAt).run());
  }

  return jsonResponse({ success: true, machine, scannedAt: data.scannedAt });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH — D1 SQL queries op dump items + analyses
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSearch(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured', results: [] });
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const type = url.searchParams.get('type');
  const tab = url.searchParams.get('tab');
  const limit = parseInt(url.searchParams.get('limit')) || 20;

  if (q) {
    // Zoek in content, memo, title, analysis
    const results = await d1Safe(async () => {
      let sql = `SELECT * FROM dump_items WHERE (content LIKE ? OR memo LIKE ? OR title LIKE ? OR analysis LIKE ?)`;
      const params = [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`];
      if (type) { sql += ' AND type = ?'; params.push(type); }
      sql += ' ORDER BY created DESC LIMIT ?';
      params.push(limit);
      return await env.DB.prepare(sql).bind(...params).all();
    });
    return jsonResponse({ results: results?.results || [], query: q });
  }

  if (tab) {
    // Haal routed items op voor een specifieke tab
    const results = await d1Safe(async () => {
      return await env.DB.prepare('SELECT * FROM routed_items WHERE target_tab = ? ORDER BY routed_at DESC LIMIT ?').bind(tab, limit).all();
    });
    return jsonResponse({ results: results?.results || [], tab });
  }

  return jsonResponse({ error: 'q or tab parameter required', results: [] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE — Sla gerouteerde analyse op in D1
// ═══════════════════════════════════════════════════════════════════════════════
async function handleRoute(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);
  const body = await request.json();
  const result = await d1Safe(() => env.DB.prepare(`
    INSERT INTO routed_items (source_id, source_url, source_title, analysis, extra_analyses, memo, target_tab)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.sourceId || null, body.sourceUrl || '', body.sourceTitle || '',
    body.analysis || '', body.extraAnalyses ? JSON.stringify(body.extraAnalyses) : null,
    body.memo || '', body.targetTab
  ).run());
  return jsonResponse({ success: !!result, routed: body.targetTab });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS — Dashboard statistieken vanuit D1
// ═══════════════════════════════════════════════════════════════════════════════
async function handleStats(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' });
  const stats = await d1Safe(async () => {
    const dumps = await env.DB.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN analyzed=1 THEN 1 ELSE 0 END) as analyzed FROM dump_items').first();
    const logs = await env.DB.prepare('SELECT COUNT(*) as total FROM activity_logs').first();
    const routes = await env.DB.prepare('SELECT target_tab, COUNT(*) as count FROM routed_items GROUP BY target_tab').all();
    const types = await env.DB.prepare('SELECT type, COUNT(*) as count FROM dump_items GROUP BY type ORDER BY count DESC').all();
    return { dumps, logs, routes: routes?.results || [], types: types?.results || [] };
  });
  return jsonResponse(stats || { error: 'Query failed' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// VECTORIZE — Semantic search op analyses
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSemanticSearch(request, env) {
  if (!env.VECTORIZE || !env.AI || !env.DB) {
    return jsonResponse({ error: 'Vectorize/AI/D1 not configured', results: [] });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  if (!q) return jsonResponse({ error: 'q parameter required', results: [] });

  // Genereer embedding voor de query
  const embedding = await d1Safe(async () => {
    const resp = await env.AI.run('@cf/baai/bge-large-en-v1.5', { text: [q] });
    return resp?.data?.[0];
  });
  if (!embedding) return jsonResponse({ error: 'Embedding generation failed', results: [] });

  // Zoek nearest neighbors in Vectorize
  const matches = await d1Safe(async () => {
    return await env.VECTORIZE.query(embedding, { topK: 10, returnMetadata: 'all' });
  });
  if (!matches || !matches.matches) return jsonResponse({ results: [] });

  // Haal volledige items op uit D1
  const results = [];
  for (const match of matches.matches) {
    const item = await d1Safe(() => env.DB.prepare('SELECT * FROM dump_items WHERE id = ?').bind(parseInt(match.id)).first());
    if (item) {
      results.push({ ...item, score: match.score });
    }
  }
  return jsonResponse({ results, query: q });
}

// Vectorize: index een dump item (roep aan na analyse)
async function vectorizeItem(env, item) {
  if (!env.VECTORIZE || !env.AI) return;
  // Combineer alle tekst voor embedding
  const text = [item.title, item.content, item.memo, item.analysis].filter(Boolean).join(' ').substring(0, 2000);
  if (!text) return;
  await d1Safe(async () => {
    const resp = await env.AI.run('@cf/baai/bge-large-en-v1.5', { text: [text] });
    const embedding = resp?.data?.[0];
    if (embedding) {
      await env.VECTORIZE.upsert([{
        id: String(item.id),
        values: embedding,
        metadata: { type: item.type, title: item.title || '', analyzed: item.analyzed ? 1 : 0 },
      }]);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE CONSUMER — Verwerk analyse requests
// ═══════════════════════════════════════════════════════════════════════════════
// Queue consumer wordt geregistreerd in de export default

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

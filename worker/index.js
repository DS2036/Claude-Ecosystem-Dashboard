/**
 * CLAUDE CONTROL CENTER - CLOUDFLARE WORKER v3.3.0
 * Universal Knowledge Graph: alle data gevectorized en doorzoekbaar
 *
 * Endpoints:
 * - POST /api/ai          → Anthropic API proxy
 * - POST /api/log         → Log activity (+ vectorize)
 * - GET  /api/logs        → Get activity logs
 * - POST /api/snapshot    → Create version snapshot (+ vectorize)
 * - GET  /api/snapshots   → List snapshots
 * - POST /api/restore     → Restore from snapshot
 * - GET  /api/dump        → Get all dump items (cloud sync)
 * - POST /api/dump        → Save all dump items (cloud sync + vectorize)
 * - POST /api/dump/add    → Add single dump item
 * - GET  /api/tools       → Get tools per machine
 * - POST /api/tools       → Save tools for a machine
 * - GET  /api/search      → SQL text search
 * - GET  /api/semantic-search → Vector semantic search (ALLE types)
 * - POST /api/route       → Route analysis to tab
 * - GET  /api/stats       → Dashboard statistics
 * - POST /api/ingest      → Universal knowledge ingest (SDK-HRM, sessions, crypto, etc.)
 * - GET  /api/knowledge   → Query knowledge items
 * - POST /api/vectorize-all → Retroactieve bulk vectorisatie
 * - GET  /api/directives   → Get directives (active only, or all)
 * - POST /api/directives   → Create/update directive
 * - POST /api/directives/toggle → Toggle directive active/inactive
 * - DELETE /api/directives → Delete directive
 * - POST /api/directives/seed → Seed preset directives
 * - GET  /api/todos        → Get todos
 * - POST /api/todos        → Create todo
 * - POST /api/todos/update → Update todo (status, notes, text)
 * - DELETE /api/todos      → Delete todo
 * - GET  /api/health      → Health check
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CCC-Key',
};

// D1 helper: schrijf mee naar D1 zonder KV te breken
async function d1Safe(fn) {
  try { return await fn(); } catch (e) { console.error('D1 error (non-fatal):', e.message); return null; }
}

// Simple text hash voor dedup
function textHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return String(hash);
}

export default {
  // Queue consumer: verwerk vectorize requests voor ALLE types
  async queue(batch, env) {
    for (const msg of batch.messages) {
      const { sourceType, sourceId, action } = msg.body;
      if (action !== 'vectorize' || !env.DB) { msg.ack(); continue; }

      try {
        let text = '', metadata = {};

        if (sourceType === 'dump') {
          const item = await d1Safe(() => env.DB.prepare('SELECT * FROM dump_items WHERE id = ?').bind(sourceId).first());
          if (item) {
            text = [item.title, item.content, item.memo, item.analysis].filter(Boolean).join(' ');
            metadata = { type: item.type || 'note', title: item.title || '', source_type: 'dump' };
          }
        } else if (sourceType === 'log') {
          const item = await d1Safe(() => env.DB.prepare('SELECT * FROM activity_logs WHERE id = ?').bind(sourceId).first());
          if (item) {
            text = [item.action, item.detail, item.project].filter(Boolean).join(' ');
            metadata = { type: item.type || 'action', title: item.action || '', source_type: 'log' };
          }
        } else if (sourceType === 'snapshot') {
          const item = await d1Safe(() => env.DB.prepare('SELECT * FROM snapshots WHERE id = ?').bind(sourceId).first());
          if (item) {
            text = [item.name, item.project, item.branch, item.metadata].filter(Boolean).join(' ');
            metadata = { type: 'snapshot', title: item.name || '', source_type: 'snapshot', project: item.project || '' };
          }
        } else if (sourceType === 'knowledge') {
          const item = await d1Safe(() => env.DB.prepare('SELECT * FROM knowledge_items WHERE id = ?').bind(sourceId).first());
          if (item) {
            text = [item.title, item.content, item.summary, item.tags].filter(Boolean).join(' ');
            metadata = { type: item.category || 'knowledge', title: item.title || '', source_type: 'knowledge', tab: item.tab || '', category: item.category || '' };
          }
        } else if (sourceType === 'routed') {
          const item = await d1Safe(() => env.DB.prepare('SELECT * FROM routed_items WHERE id = ?').bind(sourceId).first());
          if (item) {
            text = [item.source_title, item.analysis, item.memo].filter(Boolean).join(' ');
            metadata = { type: 'routed', title: item.source_title || '', source_type: 'routed', tab: item.target_tab || '' };
          }
        }

        if (text) {
          await vectorizeUniversal(env, sourceType, String(sourceId), text, metadata);
        }
      } catch (e) {
        console.error(`Queue vectorize error [${sourceType}:${sourceId}]:`, e.message);
      }
      msg.ack();
    }
  },

  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health endpoint is always public
    if (path === '/api/health') {
      const vecCount = await d1Safe(async () => {
        const r = await env.DB.prepare('SELECT COUNT(*) as c FROM vectorize_log').first();
        return r?.c || 0;
      }, env);
      return jsonResponse({
        status: 'ok', timestamp: new Date().toISOString(), version: '3.1.0',
        services: { d1: !!env.DB, vectorize: !!env.VECTORIZE, queue: !!env.ANALYZE_QUEUE, ai: !!env.AI },
        vectors: vecCount || 0, auth: !!env.CCC_API_KEY,
      });
    }

    // API Key authentication — all other endpoints require it
    if (env.CCC_API_KEY) {
      const provided = request.headers.get('X-CCC-Key') || url.searchParams.get('key');
      if (provided !== env.CCC_API_KEY) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    }

    try {
      // Route handlers
      if (path === '/api/ai' && request.method === 'POST') return await handleAIProxy(request, env);
      if (path === '/api/log' && request.method === 'POST') return await handleLog(request, env);
      if (path === '/api/logs' && request.method === 'GET') return await handleGetLogs(request, env);
      if (path === '/api/snapshot' && request.method === 'POST') return await handleSnapshot(request, env);
      if (path === '/api/snapshots' && request.method === 'GET') return await handleGetSnapshots(request, env);
      if (path === '/api/restore' && request.method === 'POST') return await handleRestore(request, env);
      if (path === '/api/dump' && request.method === 'GET') return await handleGetDump(request, env);
      if (path === '/api/dump' && request.method === 'POST') return await handleSaveDump(request, env);
      if (path === '/api/dump/add' && request.method === 'POST') return await handleAddDumpItem(request, env);
      if (path === '/api/scrape' && request.method === 'POST') return await handleScrape(request, env);
      if (path === '/api/dump/analyze' && request.method === 'POST') return await handleDumpAnalyze(request, env);
      if (path === '/api/tools' && request.method === 'GET') return await handleGetTools(request, env);
      if (path === '/api/tools' && request.method === 'POST') return await handleSaveTools(request, env);
      if (path === '/api/search' && request.method === 'GET') return await handleSearch(request, env);
      if (path === '/api/route' && request.method === 'POST') return await handleRoute(request, env);
      if (path === '/api/stats' && request.method === 'GET') return await handleStats(request, env);
      if (path === '/api/semantic-search' && request.method === 'GET') return await handleSemanticSearch(request, env);
      if (path === '/api/ingest' && request.method === 'POST') return await handleIngest(request, env);
      if (path === '/api/knowledge' && request.method === 'GET') return await handleGetKnowledge(request, env);
      if (path === '/api/vectorize-all' && request.method === 'POST') return await handleVectorizeAll(request, env);
      if (path === '/api/directives' && request.method === 'GET') return await handleGetDirectives(request, env);
      if (path === '/api/directives' && request.method === 'POST') return await handleSaveDirective(request, env);
      if (path === '/api/directives' && request.method === 'DELETE') return await handleDeleteDirective(request, env);
      if (path === '/api/directives/toggle' && request.method === 'POST') return await handleToggleDirective(request, env);
      if (path === '/api/directives/seed' && request.method === 'POST') return await handleSeedDirectives(request, env);
      if (path === '/api/todos' && request.method === 'GET') return await handleGetTodos(request, env);
      if (path === '/api/todos' && request.method === 'POST') return await handleCreateTodo(request, env);
      if (path === '/api/todos/update' && request.method === 'POST') return await handleUpdateTodo(request, env);
      if (path === '/api/todos' && request.method === 'DELETE') return await handleDeleteTodo(request, env);

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// UNIVERSAL VECTORIZE — één functie voor alle types
// ═══════════════════════════════════════════════════════════════════════════════
async function vectorizeUniversal(env, sourceType, sourceId, text, metadata = {}) {
  if (!env.VECTORIZE || !env.AI) return false;
  const trimmed = text.substring(0, 2000);
  if (!trimmed) return false;

  const hash = textHash(trimmed);
  const vectorId = `${sourceType}:${sourceId}`;

  // Check of al ge-vectorized met zelfde hash
  if (env.DB) {
    const existing = await d1Safe(() => env.DB.prepare('SELECT text_hash FROM vectorize_log WHERE vector_id = ?').bind(vectorId).first());
    if (existing && existing.text_hash === hash) return false; // Skip — niet gewijzigd
  }

  // Genereer embedding
  const resp = await d1Safe(async () => await env.AI.run('@cf/baai/bge-large-en-v1.5', { text: [trimmed] }));
  const embedding = resp?.data?.[0];
  if (!embedding) return false;

  // Upsert naar Vectorize
  await d1Safe(async () => {
    await env.VECTORIZE.upsert([{
      id: vectorId,
      values: embedding,
      metadata: { ...metadata, source_type: sourceType },
    }]);
  });

  // Log in tracking table
  if (env.DB) {
    await d1Safe(() => env.DB.prepare(
      'INSERT OR REPLACE INTO vectorize_log (vector_id, source_type, source_id, text_hash, vectorized_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(vectorId, sourceType, sourceId, hash, new Date().toISOString()).run());

    // Update source table vectorized flag (voor knowledge_items)
    if (sourceType === 'knowledge') {
      await d1Safe(() => env.DB.prepare('UPDATE knowledge_items SET vectorized = 1, vectorized_at = ? WHERE id = ?').bind(new Date().toISOString(), sourceId).run());
    }
  }

  return true;
}

// Queue helper: stuur vectorize request naar queue
async function queueVectorize(env, sourceType, sourceId) {
  if (env.ANALYZE_QUEUE) {
    await d1Safe(() => env.ANALYZE_QUEUE.send({ sourceType, sourceId, action: 'vectorize' }));
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROXY - Anthropic API
// ═══════════════════════════════════════════════════════════════════════════════
async function handleAIProxy(request, env) {
  const body = await request.json();

  await logActivity(env, {
    type: 'ai_request', action: 'AI Advisor query',
    detail: body.messages?.[0]?.content?.substring(0, 100) + '...', source: 'Dashboard',
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

  await logActivity(env, {
    type: 'ai_response', action: 'AI Advisor response',
    detail: `${data.usage?.output_tokens || 0} tokens`, source: 'Dashboard',
  });

  return jsonResponse(data);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING SYSTEM — met vectorize
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
    await env.LOGS.put(key, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 30 });
  }

  // D1
  if (env.DB) {
    await d1Safe(() => env.DB.prepare(
      'INSERT INTO activity_logs (id, timestamp, type, action, detail, source, mac, project, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(entry.id, entry.timestamp, entry.type || 'action', entry.action || '', entry.detail || '', entry.source || 'Unknown', entry.mac || 'Unknown', entry.project || '', JSON.stringify(entry.metadata || null)).run());
  }

  // Vectorize significante logs (niet elke heartbeat)
  const skipTypes = ['ai_request', 'ai_response'];
  if (!skipTypes.includes(entry.type) && entry.detail && entry.detail.length > 10) {
    await queueVectorize(env, 'log', entry.id);
  }

  return entry;
}

async function handleLog(request, env) {
  const body = await request.json();
  const entry = await logActivity(env, {
    type: body.type || 'action', action: body.action, detail: body.detail,
    source: body.source || 'Unknown', mac: body.mac || 'Unknown',
    project: body.project, metadata: body.metadata,
  });
  return jsonResponse({ success: true, entry });
}

async function handleGetLogs(request, env) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit')) || 100;
  const type = url.searchParams.get('type');
  const source = url.searchParams.get('source');

  // D1 eerst
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

  // Fallback: KV
  if (!env.LOGS) return jsonResponse({ logs: [], error: 'No storage configured' });
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
// VERSIONING / SNAPSHOTS — met vectorize
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSnapshot(request, env) {
  if (!env.SNAPSHOTS) return jsonResponse({ error: 'SNAPSHOTS KV not configured' }, 500);

  const body = await request.json();
  const snapshot = {
    id: crypto.randomUUID(),
    name: body.name, project: body.project,
    type: body.type || 'manual', timestamp: new Date().toISOString(),
    commit: body.commit, branch: body.branch || 'main',
    files: body.files || [], metadata: body.metadata,
    createdBy: body.createdBy || 'Dashboard',
  };

  const key = `snapshot:${body.project}:${Date.now()}:${snapshot.id}`;
  await env.SNAPSHOTS.put(key, JSON.stringify(snapshot));

  // D1
  if (env.DB) {
    await d1Safe(() => env.DB.prepare(`
      INSERT OR REPLACE INTO snapshots (id, name, project, type, timestamp, commit_hash, branch, files, metadata, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(snapshot.id, snapshot.name, snapshot.project, snapshot.type, snapshot.timestamp,
      snapshot.commit || null, snapshot.branch, JSON.stringify(snapshot.files), JSON.stringify(snapshot.metadata || null), snapshot.createdBy
    ).run());
  }

  await logActivity(env, {
    type: 'snapshot', action: 'Snapshot created',
    detail: `${snapshot.name} (${snapshot.project})`, source: snapshot.createdBy, project: snapshot.project,
  });

  // Vectorize snapshot
  await queueVectorize(env, 'snapshot', snapshot.id);

  return jsonResponse({ success: true, snapshot });
}

async function handleGetSnapshots(request, env) {
  if (!env.SNAPSHOTS) return jsonResponse({ snapshots: [], error: 'SNAPSHOTS KV not configured' });
  const url = new URL(request.url);
  const project = url.searchParams.get('project');
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const prefix = project ? `snapshot:${project}:` : 'snapshot:';
  const list = await env.SNAPSHOTS.list({ prefix, limit: limit * 2 });
  const snapshots = [];
  for (const key of list.keys.reverse()) {
    const value = await env.SNAPSHOTS.get(key.name);
    if (value) { snapshots.push(JSON.parse(value)); if (snapshots.length >= limit) break; }
  }
  return jsonResponse({ snapshots, total: list.keys.length });
}

async function handleRestore(request, env) {
  const body = await request.json();
  if (!body.snapshotId) return jsonResponse({ error: 'snapshotId required' }, 400);
  const list = await env.SNAPSHOTS.list({ prefix: 'snapshot:' });
  let snapshot = null;
  for (const key of list.keys) {
    if (key.name.includes(body.snapshotId)) {
      const value = await env.SNAPSHOTS.get(key.name);
      if (value) { snapshot = JSON.parse(value); break; }
    }
  }
  if (!snapshot) return jsonResponse({ error: 'Snapshot not found' }, 404);
  await logActivity(env, {
    type: 'restore', action: 'Snapshot restored',
    detail: `${snapshot.name} (${snapshot.project}) → restored`,
    source: body.source || 'Dashboard', project: snapshot.project,
  });
  return jsonResponse({ success: true, snapshot, message: `Restore initiated for ${snapshot.name}. Git checkout ${snapshot.commit} required.`, command: snapshot.commit ? `git checkout ${snapshot.commit}` : null });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUMP SYNC - Cross-device sync via KV + D1 + Vectorize
// ═══════════════════════════════════════════════════════════════════════════════
const DUMP_KEY = 'dump:items';

async function handleGetDump(request, env) {
  // D1 eerst
  if (env.DB) {
    const d1Result = await d1Safe(async () => {
      return await env.DB.prepare('SELECT * FROM dump_items ORDER BY created DESC').all();
    });
    if (d1Result && d1Result.results && d1Result.results.length > 0) {
      const items = d1Result.results.map(r => ({
        ...r, analyzed: !!r.analyzed, pinned: !!r.pinned,
        extraAnalyses: r.extra_analyses ? JSON.parse(r.extra_analyses) : undefined,
        routedTo: r.routed_to ? JSON.parse(r.routed_to) : undefined,
      }));
      return jsonResponse({ items, updated: new Date().toISOString(), source: 'd1' });
    }
  }
  // Fallback: KV
  if (!env.LOGS) return jsonResponse({ items: [], error: 'No storage configured' });
  const value = await env.LOGS.get(DUMP_KEY);
  if (!value) return jsonResponse({ items: [], updated: null });
  return jsonResponse(JSON.parse(value));
}

// YouTube oEmbed metadata
async function fetchYouTubeMetadata(url) {
  try {
    const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const r = await fetch(oembed, { headers: { 'User-Agent': 'CCC-Worker/3.0' } });
    if (!r.ok) return null;
    const data = await r.json();
    return { title: data.title || '', author: data.author_name || '', thumbnail: data.thumbnail_url || '' };
  } catch (e) { return null; }
}

// OpenGraph metadata scraper (Instagram, Twitter, articles, etc.)
async function fetchOGMetadata(url) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
      },
      redirect: 'follow',
    });
    if (!r.ok) return null;
    const html = await r.text();
    const getOG = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${prop}["']`, 'i'));
      return m ? m[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"') : '';
    };
    const title = getOG('title') || (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
    const description = getOG('description');
    const image = getOG('image');
    const author = getOG('site_name') || '';
    if (!title && !description && !image) return null;
    return { title: title.trim(), author: author.trim(), thumbnail: image, description: description.trim() };
  } catch (e) { return null; }
}

async function handleAddDumpItem(request, env) {
  if (!env.LOGS) return jsonResponse({ error: 'KV not configured' }, 500);
  const body = await request.json();
  const content = (body.content || body.url || body.text || '').trim();
  const memo = (body.memo || body.note || '').trim();
  if (!content && !memo) return jsonResponse({ error: 'content or memo required' }, 400);

  const l = content.toLowerCase();
  let type = 'note', icon = '📝';
  if (l.includes('youtube.com') || l.includes('youtu.be')) { type = 'youtube'; icon = '🎬'; }
  else if (l.includes('instagram.com')) { type = 'instagram'; icon = '📸'; }
  else if (l.includes('twitter.com') || l.includes('x.com/')) { type = 'twitter'; icon = '🐦'; }
  else if (l.includes('github.com')) { type = 'github'; icon = '💻'; }
  else if (l.includes('medium.com')) { type = 'article'; icon = '📰'; }
  else if (l.startsWith('http')) { type = 'link'; icon = '🔗'; }

  const item = { id: Date.now(), content, memo, type, icon, created: new Date().toISOString(), pinned: false, source: body.source || 'shortcut' };

  if (type === 'youtube') {
    const meta = await fetchYouTubeMetadata(content);
    if (meta) { item.title = meta.title; item.author = meta.author; item.thumbnail = meta.thumbnail; }
  } else if (content.startsWith('http') && type !== 'note') {
    // Instagram, Twitter, articles, links — probeer OG metadata te scrapen
    const meta = await fetchOGMetadata(content);
    if (meta) {
      if (meta.title) item.title = meta.title;
      if (meta.author) item.author = meta.author;
      if (meta.thumbnail) item.thumbnail = meta.thumbnail;
      if (meta.description) item.memo = item.memo || meta.description;
    }
  }

  // KV
  if (env.LOGS) {
    const value = await env.LOGS.get(DUMP_KEY);
    const existing = value ? JSON.parse(value) : { items: [] };
    const items = [item, ...(existing.items || [])];
    await env.LOGS.put(DUMP_KEY, JSON.stringify({ items, updated: new Date().toISOString(), source: 'shortcut' }));
  }

  // D1
  if (env.DB) {
    await d1Safe(() => env.DB.prepare(`
      INSERT INTO dump_items (id, content, memo, type, icon, title, author, thumbnail, pinned, source, created)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(item.id, item.content, item.memo || '', type, icon, item.title || null, item.author || null, item.thumbnail || null, item.source || 'shortcut', item.created).run());
  }

  return jsonResponse({ success: true, item });
}

// Scrape endpoint: haalt pagina-tekst op voor AI analyse
async function handleScrape(request, env) {
  const body = await request.json();
  const url = (body.url || '').trim();
  if (!url) return jsonResponse({ error: 'url required' }, 400);

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
      },
      redirect: 'follow',
    });
    if (!r.ok) return jsonResponse({ error: 'Fetch failed: ' + r.status, text: '' });
    const html = await r.text();

    // Extract OG metadata
    const getOG = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${prop}["']`, 'i'));
      return m ? m[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"') : '';
    };
    const title = getOG('title') || (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
    const description = getOG('description');
    const image = getOG('image');
    const author = getOG('site_name') || '';

    // Extract visible text: strip scripts, styles, HTML tags
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    // Beperk tot 3000 chars om tokens te sparen
    if (text.length > 3000) text = text.substring(0, 3000) + '...';

    return jsonResponse({
      success: true,
      title: title.trim(),
      description: description.trim(),
      author: author.trim(),
      image,
      text,
    });
  } catch (e) {
    return jsonResponse({ error: e.message, text: '' });
  }
}

// Server-side dump analyse: scrape URL + AI analyse in één call
async function handleDumpAnalyze(request, env) {
  const body = await request.json();
  const url = (body.url || '').trim();
  const memo = (body.memo || '').trim();
  const title = (body.title || '').trim();

  // Helper: extract tekst en meta uit HTML
  function extractFromHTML(html) {
    const getOG = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${prop}["']`, 'i'));
      return m ? m[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"') : '';
    };
    const meta = {
      title: getOG('title') || (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '',
      description: getOG('description'),
      image: getOG('image'),
      author: getOG('site_name') || '',
    };
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
    if (text.length > 5000) text = text.substring(0, 5000) + '...';
    return { meta, text };
  }

  // Stap 1: Scrape URL (3 methodes: direct → Jina Reader → alleen URL)
  let scrapedContent = '';
  let scrapedMeta = {};
  if (url && url.startsWith('http')) {
    // Methode 1: Directe fetch met browser user-agent
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
        },
        redirect: 'follow',
      });
      if (r.ok) {
        const html = await r.text();
        // Check of het GEEN Cloudflare challenge is
        if (!html.includes('Just a moment...') && !html.includes('challenge-platform') && html.length > 1000) {
          const extracted = extractFromHTML(html);
          scrapedMeta = extracted.meta;
          scrapedContent = extracted.text || extracted.meta.description || '';
        }
      }
    } catch (e) { /* direct fetch failed */ }

    // Methode 2: Jina Reader API als fallback (gratis, omzeilt veel bot-protection)
    if (!scrapedContent || scrapedContent.length < 100) {
      try {
        const jr = await fetch('https://r.jina.ai/' + url, {
          headers: { 'Accept': 'application/json', 'X-No-Cache': 'true' },
        });
        if (jr.ok) {
          const jd = await jr.json();
          if (jd.data && jd.data.content && jd.data.content.length > 100 && !jd.data.content.includes('Verify you are human')) {
            scrapedContent = jd.data.content.substring(0, 5000);
            if (!scrapedMeta.title && jd.data.title) scrapedMeta.title = jd.data.title;
            if (!scrapedMeta.description && jd.data.description) scrapedMeta.description = jd.data.description;
            if (!scrapedMeta.image && jd.data.image) scrapedMeta.image = jd.data.image;
          }
        }
      } catch (e) { /* jina fallback failed */ }
    }
  }

  // Stap 2: Bouw prompt
  let prompt = 'KORT en BONDIG in het Nederlands. Max 4-5 bullet points. Geen inleidingen, geen conclusies, alleen kern-items.\n';
  if (memo) prompt += 'FOCUS: ' + memo + '\nExtraheer alleen wat relevant is voor bovenstaande focus.\n';
  if (url) prompt += 'URL: ' + url + '\n';
  if (title) prompt += 'Titel: ' + title + '\n';
  if (scrapedContent) {
    prompt += '\nInhoud van de pagina:\n' + scrapedContent + '\n';
  } else if (url.startsWith('http')) {
    // Geen content beschikbaar — vraag AI om op basis van URL + eigen kennis te analyseren
    prompt += '\nDe pagina kon niet gescraped worden (bot-protectie). Analyseer op basis van de URL en je eigen kennis over dit onderwerp. Geef je beste analyse.\n';
  } else {
    prompt += 'Content: ' + url + '\n';
  }

  // Stap 3: AI call
  try {
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const aiData = await aiResp.json();
    const analysisText = (aiData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

    return jsonResponse({
      success: true,
      analysis: analysisText || 'Analyse niet beschikbaar',
      meta: {
        title: (scrapedMeta.title || '').substring(0, 200),
        image: scrapedMeta.image || '',
        author: scrapedMeta.author || '',
        description: (scrapedMeta.description || '').substring(0, 300),
      },
      tokens: aiData.usage || {},
    });
  } catch (e) {
    return jsonResponse({ success: false, error: e.message, analysis: 'Fout bij analyse: ' + e.message });
  }
}

async function handleSaveDump(request, env) {
  const body = await request.json();
  const items = body.items || [];
  const data = { items, updated: new Date().toISOString(), source: body.source || 'unknown' };

  // KV
  if (env.LOGS) await env.LOGS.put(DUMP_KEY, JSON.stringify(data));

  // D1 sync: verwijder items die niet meer in de lijst zitten + upsert rest
  if (env.DB) {
    await d1Safe(async () => {
      // Verwijder items uit D1 die niet meer in de gepushte set zitten
      if (items.length > 0) {
        const ids = items.map(i => i.id);
        const placeholders = ids.map(() => '?').join(',');
        await env.DB.prepare(`DELETE FROM dump_items WHERE id NOT IN (${placeholders})`).bind(...ids).run();
      } else {
        // Lege lijst = alles verwijderen
        await env.DB.prepare('DELETE FROM dump_items').run();
      }
      // Upsert alle items
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

  // Vectorize geanalyseerde items
  const analyzed = items.filter(i => i.analyzed && i.analysis);
  for (const item of analyzed) {
    await queueVectorize(env, 'dump', item.id);
  }

  return jsonResponse({ success: true, count: items.length, updated: data.updated });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS PER MACHINE
// ═══════════════════════════════════════════════════════════════════════════════
const TOOLS_PREFIX = 'tools:';

async function handleGetTools(request, env) {
  if (!env.LOGS) return jsonResponse({ error: 'KV not configured' }, 500);
  const machines = {};
  for (const id of ['MM4', 'MBA', 'MM2']) {
    const value = await env.LOGS.get(TOOLS_PREFIX + id);
    if (value) machines[id] = JSON.parse(value);
  }
  return jsonResponse({ machines, updated: new Date().toISOString() });
}

async function handleSaveTools(request, env) {
  const body = await request.json();
  const machine = (body.machine || '').toUpperCase();
  if (!machine) return jsonResponse({ error: 'machine required' }, 400);
  const data = {
    plugins: body.plugins || [], mcpServers: body.mcpServers || [],
    skills: body.skills || [], vercelSkills: body.vercelSkills || [],
    scannedAt: new Date().toISOString(),
  };
  if (env.LOGS) await env.LOGS.put(TOOLS_PREFIX + machine, JSON.stringify(data));
  if (env.DB) {
    await d1Safe(() => env.DB.prepare(`
      INSERT OR REPLACE INTO machine_tools (machine, plugins, mcp_servers, skills, vercel_skills, scanned_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(machine, JSON.stringify(data.plugins), JSON.stringify(data.mcpServers), JSON.stringify(data.skills), JSON.stringify(data.vercelSkills), data.scannedAt).run());
  }
  return jsonResponse({ success: true, machine, scannedAt: data.scannedAt });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH — D1 SQL queries op ALLE tabellen
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSearch(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured', results: [] });
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const type = url.searchParams.get('type');
  const tab = url.searchParams.get('tab');
  const limit = parseInt(url.searchParams.get('limit')) || 20;

  if (q) {
    const pattern = `%${q}%`;
    // Zoek in dump_items
    const dumpResults = await d1Safe(async () => {
      let sql = `SELECT *, 'dump' as _source FROM dump_items WHERE (content LIKE ? OR memo LIKE ? OR title LIKE ? OR analysis LIKE ?)`;
      const params = [pattern, pattern, pattern, pattern];
      if (type) { sql += ' AND type = ?'; params.push(type); }
      sql += ' ORDER BY created DESC LIMIT ?';
      params.push(limit);
      return await env.DB.prepare(sql).bind(...params).all();
    });

    // Zoek in knowledge_items
    const knowledgeResults = await d1Safe(async () => {
      return await env.DB.prepare(
        `SELECT *, 'knowledge' as _source FROM knowledge_items WHERE (title LIKE ? OR content LIKE ? OR summary LIKE ? OR tags LIKE ?) ORDER BY created_at DESC LIMIT ?`
      ).bind(pattern, pattern, pattern, pattern, limit).all();
    });

    // Zoek in activity_logs
    const logResults = await d1Safe(async () => {
      return await env.DB.prepare(
        `SELECT *, 'log' as _source FROM activity_logs WHERE (action LIKE ? OR detail LIKE ? OR project LIKE ?) ORDER BY timestamp DESC LIMIT ?`
      ).bind(pattern, pattern, pattern, Math.min(limit, 10)).all();
    });

    const results = [
      ...(dumpResults?.results || []).map(r => ({ ...r, _source: 'dump' })),
      ...(knowledgeResults?.results || []).map(r => ({ ...r, _source: 'knowledge' })),
      ...(logResults?.results || []).map(r => ({ ...r, _source: 'log' })),
    ];

    return jsonResponse({ results, query: q, counts: {
      dump: dumpResults?.results?.length || 0,
      knowledge: knowledgeResults?.results?.length || 0,
      log: logResults?.results?.length || 0,
    }});
  }

  if (tab) {
    const results = await d1Safe(async () => {
      return await env.DB.prepare('SELECT * FROM routed_items WHERE target_tab = ? ORDER BY routed_at DESC LIMIT ?').bind(tab, limit).all();
    });
    return jsonResponse({ results: results?.results || [], tab });
  }

  return jsonResponse({ error: 'q or tab parameter required', results: [] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE — Sla gerouteerde analyse op in D1 + vectorize
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

  // Vectorize de gerouteerde analyse
  if (result && result.meta?.last_row_id) {
    await queueVectorize(env, 'routed', result.meta.last_row_id);
  }

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
    const knowledge = await env.DB.prepare('SELECT category, COUNT(*) as count FROM knowledge_items GROUP BY category ORDER BY count DESC').all();
    const vectors = await env.DB.prepare('SELECT source_type, COUNT(*) as count FROM vectorize_log GROUP BY source_type ORDER BY count DESC').all();
    return { dumps, logs, routes: routes?.results || [], types: types?.results || [], knowledge: knowledge?.results || [], vectors: vectors?.results || [] };
  });
  return jsonResponse(stats || { error: 'Query failed' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEMANTIC SEARCH — Universeel over alle gevectorized data
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSemanticSearch(request, env) {
  if (!env.VECTORIZE || !env.AI || !env.DB) {
    return jsonResponse({ error: 'Vectorize/AI/D1 not configured', results: [] });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const sourceType = url.searchParams.get('type'); // optioneel: filter op source_type
  const topK = parseInt(url.searchParams.get('limit')) || 15;
  if (!q) return jsonResponse({ error: 'q parameter required', results: [] });

  // Genereer embedding
  const resp = await d1Safe(async () => await env.AI.run('@cf/baai/bge-large-en-v1.5', { text: [q] }));
  const embedding = resp?.data?.[0];
  if (!embedding) return jsonResponse({ error: 'Embedding generation failed', results: [] });

  // Query Vectorize — optioneel gefilterd op source_type
  const queryOpts = { topK, returnMetadata: 'all' };
  if (sourceType) {
    queryOpts.filter = { source_type: sourceType };
  }
  const matches = await d1Safe(async () => await env.VECTORIZE.query(embedding, queryOpts));
  if (!matches || !matches.matches) return jsonResponse({ results: [] });

  // Haal volledige items op uit juiste tabel
  const results = [];
  for (const match of matches.matches) {
    const [type, id] = match.id.includes(':') ? match.id.split(':', 2) : ['dump', match.id];
    let item = null;

    if (type === 'dump') {
      item = await d1Safe(() => env.DB.prepare('SELECT * FROM dump_items WHERE id = ?').bind(parseInt(id)).first());
    } else if (type === 'knowledge') {
      item = await d1Safe(() => env.DB.prepare('SELECT * FROM knowledge_items WHERE id = ?').bind(id).first());
    } else if (type === 'log') {
      item = await d1Safe(() => env.DB.prepare('SELECT * FROM activity_logs WHERE id = ?').bind(id).first());
    } else if (type === 'snapshot') {
      item = await d1Safe(() => env.DB.prepare('SELECT * FROM snapshots WHERE id = ?').bind(id).first());
    } else if (type === 'routed') {
      item = await d1Safe(() => env.DB.prepare('SELECT * FROM routed_items WHERE id = ?').bind(parseInt(id)).first());
    }

    if (item) {
      results.push({ ...item, _source: type, _score: match.score, _metadata: match.metadata });
    }
  }

  return jsonResponse({ results, query: q, total: results.length });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIVERSAL INGEST — Voeg knowledge items toe vanuit elke bron
// ═══════════════════════════════════════════════════════════════════════════════
async function handleIngest(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);
  const body = await request.json();

  // Enkele item of batch
  const items = body.items || [body];
  const results = [];

  for (const item of items) {
    if (!item.content && !item.title) continue;

    const id = item.id || `ki-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const ki = {
      id,
      category: item.category || 'general',
      subcategory: item.subcategory || null,
      title: item.title || '',
      content: item.content || '',
      summary: item.summary || null,
      tags: Array.isArray(item.tags) ? item.tags.join(',') : (item.tags || null),
      source: item.source || 'api',
      source_machine: item.sourceMachine || item.source_machine || null,
      project: item.project || null,
      tab: item.tab || null,
      metadata: item.metadata ? JSON.stringify(item.metadata) : null,
    };

    await d1Safe(() => env.DB.prepare(`
      INSERT OR REPLACE INTO knowledge_items (id, category, subcategory, title, content, summary, tags, source, source_machine, project, tab, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(ki.id, ki.category, ki.subcategory, ki.title, ki.content, ki.summary, ki.tags, ki.source, ki.source_machine, ki.project, ki.tab, ki.metadata).run());

    // Direct vectorize via queue
    await queueVectorize(env, 'knowledge', ki.id);

    results.push({ id: ki.id, category: ki.category, title: ki.title });
  }

  await logActivity(env, {
    type: 'ingest', action: 'Knowledge ingested',
    detail: `${results.length} items (${items[0]?.category || 'general'})`,
    source: body.source || 'api',
  });

  return jsonResponse({ success: true, ingested: results.length, items: results });
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE QUERY — Haal knowledge items op
// ═══════════════════════════════════════════════════════════════════════════════
async function handleGetKnowledge(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured', items: [] });
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const tab = url.searchParams.get('tab');
  const project = url.searchParams.get('project');
  const limit = parseInt(url.searchParams.get('limit')) || 50;

  let sql = 'SELECT * FROM knowledge_items WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (tab) { sql += ' AND tab = ?'; params.push(tab); }
  if (project) { sql += ' AND project = ?'; params.push(project); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const result = await d1Safe(async () => {
    return await env.DB.prepare(sql).bind(...params).all();
  });

  return jsonResponse({ items: result?.results || [], total: result?.results?.length || 0 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// VECTORIZE-ALL — Retroactieve bulk vectorisatie van ALLE bestaande data
// ═══════════════════════════════════════════════════════════════════════════════
async function handleVectorizeAll(request, env) {
  if (!env.DB || !env.ANALYZE_QUEUE) return jsonResponse({ error: 'D1/Queue not configured' }, 500);
  const body = await request.json();
  const types = body.types || ['dump', 'log', 'snapshot', 'knowledge', 'routed'];
  const batchSize = body.batchSize || 50;
  const stats = {};

  for (const type of types) {
    let rows = [];

    if (type === 'dump') {
      const r = await d1Safe(() => env.DB.prepare(`
        SELECT d.id FROM dump_items d
        LEFT JOIN vectorize_log v ON v.vector_id = 'dump:' || d.id
        WHERE d.analyzed = 1 AND d.analysis IS NOT NULL AND v.vector_id IS NULL
        LIMIT ?
      `).bind(batchSize).all());
      rows = r?.results || [];
    } else if (type === 'log') {
      const r = await d1Safe(() => env.DB.prepare(`
        SELECT l.id FROM activity_logs l
        LEFT JOIN vectorize_log v ON v.vector_id = 'log:' || l.id
        WHERE l.detail IS NOT NULL AND LENGTH(l.detail) > 10
        AND l.type NOT IN ('ai_request', 'ai_response')
        AND v.vector_id IS NULL
        LIMIT ?
      `).bind(batchSize).all());
      rows = r?.results || [];
    } else if (type === 'snapshot') {
      const r = await d1Safe(() => env.DB.prepare(`
        SELECT s.id FROM snapshots s
        LEFT JOIN vectorize_log v ON v.vector_id = 'snapshot:' || s.id
        WHERE v.vector_id IS NULL
        LIMIT ?
      `).bind(batchSize).all());
      rows = r?.results || [];
    } else if (type === 'knowledge') {
      const r = await d1Safe(() => env.DB.prepare(`
        SELECT k.id FROM knowledge_items k
        LEFT JOIN vectorize_log v ON v.vector_id = 'knowledge:' || k.id
        WHERE v.vector_id IS NULL
        LIMIT ?
      `).bind(batchSize).all());
      rows = r?.results || [];
    } else if (type === 'routed') {
      const r = await d1Safe(() => env.DB.prepare(`
        SELECT r.id FROM routed_items r
        LEFT JOIN vectorize_log v ON v.vector_id = 'routed:' || r.id
        WHERE v.vector_id IS NULL
        LIMIT ?
      `).bind(batchSize).all());
      rows = r?.results || [];
    }

    // Queue ze allemaal
    for (const row of rows) {
      await d1Safe(() => env.ANALYZE_QUEUE.send({ sourceType: type, sourceId: row.id, action: 'vectorize' }));
    }
    stats[type] = { queued: rows.length };
  }

  await logActivity(env, {
    type: 'vectorize_batch', action: 'Retroactive vectorize started',
    detail: JSON.stringify(stats), source: body.source || 'api',
  });

  return jsonResponse({ success: true, stats, message: 'Vectorize jobs queued. Queue will process them async.' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECTIVES — Togglebare prompt-context items
// ═══════════════════════════════════════════════════════════════════════════════

async function handleGetDirectives(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);
  const url = new URL(request.url);
  const activeOnly = url.searchParams.get('active') === 'true';
  const category = url.searchParams.get('category');

  let sql = 'SELECT * FROM directives';
  const conditions = [];
  const binds = [];

  if (activeOnly) { conditions.push('active = 1'); }
  if (category) { conditions.push('category = ?'); binds.push(category); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY priority DESC, name ASC';

  const stmt = env.DB.prepare(sql);
  const result = await d1Safe(() => (binds.length ? stmt.bind(...binds) : stmt).all());
  return jsonResponse({ directives: result?.results || [] });
}

async function handleSaveDirective(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);
  const body = await request.json();
  const { id, name, category, description, content, icon, color, active, priority, source, machine } = body;
  const directiveId = id || 'dir-' + Date.now();

  await d1Safe(() => env.DB.prepare(`
    INSERT OR REPLACE INTO directives (id, name, category, description, content, icon, color, active, priority, source, machine, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    directiveId, name || 'Unnamed', category || 'custom', description || '',
    content || '', icon || '📌', color || '#8b5cf6', active ? 1 : 0,
    priority || 0, source || 'manual', machine || null
  ).run());

  return jsonResponse({ success: true, id: directiveId });
}

async function handleToggleDirective(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);
  const body = await request.json();
  const { id, active } = body;
  if (!id) return jsonResponse({ error: 'id required' }, 400);

  await d1Safe(() => env.DB.prepare(
    "UPDATE directives SET active = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(active ? 1 : 0, id).run());

  return jsonResponse({ success: true, id, active: !!active });
}

async function handleDeleteDirective(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return jsonResponse({ error: 'id required' }, 400);

  await d1Safe(() => env.DB.prepare('DELETE FROM directives WHERE id = ?').bind(id).run());
  return jsonResponse({ success: true, deleted: id });
}

async function handleSeedDirectives(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);

  const presets = [
    {
      id: 'dir-vercel-react', name: 'Vercel React Patterns', category: 'skills',
      description: 'React best practices, composition patterns, web design guidelines van Vercel Agent Skills',
      content: `Volg deze Vercel coding standaarden:
- React: functionele componenten, hooks, geen class components
- Composition: kleine herbruikbare componenten, props voor configuratie
- Styling: CSS-in-JS of Tailwind, responsive-first
- Performance: React.memo, useMemo, useCallback waar nodig
- Geen prop drilling: gebruik Context of state management
- Error boundaries rond elke feature
- Accessible: ARIA labels, keyboard nav, semantic HTML`,
      icon: '⚛️', color: '#00d8ff', priority: 5
    },
    {
      id: 'dir-sdk-hrm', name: 'SDK-HRM Scam Detection', category: 'project',
      description: 'Context over het SDK-HRM scam detection project, benchmark data, rule engine specs',
      content: `SDK-HRM Project Context:
- LFM2-2.6B model, 4-bit MLX, LoRA fine-tuned
- OOD benchmark: 78.9% (445 scenarios, 12 categorieën, NL/FR/EN)
- Hybrid: model + rule engine v1 (38 hits, 15 overrides, 23 confirms)
- Zwakke plekken: adversarial_borderline_safe (17.9%), BEC/invoice (50%), QR code (63.6%)
- Rule engine pad: /Volumes/8TB MM4/AI-Models/LFM2-2.6B-4bit-MLX/rule_engine.py
- Volgende stap: rule engine v2, data opschalen naar 10.000+`,
      icon: '🛡️', color: '#f97316', priority: 3
    },
    {
      id: 'dir-ccc-dev', name: 'CCC Development', category: 'project',
      description: 'Cloud Control Center development context — Worker API, D1 schema, App.jsx structuur',
      content: `CCC Development Context:
- Frontend: React 18, Vite 5, single App.jsx (~5500 lines), 22 tabs
- Backend: Cloudflare Worker v3.0.0, D1 database, Vectorize, Queue
- Deploy: Cloudflare Pages (claude-ecosystem-dashboard.pages.dev)
- Worker: claude-control-center.franky-f29.workers.dev
- Coding stijl: JSX (NIET createElement), inline styles, geen externe UI libs
- Device context: DeviceContext met isPhone/S scaling
- Altijd backup maken voor grote wijzigingen
- Version bumpen in 3 locaties (header comment, footer, settings)`,
      icon: '🎛️', color: '#22c55e', priority: 3
    },
    {
      id: 'dir-dutch', name: 'Nederlands Strikt', category: 'language',
      description: 'Alle output in het Nederlands',
      content: `Communiceer uitsluitend in het Nederlands. Code comments mogen Engels zijn, maar alle uitleg, feedback, en beschrijvingen in het Nederlands.`,
      icon: '🇳🇱', color: '#ff6600', priority: 1
    },
    {
      id: 'dir-privacy', name: 'Privacy Audit Mode', category: 'security',
      description: 'Check elke wijziging op data-lekkage, geen cloud uploads zonder toestemming',
      content: `Privacy-first modus:
- GEEN data naar externe services sturen zonder expliciete toestemming
- Check alle API calls op PII lekkage
- Geen analytics, tracking, of telemetry toevoegen
- Lokale opslag prefereren boven cloud
- Wijs op privacy risico's bij elke externe integratie`,
      icon: '🔒', color: '#ef4444', priority: 8
    },
    {
      id: 'dir-no-overengineer', name: 'Geen Over-Engineering', category: 'coding',
      description: 'Minimale code, geen abstracties tenzij nodig, direct en simpel',
      content: `Coding regels:
- Geen helpers/utilities voor eenmalige operaties
- Geen feature flags of backwards-compatibility shims
- 3 gelijke regels code is beter dan een premature abstractie
- Alleen error handling op systeemgrenzen (user input, APIs)
- Geen docstrings/comments tenzij logica niet self-evident is
- Doe exact wat gevraagd wordt, niet meer`,
      icon: '✂️', color: '#f59e0b', priority: 4
    },
    {
      id: 'dir-crypto', name: 'Crypto Intelligence', category: 'project',
      description: 'Crypto markt context, portfolio tracking, DeFi research',
      content: `Crypto context:
- Focus op fundamentele analyse, niet day-trading
- Portfolio: BTC, ETH, SOL als kern
- DeFi research: yield farming, liquidity pools
- Risico bewustzijn: nooit meer investeren dan je kunt verliezen
- Bronnen: on-chain data, protocol documentatie, whitepapers`,
      icon: '🪙', color: '#f59e0b', priority: 2
    },
    {
      id: 'dir-training', name: 'ML Training Mode', category: 'project',
      description: 'Machine learning training context — MPS gotchas, checkpoints, eval veiligheid',
      content: `ML Training regels voor MPS (Mac):
- ALTIJD checkpoint VOOR evaluatie, niet erna
- Geen while True in eval loops — gebruik for cycle in range(MAX)
- MPS kernel hangs zijn onafbreekbaar vanuit Python
- float32 only op MPS (geen float16/bfloat16)
- Checkpoint interval: elke 100 steps, max 5 bewaren
- Eval timeout: 120s max tussen batches
- Optimizer state VOOR .to(device) aanmaken`,
      icon: '🧠', color: '#60a5fa', priority: 3
    },
  ];

  let seeded = 0;
  for (const p of presets) {
    const existing = await d1Safe(() => env.DB.prepare('SELECT id FROM directives WHERE id = ?').bind(p.id).first());
    if (!existing) {
      await d1Safe(() => env.DB.prepare(`
        INSERT INTO directives (id, name, category, description, content, icon, color, active, priority, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'preset')
      `).bind(p.id, p.name, p.category, p.description, p.content, p.icon, p.color, p.priority).run());
      seeded++;
    }
  }

  return jsonResponse({ success: true, seeded, total: presets.length, message: `${seeded} new presets added` });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TODOS — Simpele cross-device takenlijst
// ═══════════════════════════════════════════════════════════════════════════════

async function handleGetTodos(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);
  const url = new URL(request.url);
  const status = url.searchParams.get('status'); // open, done, all
  const project = url.searchParams.get('project');

  let sql = 'SELECT * FROM todos';
  const conditions = [];
  const binds = [];

  if (status && status !== 'all') { conditions.push('status = ?'); binds.push(status); }
  if (project) { conditions.push('project = ?'); binds.push(project); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY CASE status WHEN \'open\' THEN 0 WHEN \'done\' THEN 1 END, created_at DESC';

  const stmt = env.DB.prepare(sql);
  const result = await d1Safe(() => (binds.length ? stmt.bind(...binds) : stmt).all());
  return jsonResponse({ todos: result?.results || [] });
}

async function handleCreateTodo(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);
  const body = await request.json();
  const { text, notes, priority, project } = body;
  if (!text) return jsonResponse({ error: 'text required' }, 400);

  const result = await d1Safe(() => env.DB.prepare(
    "INSERT INTO todos (text, notes, priority, project) VALUES (?, ?, ?, ?)"
  ).bind(text, notes || null, priority || 'normal', project || null).run());

  return jsonResponse({ success: true, id: result?.meta?.last_row_id });
}

async function handleUpdateTodo(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);
  const body = await request.json();
  const { id, text, notes, status, priority, project } = body;
  if (!id) return jsonResponse({ error: 'id required' }, 400);

  const fields = [];
  const binds = [];
  if (text !== undefined) { fields.push('text = ?'); binds.push(text); }
  if (notes !== undefined) { fields.push('notes = ?'); binds.push(notes); }
  if (status !== undefined) { fields.push('status = ?'); binds.push(status); }
  if (priority !== undefined) { fields.push('priority = ?'); binds.push(priority); }
  if (project !== undefined) { fields.push('project = ?'); binds.push(project); }
  fields.push("updated_at = datetime('now')");
  binds.push(id);

  await d1Safe(() => env.DB.prepare(
    `UPDATE todos SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...binds).run());

  return jsonResponse({ success: true, id });
}

async function handleDeleteTodo(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 not configured' }, 500);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return jsonResponse({ error: 'id required' }, 400);

  await d1Safe(() => env.DB.prepare('DELETE FROM todos WHERE id = ?').bind(id).run());
  return jsonResponse({ success: true, deleted: id });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

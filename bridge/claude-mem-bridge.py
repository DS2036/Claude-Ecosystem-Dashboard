#!/usr/bin/env python3
"""
Claude Memory Bridge v1.0
=========================
Unified memory injection for ALL Claude interfaces:
- Claude Chat (via mac-hub MCP from claude.ai)
- Claude Code CLI (native via claude-mem plugin)
- Cowork (via this bridge)

Usage:
  python3 claude-mem-bridge.py inject \
    --source "claude-chat" \
    --project "Econation" \
    --type "discovery" \
    --title "Cloudflare deployment workflow" \
    --text "Dashboard deployed to Cloudflare Pages using wrangler CLI" \
    --facts "wrangler pages deploy dist|project: claude-ecosystem-dashboard|URL: claude-ecosystem-dashboard.pages.dev" \
    --concepts "cloudflare,deployment,dashboard,wrangler"

  python3 claude-mem-bridge.py search "cloudflare deployment"
  python3 claude-mem-bridge.py stats
  python3 claude-mem-bridge.py export --format json
"""

import sqlite3
import argparse
import json
import time
import uuid
import os
import sys
from datetime import datetime

DB_PATH = os.path.expanduser("~/.claude-mem/claude-mem.db")

VALID_TYPES = ['decision', 'bugfix', 'feature', 'refactor', 'discovery', 'change']
VALID_SOURCES = ['claude-chat', 'claude-cli', 'cowork', 'manual', 'auto-sync']

def get_db():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database niet gevonden: {DB_PATH}")
        sys.exit(1)
    return sqlite3.connect(DB_PATH)

def inject(args):
    """Inject a new observation into claude-mem"""
    db = get_db()
    
    session_id = f"{args.source}-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"
    now = datetime.now()
    epoch = int(now.timestamp())
    created_at = now.isoformat()
    
    # Tag title with source
    source_tag = {
        'claude-chat': '[CHAT]',
        'claude-cli': '[CLI]',
        'cowork': '[COWORK]',
        'manual': '[MANUAL]',
        'auto-sync': '[SYNC]'
    }.get(args.source, '[BRIDGE]')
    
    title = f"{source_tag} {args.title}"
    
    # Build narrative from text + source metadata
    narrative = args.text or ""
    if args.source:
        narrative += f"\n\n[Source: {args.source} | Injected: {created_at}]"
    
    try:
        db.execute("""
            INSERT INTO observations 
            (memory_session_id, project, text, type, title, subtitle, facts, narrative, concepts, 
             files_read, files_modified, prompt_number, created_at, created_at_epoch, discovery_tokens)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            session_id,
            args.project or "general",
            args.text or "",
            args.type if args.type in VALID_TYPES else "discovery",
            title,
            args.subtitle or "",
            args.facts or "",
            narrative,
            args.concepts or "",
            args.files_read or "",
            args.files_modified or "",
            0,
            created_at,
            epoch,
            len(args.text or "") // 4  # rough token estimate
        ))
        
        obs_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        db.commit()
        
        print(f"✅ Observation #{obs_id} geïnjecteerd")
        print(f"   Source:  {args.source}")
        print(f"   Project: {args.project or 'general'}")
        print(f"   Type:    {args.type}")
        print(f"   Title:   {title}")
        
        return obs_id
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None
    finally:
        db.close()

def search(args):
    """Full-text search across all observations"""
    db = get_db()
    try:
        rows = db.execute("""
            SELECT o.id, o.title, o.project, o.type, o.created_at, 
                   snippet(observations_fts, 3, '>>>', '<<<', '...', 40) as snippet
            FROM observations_fts 
            JOIN observations o ON o.id = observations_fts.rowid
            WHERE observations_fts MATCH ?
            ORDER BY o.created_at_epoch DESC
            LIMIT ?
        """, (args.query, args.limit or 10)).fetchall()
        
        if not rows:
            print(f"🔍 Geen resultaten voor '{args.query}'")
            return
        
        print(f"🔍 {len(rows)} resultaten voor '{args.query}':\n")
        for row in rows:
            print(f"  #{row[0]} | {row[1]}")
            print(f"    📁 {row[2]} | 🏷️ {row[3]} | 📅 {row[4][:10]}")
            if row[5]:
                print(f"    💬 {row[5][:120]}")
            print()
            
    finally:
        db.close()

def stats(args):
    """Show memory statistics"""
    db = get_db()
    try:
        total = db.execute("SELECT COUNT(*) FROM observations").fetchone()[0]
        by_type = db.execute("SELECT type, COUNT(*) FROM observations GROUP BY type ORDER BY COUNT(*) DESC").fetchall()
        by_project = db.execute("SELECT project, COUNT(*) FROM observations GROUP BY project ORDER BY COUNT(*) DESC").fetchall()
        
        # Count by source tag
        sources = {
            'CHAT': db.execute("SELECT COUNT(*) FROM observations WHERE title LIKE '%[CHAT]%'").fetchone()[0],
            'CLI': db.execute("SELECT COUNT(*) FROM observations WHERE title LIKE '%[CLI]%' OR title NOT LIKE '%[%'").fetchone()[0],
            'BRAIN': db.execute("SELECT COUNT(*) FROM observations WHERE title LIKE '%[BRAIN]%'").fetchone()[0],
            'COWORK': db.execute("SELECT COUNT(*) FROM observations WHERE title LIKE '%[COWORK]%'").fetchone()[0],
            'SYNC': db.execute("SELECT COUNT(*) FROM observations WHERE title LIKE '%[SYNC]%'").fetchone()[0],
        }
        
        db_size = os.path.getsize(DB_PATH) / 1024 / 1024
        
        print("=" * 50)
        print("🧠 Claude-Mem Unified Memory Stats")
        print("=" * 50)
        print(f"\n📊 Totaal: {total} observations ({db_size:.1f} MB)")
        
        print(f"\n📡 Per bron:")
        for src, count in sources.items():
            bar = "█" * count + "░" * (total - count)
            print(f"  {src:8s} {count:3d} {bar[:20]}")
        
        print(f"\n🏷️  Per type:")
        for t, c in by_type:
            print(f"  {t:12s} {c}")
            
        print(f"\n📁 Per project:")
        for p, c in by_project:
            print(f"  {p:30s} {c}")
            
    finally:
        db.close()

def export_data(args):
    """Export all observations as JSON"""
    db = get_db()
    db.row_factory = sqlite3.Row
    try:
        rows = db.execute("SELECT * FROM observations ORDER BY created_at_epoch DESC").fetchall()
        data = [dict(row) for row in rows]
        
        output = args.output or f"claude-mem-export-{datetime.now().strftime('%Y%m%d')}.json"
        with open(output, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        print(f"✅ {len(data)} observations geëxporteerd naar {output}")
        
    finally:
        db.close()

def batch_inject(args):
    """Inject multiple observations from a JSON file"""
    with open(args.file, 'r') as f:
        items = json.load(f)
    
    count = 0
    for item in items:
        inject_args = argparse.Namespace(
            source=item.get('source', 'auto-sync'),
            project=item.get('project', 'general'),
            type=item.get('type', 'discovery'),
            title=item.get('title', 'Untitled'),
            subtitle=item.get('subtitle', ''),
            text=item.get('text', ''),
            facts=item.get('facts', ''),
            concepts=item.get('concepts', ''),
            files_read=item.get('files_read', ''),
            files_modified=item.get('files_modified', '')
        )
        if inject(inject_args):
            count += 1
    
    print(f"\n✅ Batch complete: {count}/{len(items)} geïnjecteerd")

def main():
    parser = argparse.ArgumentParser(description="Claude Memory Bridge - Unified memory injection")
    sub = parser.add_subparsers(dest="command")
    
    # inject
    p_inject = sub.add_parser("inject", help="Inject observation")
    p_inject.add_argument("--source", choices=VALID_SOURCES, required=True)
    p_inject.add_argument("--project", default="general")
    p_inject.add_argument("--type", choices=VALID_TYPES, default="discovery")
    p_inject.add_argument("--title", required=True)
    p_inject.add_argument("--subtitle", default="")
    p_inject.add_argument("--text", default="")
    p_inject.add_argument("--facts", default="")
    p_inject.add_argument("--concepts", default="")
    p_inject.add_argument("--files-read", default="", dest="files_read")
    p_inject.add_argument("--files-modified", default="", dest="files_modified")
    
    # search
    p_search = sub.add_parser("search", help="Search memories")
    p_search.add_argument("query")
    p_search.add_argument("--limit", type=int, default=10)
    
    # stats
    sub.add_parser("stats", help="Show statistics")
    
    # export
    p_export = sub.add_parser("export", help="Export data")
    p_export.add_argument("--output", default=None)
    
    # batch
    p_batch = sub.add_parser("batch", help="Batch inject from JSON")
    p_batch.add_argument("file")
    
    args = parser.parse_args()
    
    if args.command == "inject":
        inject(args)
    elif args.command == "search":
        search(args)
    elif args.command == "stats":
        stats(args)
    elif args.command == "export":
        export_data(args)
    elif args.command == "batch":
        batch_inject(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

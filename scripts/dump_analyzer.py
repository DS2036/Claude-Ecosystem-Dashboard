#!/usr/bin/env python3
"""
DUMP ANALYZER — Lokale analyse daemon voor CCC Dump items
Draait op Mac Mini M4, pollt de cloud, analyseert alles lokaal.

Flow:
  1. Haal dump items op van Cloudflare Worker (GET /api/dump)
  2. Filter items zonder analyse (analyzed == false)
  3. Per type: download content, analyseer met Claude API
  4. Schrijf resultaten terug naar cloud (POST /api/dump)

Gebruik:
  python3 scripts/dump_analyzer.py              # Eenmalig draaien
  python3 scripts/dump_analyzer.py --daemon     # Continue polling (elke 60s)
  python3 scripts/dump_analyzer.py --interval 30  # Custom interval

Types:
  youtube   → yt-dlp transcript → Claude analyse
  article   → Webpagina tekst → Claude samenvatting
  link      → Webpagina tekst → Claude samenvatting
  instagram → URL context → Claude analyse
  twitter   → URL context → Claude analyse
  github    → URL context → Claude analyse
  note      → Direct → Claude analyse
"""

import json
import os
import sys
import time
import signal
import argparse
import subprocess
import httpx
from datetime import datetime
from pathlib import Path

# ── Config ──
WORKER_API = "https://claude-control-center.franky-f29.workers.dev"
ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 2000
POLL_INTERVAL = 60  # seconds
# Als geen lokale key, gebruik Worker als proxy
USE_WORKER_PROXY = not bool(ANTHROPIC_KEY)

# ── Logging ──
def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")

def log_err(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] ERROR: {msg}", file=sys.stderr)

# ── Cloud API ──
def get_dump_items():
    """Haal alle dump items op van de cloud."""
    try:
        r = httpx.get(f"{WORKER_API}/api/dump", timeout=15)
        data = r.json()
        return data.get("items", [])
    except Exception as e:
        log_err(f"GET dump failed: {e}")
        return []

def save_dump_items(items):
    """Sla alle dump items op naar de cloud."""
    try:
        r = httpx.post(f"{WORKER_API}/api/dump", json={"items": items, "source": "MM4-analyzer"}, timeout=15)
        data = r.json()
        log(f"Saved {data.get('count', '?')} items to cloud")
        return True
    except Exception as e:
        log_err(f"POST dump failed: {e}")
        return False

# ── Content Fetchers ──
def fetch_youtube_transcript(url):
    """Haal YouTube transcript op via yt-dlp."""
    try:
        # Probeer eerst auto-generated subtitles
        result = subprocess.run(
            ["yt-dlp", "--skip-download", "--write-auto-sub", "--sub-lang", "en,nl",
             "--convert-subs", "srt", "--print", "title", "--print", "description",
             "-o", "/tmp/yt_dump_%(id)s", url],
            capture_output=True, text=True, timeout=30
        )
        title = ""
        description = ""
        lines = result.stdout.strip().split("\n")
        if len(lines) >= 1:
            title = lines[0]
        if len(lines) >= 2:
            description = "\n".join(lines[1:])

        # Zoek subtitle bestand
        import glob
        sub_files = glob.glob("/tmp/yt_dump_*.srt")
        transcript = ""
        if sub_files:
            with open(sub_files[0], "r") as f:
                transcript = f.read()
            # Cleanup
            for sf in sub_files:
                os.remove(sf)
            # Strip SRT formatting (nummers + timestamps)
            clean_lines = []
            for line in transcript.split("\n"):
                line = line.strip()
                if not line:
                    continue
                if line.isdigit():
                    continue
                if "-->" in line:
                    continue
                if line not in clean_lines[-3:] if clean_lines else True:
                    clean_lines.append(line)
            transcript = " ".join(clean_lines)

        return {
            "title": title[:200] if title else "",
            "description": description[:500] if description else "",
            "transcript": transcript[:8000] if transcript else "",
        }
    except FileNotFoundError:
        log("yt-dlp niet gevonden — installeer met: brew install yt-dlp")
        return {"title": "", "description": "", "transcript": "(yt-dlp niet beschikbaar)"}
    except Exception as e:
        log_err(f"YouTube fetch failed: {e}")
        return {"title": "", "description": "", "transcript": ""}

def fetch_webpage_text(url):
    """Haal tekst op van een webpagina."""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CCC-Analyzer/1.0"}
        r = httpx.get(url, headers=headers, timeout=15, follow_redirects=True)
        html = r.text

        # Simpele HTML → tekst extractie (geen beautifulsoup nodig)
        import re
        # Verwijder scripts en styles
        html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
        # Verwijder HTML tags
        text = re.sub(r"<[^>]+>", " ", html)
        # Decode HTML entities
        text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        text = text.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
        # Normaliseer whitespace
        text = re.sub(r"\s+", " ", text).strip()

        # Extract title
        title_match = re.search(r"<title[^>]*>(.*?)</title>", r.text, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else ""

        return {
            "title": title[:200],
            "text": text[:8000],
        }
    except Exception as e:
        log_err(f"Webpage fetch failed for {url}: {e}")
        return {"title": "", "text": ""}

# ── Claude API ──
def ask_claude(prompt, max_tokens=MAX_TOKENS):
    """Vraag Claude om analyse — via Worker proxy of direct."""
    try:
        if USE_WORKER_PROXY:
            # Gebruik de bestaande Worker /api/ai als proxy
            r = httpx.post(
                f"{WORKER_API}/api/ai",
                json={
                    "messages": [{"role": "user", "content": prompt}],
                    "model": MODEL,
                    "max_tokens": max_tokens,
                },
                timeout=60,
            )
        else:
            # Direct naar Anthropic API
            r = httpx.post(
                ANTHROPIC_API,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_KEY,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": MODEL,
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=60,
            )

        data = r.json()
        if "content" in data:
            return "".join(b.get("text", "") for b in data["content"] if b.get("type") == "text")
        if "error" in data:
            return f"API fout: {data['error'].get('message', 'onbekend')}"
        return "Geen analyse beschikbaar"
    except Exception as e:
        log_err(f"Claude API failed: {e}")
        return f"Analyse fout: {e}"

# ── Targeted vs Generic prompt builder ──
def build_targeted_prompt(memo, content_desc, content_text):
    """Als memo aanwezig: targeted extraction. Anders: generieke analyse."""
    if memo and memo.strip():
        return f"""Je bent een kennisextractor. De gebruiker heeft specifiek aangegeven wat ze zoeken.

ZOEKFOCUS: {memo}

Extraheer ALLEEN de informatie die relevant is voor bovenstaande focus uit de content hieronder.
Geef het resultaat in het Nederlands als een gestructureerd overzicht:
- Kernpunten over het gevraagde onderwerp (bullet points)
- Concrete details, stappen, of instructies indien aanwezig
- Eventuele tips of waarschuwingen
- Als de content NIET over het gevraagde onderwerp gaat, zeg dat kort.

Wees bondig en praktisch. Geen generieke samenvatting — alleen wat de gebruiker zoekt.

{content_desc}
{content_text}"""
    else:
        return f"""Analyseer deze content grondig in het Nederlands. Geef:
1. Onderwerp en kernboodschap (2-3 zinnen)
2. Belangrijkste inzichten/takeaways (3-5 bullet points)
3. Relevantie en bruikbaarheid

{content_desc}
{content_text}

Geef een heldere, bruikbare analyse."""

# ── Analyzers per type ──
def analyze_youtube(item):
    """Analyseer YouTube video via transcript — targeted als memo aanwezig."""
    yt_data = fetch_youtube_transcript(item["content"])

    content_desc = f"""Video URL: {item['content']}
Titel: {yt_data['title']}
Beschrijving: {yt_data['description'][:300]}"""

    content_text = ""
    if yt_data["transcript"]:
        content_text = f"\nTranscript (fragment): {yt_data['transcript'][:5000]}"

    prompt = build_targeted_prompt(item.get("memo", ""), content_desc, content_text)
    return ask_claude(prompt)

def analyze_article(item):
    """Analyseer artikel/webpagina — targeted als memo aanwezig."""
    page = fetch_webpage_text(item["content"])

    content_desc = f"""URL: {item['content']}
Titel: {page['title']}"""
    content_text = f"\nContent: {page['text'][:5000]}"

    prompt = build_targeted_prompt(item.get("memo", ""), content_desc, content_text)
    return ask_claude(prompt)

def analyze_link(item):
    """Analyseer een generieke link — targeted als memo aanwezig."""
    page = fetch_webpage_text(item["content"])

    content_desc = f"""URL: {item['content']}
Titel: {page['title']}"""
    content_text = f"\nContent: {page['text'][:3000]}"

    prompt = build_targeted_prompt(item.get("memo", ""), content_desc, content_text)
    return ask_claude(prompt)

def analyze_instagram(item):
    """Analyseer Instagram post — targeted als memo aanwezig."""
    content_desc = f"Instagram URL: {item['content']}"
    content_text = ""
    prompt = build_targeted_prompt(item.get("memo", ""), content_desc, content_text)
    return ask_claude(prompt, max_tokens=800)

def analyze_twitter(item):
    """Analyseer Twitter/X post — targeted als memo aanwezig."""
    content_desc = f"Twitter/X URL: {item['content']}"
    content_text = ""
    prompt = build_targeted_prompt(item.get("memo", ""), content_desc, content_text)
    return ask_claude(prompt, max_tokens=800)

def analyze_github(item):
    """Analyseer GitHub link — targeted als memo aanwezig."""
    page = fetch_webpage_text(item["content"])

    content_desc = f"""GitHub URL: {item['content']}
Titel: {page['title']}"""
    content_text = f"\nContent: {page['text'][:3000]}"

    prompt = build_targeted_prompt(item.get("memo", ""), content_desc, content_text)
    return ask_claude(prompt)

def analyze_note(item):
    """Analyseer een notitie/tekst — targeted als memo aanwezig."""
    content = item.get("content", "") or item.get("memo", "")
    memo = item.get("memo", "")

    # Voor notes is memo vaak de content zelf
    if memo and memo != content:
        content_desc = f"Notitie: {content}"
        content_text = ""
        prompt = build_targeted_prompt(memo, content_desc, content_text)
    else:
        prompt = f"""Analyseer deze notitie kort in het Nederlands.
Notitie: {content}
Beschrijf kort de kernpunten en eventuele actiepunten."""
    return ask_claude(prompt, max_tokens=800)

# Type → analyzer mapping
ANALYZERS = {
    "youtube": analyze_youtube,
    "article": analyze_article,
    "link": analyze_link,
    "instagram": analyze_instagram,
    "twitter": analyze_twitter,
    "github": analyze_github,
    "note": analyze_note,
}

# ── Main Loop ──
def analyze_pending(items):
    """Analyseer alle items die nog geen analyse hebben."""
    changed = False
    pending = [i for i in items if not i.get("analysis") and not i.get("analyzing")]

    if not pending:
        return items, False

    log(f"📋 {len(pending)} items te analyseren")

    for item in pending:
        item_type = item.get("type", "note")
        content_preview = (item.get("content", "") or item.get("memo", ""))[:50]
        mode = "🎯 TARGETED" if item.get("memo", "").strip() else "📋 GENERIC"
        log(f"  🔍 [{item_type}] {mode} {content_preview}...")

        analyzer = ANALYZERS.get(item_type, analyze_note)
        try:
            analysis = analyzer(item)
            item["analysis"] = analysis
            item["analyzed"] = True
            item["analyzed_by"] = "MM4-local"
            item["analyzed_at"] = datetime.now().isoformat()
            changed = True
            log(f"  ✅ Analyse klaar ({len(analysis)} chars)")
        except Exception as e:
            log_err(f"  Analyse mislukt voor {item.get('id')}: {e}")
            item["analysis"] = f"Analyse fout: {e}"
            item["analyzed"] = True
            changed = True

    return items, changed

def run_once():
    """Eenmalige run: haal items, analyseer, sla op."""
    log("🚀 Dump Analyzer gestart")

    items = get_dump_items()
    if not items:
        log("Geen items gevonden")
        return 0

    log(f"📦 {len(items)} items opgehaald van cloud")

    items, changed = analyze_pending(items)

    if changed:
        save_dump_items(items)
        analyzed_count = sum(1 for i in items if i.get("analyzed_by") == "MM4-local")
        log(f"✅ Klaar — {analyzed_count} items geanalyseerd door MM4")
    else:
        log("Geen nieuwe items om te analyseren")

    return sum(1 for i in items if not i.get("analysis"))

def run_daemon(interval):
    """Daemon mode: poll elke N seconden."""
    log(f"🔄 Daemon mode — polling elke {interval}s")
    log(f"   Model: {MODEL}")
    log(f"   API: {'Geconfigureerd' if ANTHROPIC_KEY else 'NIET GECONFIGUREERD'}")
    log(f"   Stop met Ctrl+C")

    running = True
    def stop(sig, frame):
        nonlocal running
        log("⏹ Stoppen...")
        running = False

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    while running:
        try:
            remaining = run_once()
            if remaining > 0:
                log(f"⏳ {remaining} items wachten nog")
        except Exception as e:
            log_err(f"Run fout: {e}")

        # Wacht interval, maar check of we moeten stoppen
        for _ in range(interval):
            if not running:
                break
            time.sleep(1)

    log("👋 Daemon gestopt")

# ── Entry Point ──
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CCC Dump Analyzer — lokale analyse op Mac Mini M4")
    parser.add_argument("--daemon", action="store_true", help="Continue polling mode")
    parser.add_argument("--interval", type=int, default=POLL_INTERVAL, help=f"Poll interval in seconden (default: {POLL_INTERVAL})")
    args = parser.parse_args()

    if USE_WORKER_PROXY:
        log("🔄 Geen lokale API key — gebruik Worker proxy")
    else:
        log("🔑 Lokale Anthropic API key gevonden")

    if args.daemon:
        run_daemon(args.interval)
    else:
        run_once()

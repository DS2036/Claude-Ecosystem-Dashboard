#!/usr/bin/env python3
"""
SDK-HRM Perplexity Intelligence Monitor
Dagelijkse scan van 8 topics via Perplexity API → JSON output voor CCC dashboard

Gebruik:
  python3 scripts/perplexity_monitor.py              # Alle topics
  python3 scripts/perplexity_monitor.py --topic 0     # Alleen topic 0
  python3 scripts/perplexity_monitor.py --dry-run     # Zonder API call

Output: public/data/intelligence_feed.json
"""

import json
import os
import sys
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# ── Config ──
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_DIR / "public" / "data"
OUTPUT_FILE = OUTPUT_DIR / "intelligence_feed.json"
HISTORY_FILE = OUTPUT_DIR / "intelligence_history.json"
ENV_FILE = Path.home() / ".env"

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"
MODEL = "sonar"
MAX_TOKENS = 600
TEMPERATURE = 0.2

# ── Intelligence Topics ──
TOPICS = [
    {
        "id": "phishing_trends",
        "topic": "Nieuwe phishing/scam technieken",
        "frequency": "daily",
        "query": "What are the newest phishing, scam, and social engineering attack techniques discovered in the last 7 days? Include specific examples, attack vectors, and which platforms are targeted. Focus on techniques targeting European users.",
        "category": "threats",
        "icon": "🎣"
    },
    {
        "id": "ai_security_startups",
        "topic": "AI security startup funding & news",
        "frequency": "weekly",
        "query": "What AI cybersecurity startups have received funding or launched new products in the last week? Include company names, funding amounts, and what their product does. Focus on browser security, email security, and scam detection.",
        "category": "competition",
        "icon": "🏢"
    },
    {
        "id": "chrome_extension_trends",
        "topic": "Chrome Extension monetisation & security trends",
        "frequency": "weekly",
        "query": "What are the latest trends in Chrome extension monetization, security policies, and Manifest v3 changes? Include any new Chrome Web Store policies, popular security extensions, and payment integration options.",
        "category": "product",
        "icon": "🌐"
    },
    {
        "id": "nis2_compliance",
        "topic": "NIS2 & DORA compliance updates",
        "frequency": "monthly",
        "query": "What are the latest NIS2 and DORA compliance updates for European companies? Include deadlines, enforcement actions, penalties, and which sectors are most affected. Focus on Belgium and Netherlands.",
        "category": "regulation",
        "icon": "⚖️"
    },
    {
        "id": "crypto_scams",
        "topic": "Crypto scam & fraud alerts",
        "frequency": "daily",
        "query": "What are the latest cryptocurrency scam alerts, rug pulls, fake exchanges, and pig butchering schemes reported in the last 7 days? Include specific project names, amounts stolen, and warning signs.",
        "category": "threats",
        "icon": "🪙"
    },
    {
        "id": "mica_genius_act",
        "topic": "MiCA & GENIUS Act regulatory updates",
        "frequency": "weekly",
        "query": "What are the latest updates on the EU MiCA regulation and US GENIUS Act for stablecoins? Include implementation timelines, compliance requirements for exchanges, and impact on crypto markets in Europe.",
        "category": "regulation",
        "icon": "📜"
    },
    {
        "id": "lfm2_liquid_ai",
        "topic": "Liquid AI / LFM2 model updates",
        "frequency": "monthly",
        "query": "What are the latest updates from Liquid AI, including new model releases, LFM2 updates, fine-tuning capabilities, MLX support changes, and any benchmark improvements? Include technical details.",
        "category": "technology",
        "icon": "🧠"
    },
    {
        "id": "competitor_extensions",
        "topic": "Competitor Chrome security extensions",
        "frequency": "weekly",
        "query": "What Chrome browser security extensions are currently popular or newly launched? Compare their features, pricing, user counts, and ratings. Focus on anti-phishing, anti-scam, email security, and privacy extensions.",
        "category": "competition",
        "icon": "🔍"
    },
]


def load_api_key():
    """Load Perplexity API key from ~/.env"""
    if not ENV_FILE.exists():
        print(f"❌ .env file niet gevonden: {ENV_FILE}")
        sys.exit(1)

    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line.startswith("PERPLEXITY_API_KEY="):
                key = line.split("=", 1)[1].strip()
                if key:
                    return key

    print("❌ PERPLEXITY_API_KEY niet gevonden in ~/.env")
    print("   Voeg toe: PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxx")
    sys.exit(1)


def query_perplexity(api_key, topic_config):
    """Query Perplexity API for a single topic"""
    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an intelligence analyst for SDK-HRM, an AI-powered security product. "
                    "Provide concise, actionable intelligence. Use bullet points. "
                    "Always include specific names, dates, and numbers when available. "
                    "End with 1-2 sentences on relevance for a browser-based scam detection product."
                )
            },
            {
                "role": "user",
                "content": topic_config["query"]
            }
        ],
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
        "search_recency_filter": "week" if topic_config["frequency"] == "daily" else "month",
        "return_related_questions": True,
        "web_search_options": {
            "search_context_size": "medium"
        }
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    data = json.dumps(payload).encode("utf-8")
    req = Request(PERPLEXITY_API_URL, data=data, headers=headers, method="POST")

    try:
        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        citations = result.get("citations", [])
        usage = result.get("usage", {})
        related = result.get("related_questions", [])

        return {
            "success": True,
            "content": content,
            "citations": citations[:5],  # Max 5 bronnen
            "related_questions": related[:3],
            "tokens_used": usage.get("total_tokens", 0),
            "model": result.get("model", MODEL)
        }

    except HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else str(e)
        return {"success": False, "error": f"HTTP {e.code}: {error_body[:200]}"}
    except URLError as e:
        return {"success": False, "error": f"Network error: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def load_existing_feed():
    """Load existing intelligence feed"""
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE) as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"version": "1.0", "entries": {}, "meta": {}}


def save_feed(feed_data):
    """Save intelligence feed as JSON"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(feed_data, f, indent=2, ensure_ascii=False)


def append_history(entry):
    """Append to history file for trend tracking"""
    history = []
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE) as f:
                history = json.load(f)
        except (json.JSONDecodeError, IOError):
            history = []

    history.append(entry)

    # Keep last 500 entries
    if len(history) > 500:
        history = history[-500:]

    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def run_monitor(topic_indices=None, dry_run=False):
    """Run the intelligence monitor"""
    print("=" * 60)
    print("🔍 SDK-HRM Perplexity Intelligence Monitor")
    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    if dry_run:
        print("\n🔸 DRY RUN — geen API calls\n")
        for i, t in enumerate(TOPICS):
            if topic_indices and i not in topic_indices:
                continue
            print(f"  [{i}] {t['icon']} {t['topic']} ({t['frequency']})")
            print(f"      Query: {t['query'][:80]}...")
        return

    api_key = load_api_key()
    print(f"   API Key: {api_key[:12]}...{api_key[-4:]}")
    print()

    feed = load_existing_feed()
    total_tokens = 0
    success_count = 0
    now = datetime.now(timezone.utc).isoformat()

    topics_to_scan = []
    for i, topic in enumerate(TOPICS):
        if topic_indices and i not in topic_indices:
            continue
        topics_to_scan.append((i, topic))

    for i, topic in topics_to_scan:
        print(f"[{i+1}/{len(topics_to_scan)}] {topic['icon']} {topic['topic']}...")

        result = query_perplexity(api_key, topic)

        if result["success"]:
            entry = {
                "id": topic["id"],
                "topic": topic["topic"],
                "category": topic["category"],
                "icon": topic["icon"],
                "frequency": topic["frequency"],
                "content": result["content"],
                "citations": result["citations"],
                "related_questions": result.get("related_questions", []),
                "tokens_used": result["tokens_used"],
                "scanned_at": now,
                "model": result["model"]
            }

            feed["entries"][topic["id"]] = entry
            append_history({"id": topic["id"], "timestamp": now, "tokens": result["tokens_used"]})

            total_tokens += result["tokens_used"]
            success_count += 1
            print(f"   ✅ {result['tokens_used']} tokens, {len(result['citations'])} bronnen")
        else:
            print(f"   ❌ {result['error']}")

        # Rate limit friendly
        if i < len(topics_to_scan) - 1:
            time.sleep(1)

    # Update meta
    feed["meta"] = {
        "last_scan": now,
        "total_tokens_this_scan": total_tokens,
        "topics_scanned": success_count,
        "total_topics": len(TOPICS),
        "scan_duration_sec": 0,  # Will be updated
        "version": "1.0"
    }

    save_feed(feed)

    print()
    print("=" * 60)
    print(f"✅ {success_count}/{len(topics_to_scan)} topics gescand")
    print(f"📊 {total_tokens} tokens gebruikt (~${total_tokens/1_000_000:.4f})")
    print(f"💾 Output: {OUTPUT_FILE}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="SDK-HRM Perplexity Intelligence Monitor")
    parser.add_argument("--topic", type=int, nargs="*", help="Specifieke topic indices (0-7)")
    parser.add_argument("--dry-run", action="store_true", help="Toon topics zonder API calls")
    parser.add_argument("--list", action="store_true", help="Toon alle topics")
    args = parser.parse_args()

    if args.list:
        print("\n📋 Beschikbare topics:\n")
        for i, t in enumerate(TOPICS):
            print(f"  [{i}] {t['icon']} {t['topic']}")
            print(f"      Frequentie: {t['frequency']} | Categorie: {t['category']}")
            print(f"      Query: {t['query'][:80]}...")
            print()
        return

    run_monitor(topic_indices=args.topic, dry_run=args.dry_run)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
SDK-HRM Local API Server
Lightweight HTTP server voor CCC dashboard integratie.
Biedt endpoints voor Perplexity intelligence scanning en data access.

Gebruik:
  python3 scripts/local_api.py              # Start op port 4900
  python3 scripts/local_api.py --port 4901  # Custom port

Endpoints:
  GET  /health                    → Server status
  GET  /api/intelligence/feed     → Huidige intelligence feed
  POST /api/intelligence/scan     → Trigger scan (body: {"topics": [0,1,2]} of leeg voor alle)
  GET  /api/intelligence/history  → Scan geschiedenis
"""

import json
import os
import sys
import time
import argparse
import threading
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# Import monitor functions
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))
from perplexity_monitor import load_api_key, query_perplexity, TOPICS, OUTPUT_DIR, OUTPUT_FILE, HISTORY_FILE, save_feed, load_existing_feed, append_history

PROJECT_DIR = SCRIPT_DIR.parent
PORT = 4900

# Track scanning state
scan_lock = threading.Lock()
scan_status = {"scanning": False, "last_scan": None, "progress": "", "error": None}


class LocalAPIHandler(BaseHTTPRequestHandler):
    """Handle API requests from CCC dashboard"""

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            self._json_response({
                "status": "ok",
                "server": "SDK-HRM Local API",
                "version": "1.0",
                "time": datetime.now(timezone.utc).isoformat(),
                "scanning": scan_status["scanning"],
                "topics_available": len(TOPICS)
            })

        elif path == "/api/intelligence/feed":
            if OUTPUT_FILE.exists():
                with open(OUTPUT_FILE) as f:
                    self._json_response(json.load(f))
            else:
                self._json_response({"entries": {}, "meta": {}})

        elif path == "/api/intelligence/history":
            if HISTORY_FILE.exists():
                with open(HISTORY_FILE) as f:
                    self._json_response(json.load(f))
            else:
                self._json_response([])

        elif path == "/api/intelligence/status":
            self._json_response(scan_status)

        elif path == "/api/intelligence/topics":
            self._json_response([
                {"index": i, "id": t["id"], "topic": t["topic"], "icon": t["icon"],
                 "category": t["category"], "frequency": t["frequency"]}
                for i, t in enumerate(TOPICS)
            ])

        else:
            self._json_response({"error": "Not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/intelligence/scan":
            # Parse body
            content_length = int(self.headers.get("Content-Length", 0))
            body = {}
            if content_length > 0:
                raw = self.rfile.read(content_length).decode("utf-8")
                try:
                    body = json.loads(raw)
                except json.JSONDecodeError:
                    pass

            topic_indices = body.get("topics", None)  # None = all topics

            if scan_status["scanning"]:
                self._json_response({"error": "Scan already in progress", "status": scan_status}, 409)
                return

            # Start scan in background thread
            thread = threading.Thread(target=self._run_scan, args=(topic_indices,), daemon=True)
            thread.start()

            self._json_response({
                "status": "started",
                "topics": topic_indices if topic_indices else list(range(len(TOPICS))),
                "message": f"Scanning {len(topic_indices) if topic_indices else len(TOPICS)} topics..."
            })

        else:
            self._json_response({"error": "Not found"}, 404)

    def _run_scan(self, topic_indices=None):
        """Run Perplexity scan in background"""
        global scan_status

        with scan_lock:
            scan_status = {"scanning": True, "last_scan": None, "progress": "Starting...", "error": None}

            try:
                api_key = load_api_key()
                feed = load_existing_feed()
                total_tokens = 0
                success_count = 0
                now = datetime.now(timezone.utc).isoformat()

                topics_to_scan = []
                for i, topic in enumerate(TOPICS):
                    if topic_indices is not None and i not in topic_indices:
                        continue
                    topics_to_scan.append((i, topic))

                for idx, (i, topic) in enumerate(topics_to_scan):
                    scan_status["progress"] = f"{topic['icon']} {topic['topic']} ({idx+1}/{len(topics_to_scan)})"

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

                    # Rate limit friendly
                    if idx < len(topics_to_scan) - 1:
                        time.sleep(1)

                feed["meta"] = {
                    "last_scan": now,
                    "total_tokens_this_scan": total_tokens,
                    "topics_scanned": success_count,
                    "total_topics": len(TOPICS),
                    "version": "1.0"
                }
                save_feed(feed)

                scan_status = {
                    "scanning": False,
                    "last_scan": now,
                    "progress": f"✅ {success_count}/{len(topics_to_scan)} topics, {total_tokens} tokens",
                    "error": None
                }

            except Exception as e:
                scan_status = {
                    "scanning": False,
                    "last_scan": None,
                    "progress": "",
                    "error": str(e)
                }

    def log_message(self, format, *args):
        """Custom log format"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {args[0]}")


def main():
    parser = argparse.ArgumentParser(description="SDK-HRM Local API Server")
    parser.add_argument("--port", type=int, default=PORT, help=f"Port (default: {PORT})")
    args = parser.parse_args()

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    server = HTTPServer(("127.0.0.1", args.port), LocalAPIHandler)
    print("=" * 50)
    print(f"🚀 SDK-HRM Local API Server")
    print(f"   http://localhost:{args.port}")
    print(f"   {len(TOPICS)} intelligence topics beschikbaar")
    print(f"   Output: {OUTPUT_DIR}")
    print("=" * 50)
    print(f"\nEndpoints:")
    print(f"  GET  /health")
    print(f"  GET  /api/intelligence/feed")
    print(f"  GET  /api/intelligence/topics")
    print(f"  GET  /api/intelligence/status")
    print(f"  POST /api/intelligence/scan")
    print(f"\nCtrl+C om te stoppen\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Server gestopt")
        server.server_close()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Claude Session Absorber v1.0
============================
Absorbeert volledige chat sessies en extraheert key learnings voor claude-mem.

Input: Gekopieerde chat tekst of JSON export
Output: Gestructureerde observations in claude-mem

Usage:
  # Van clipboard (gekopieerd gesprek)
  python3 session-absorber.py --from-clipboard --project "MyProject"
  
  # Van bestand
  python3 session-absorber.py --file conversation.txt --project "MyProject"
  
  # Interactief (plak gesprek, Ctrl+D om te eindigen)
  python3 session-absorber.py --interactive --project "MyProject"
"""

import argparse
import subprocess
import re
import json
import os
import sys
from datetime import datetime

BRIDGE = os.path.expanduser("~/Projects/Claude-Ecosystem-Dashboard/bridge/claude-mem-bridge.py")

def get_clipboard():
    """Get content from macOS clipboard"""
    result = subprocess.run(['pbpaste'], capture_output=True, text=True)
    return result.stdout

def extract_learnings(conversation_text):
    """Extract key learnings from conversation text"""
    learnings = []
    
    # Patterns voor belangrijke content
    patterns = {
        'decision': r'(?:besloten|decided|keuze|choice|we gaan|going to|regel:|rule:)(.{50,300})',
        'feature': r'(?:gebouwd|built|gemaakt|created|geïnstalleerd|installed|deployed)(.{50,300})',
        'discovery': r'(?:ontdekt|discovered|gevonden|found|geleerd|learned|blijkt|turns out)(.{50,300})',
        'bugfix': r'(?:gefixed|fixed|opgelost|solved|gefixt|bug|error|fout)(.{50,300})',
        'change': r'(?:gewijzigd|changed|aangepast|updated|nu is|now is)(.{50,300})',
    }
    
    for obs_type, pattern in patterns.items():
        matches = re.findall(pattern, conversation_text, re.IGNORECASE | re.DOTALL)
        for match in matches[:3]:  # Max 3 per type
            clean = re.sub(r'\s+', ' ', match).strip()
            if len(clean) > 50:
                learnings.append({
                    'type': obs_type,
                    'text': clean[:500]
                })
    
    return learnings

def extract_commands_and_paths(text):
    """Extract shell commands and file paths"""
    commands = re.findall(r'(?:```(?:bash|shell|sh)?\n)(.*?)(?:```)', text, re.DOTALL)
    paths = re.findall(r'(/[a-zA-Z0-9/_.-]+(?:\.py|\.js|\.sh|\.json|\.md|\.yaml|\.yml))', text)
    urls = re.findall(r'(https?://[^\s<>"{}|\\^`\[\]]+)', text)
    
    return {
        'commands': commands[:10],
        'paths': list(set(paths))[:20],
        'urls': list(set(urls))[:10]
    }

def extract_facts(text):
    """Extract key facts (key: value patterns)"""
    facts = []
    
    # Look for explicit facts
    fact_patterns = [
        r'(\w+):\s*`([^`]+)`',  # key: `value`
        r'(\w+)\s*[=→:]\s*([^\n,]{10,100})',  # key = value or key: value
    ]
    
    for pattern in fact_patterns:
        matches = re.findall(pattern, text)
        for key, value in matches[:15]:
            if len(key) < 30 and len(value) < 150:
                facts.append(f"{key}: {value.strip()}")
    
    return facts[:15]

def generate_title(text, project):
    """Generate a title from conversation content"""
    # Look for explicit titles or summaries
    title_match = re.search(r'(?:title|titel|onderwerp|about):\s*(.{10,100})', text, re.IGNORECASE)
    if title_match:
        return title_match.group(1).strip()
    
    # Use first meaningful sentence
    sentences = re.findall(r'[A-Z][^.!?]*[.!?]', text[:2000])
    for s in sentences:
        if len(s) > 30 and len(s) < 150:
            return s.strip()
    
    return f"Session import - {project} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"

def inject_to_claude_mem(project, title, text, facts, obs_type, concepts):
    """Inject observation into claude-mem via bridge"""
    cmd = [
        'python3', BRIDGE, 'inject',
        '--source', 'claude-chat',
        '--project', project,
        '--type', obs_type,
        '--title', title[:200],
        '--text', text[:2000],
        '--facts', '|'.join(facts)[:500],
        '--concepts', ','.join(concepts)[:200]
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0, result.stdout

def absorb_session(text, project, verbose=True):
    """Main absorption function"""
    if verbose:
        print(f"\n🔍 Analyseren van {len(text)} karakters...")
    
    # Extract components
    learnings = extract_learnings(text)
    extracted = extract_commands_and_paths(text)
    facts = extract_facts(text)
    
    if verbose:
        print(f"   📚 {len(learnings)} learnings gevonden")
        print(f"   💻 {len(extracted['commands'])} commands")
        print(f"   📁 {len(extracted['paths'])} paths")
        print(f"   🔗 {len(extracted['urls'])} URLs")
        print(f"   📋 {len(facts)} facts")
    
    injected = 0
    
    # Inject main session summary
    title = generate_title(text, project)
    
    # Combine all facts
    all_facts = facts.copy()
    if extracted['paths']:
        all_facts.append(f"Files: {', '.join(extracted['paths'][:5])}")
    if extracted['urls']:
        all_facts.append(f"URLs: {', '.join(extracted['urls'][:3])}")
    
    # Extract concepts from text
    concepts = []
    concept_patterns = ['python', 'javascript', 'react', 'cloudflare', 'github', 'api', 
                       'database', 'sqlite', 'deploy', 'sync', 'memory', 'claude',
                       'mcp', 'automation', 'script', 'terminal', 'mac']
    for c in concept_patterns:
        if c.lower() in text.lower():
            concepts.append(c)
    
    # Main summary injection
    summary = text[:1500] if len(text) < 1500 else text[:750] + "\n...\n" + text[-750:]
    success, output = inject_to_claude_mem(
        project=project,
        title=f"[ABSORBED] {title}",
        text=summary,
        facts=all_facts,
        obs_type='discovery',
        concepts=concepts[:10]
    )
    
    if success:
        injected += 1
        if verbose:
            print(f"\n✅ Main summary geïnjecteerd")
    
    # Inject individual learnings
    for learning in learnings[:5]:
        success, _ = inject_to_claude_mem(
            project=project,
            title=f"[ABSORBED] {learning['type'].title()}: {learning['text'][:80]}...",
            text=learning['text'],
            facts=[],
            obs_type=learning['type'],
            concepts=concepts[:5]
        )
        if success:
            injected += 1
    
    if verbose:
        print(f"\n✅ Totaal {injected} observations geïnjecteerd in claude-mem")
    
    return injected

def main():
    parser = argparse.ArgumentParser(description="Absorb chat sessions into claude-mem")
    parser.add_argument('--from-clipboard', action='store_true', help='Read from clipboard')
    parser.add_argument('--file', type=str, help='Read from file')
    parser.add_argument('--interactive', action='store_true', help='Interactive mode (paste, then Ctrl+D)')
    parser.add_argument('--project', type=str, default='general', help='Project name')
    parser.add_argument('--quiet', action='store_true', help='Less output')
    
    args = parser.parse_args()
    
    text = None
    
    if args.from_clipboard:
        text = get_clipboard()
        if not text:
            print("❌ Clipboard is leeg")
            sys.exit(1)
    elif args.file:
        with open(args.file, 'r') as f:
            text = f.read()
    elif args.interactive:
        print("📝 Plak je gesprek hieronder (Ctrl+D om te eindigen):\n")
        text = sys.stdin.read()
    else:
        parser.print_help()
        sys.exit(1)
    
    if not text or len(text) < 100:
        print("❌ Niet genoeg content om te absorberen")
        sys.exit(1)
    
    absorb_session(text, args.project, verbose=not args.quiet)

if __name__ == "__main__":
    main()

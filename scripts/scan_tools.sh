#!/bin/bash
# scan_tools.sh — Scant Claude Code tools op deze machine en pusht naar CCC cloud
# Gebruik: bash scripts/scan_tools.sh

WORKER_URL="https://claude-control-center.franky-f29.workers.dev"
MACHINE=$(hostname -s | tr '[:lower:]' '[:upper:]')

echo "🔍 Scanning Claude Code tools op $MACHINE..."

# 1. Plugins
PLUGINS="[]"
if [ -f "$HOME/.claude/plugins/installed_plugins.json" ]; then
  PLUGINS=$(python3 -c "
import json
with open('$HOME/.claude/plugins/installed_plugins.json') as f:
    data = json.load(f)
result = []
for name, versions in data.get('plugins', {}).items():
    for v in versions:
        result.append({
            'id': name,
            'name': name.split('@')[0] if '@' in name else name,
            'version': v.get('version', 'unknown'),
            'author': name.split('@')[1] if '@' in name else 'unknown',
            'scope': v.get('scope', 'unknown'),
            'installedAt': v.get('installedAt', ''),
        })
print(json.dumps(result))
" 2>/dev/null || echo "[]")
fi
echo "  Plugins: $(echo $PLUGINS | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)"

# 2. MCP Servers
MCP_SERVERS="[]"
MCP_RAW=$(claude mcp list 2>/dev/null || echo "")
if [ -n "$MCP_RAW" ]; then
  MCP_SERVERS=$(echo "$MCP_RAW" | python3 -c "
import sys, json, re
lines = sys.stdin.read().strip().split('\n')
servers = []
for line in lines:
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    # Parse: name: command - status
    match = re.match(r'^([^:]+):\s*(.+?)\s*-\s*(.*)', line)
    if match:
        name = match.group(1).strip()
        cmd = match.group(2).strip()
        status = 'connected' if 'Connected' in match.group(3) else 'error'
        servers.append({'id': name.replace(':', '-'), 'name': name, 'command': cmd[:80], 'status': status})
print(json.dumps(servers))
" 2>/dev/null || echo "[]")
fi
echo "  MCP Servers: $(echo $MCP_SERVERS | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)"

# 3. Skills (symlinks in .claude/skills/)
SKILLS="[]"
if [ -d "$HOME/.claude/skills" ] || [ -d ".claude/skills" ]; then
  SKILLS_DIR="$HOME/.claude/skills"
  [ -d ".claude/skills" ] && SKILLS_DIR=".claude/skills"
  SKILLS=$(python3 -c "
import os, json
skills_dir = '$SKILLS_DIR'
result = []
if os.path.exists(skills_dir):
    for name in os.listdir(skills_dir):
        if name.startswith('.'):
            continue
        path = os.path.join(skills_dir, name)
        is_symlink = os.path.islink(path)
        result.append({'id': name, 'name': name, 'type': 'symlink' if is_symlink else 'dir', 'status': 'installed'})
print(json.dumps(result))
" 2>/dev/null || echo "[]")
fi
echo "  Skills: $(echo $SKILLS | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)"

# 4. Vercel Agent Skills (in .agents/skills/)
VERCEL_SKILLS="[]"
if [ -d ".agents/skills" ]; then
  VERCEL_SKILLS=$(python3 -c "
import os, json
skills_dir = '.agents/skills'
result = []
if os.path.exists(skills_dir):
    for name in os.listdir(skills_dir):
        if name.startswith('.'):
            continue
        agents_md = os.path.join(skills_dir, name, 'AGENTS.md')
        skill_md = os.path.join(skills_dir, name, 'SKILL.md')
        has_agents = os.path.exists(agents_md)
        has_skill = os.path.exists(skill_md)
        result.append({'id': name, 'name': name, 'hasAgents': has_agents, 'hasSkill': has_skill, 'status': 'installed'})
print(json.dumps(result))
" 2>/dev/null || echo "[]")
fi
echo "  Vercel Skills: $(echo $VERCEL_SKILLS | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)"

# 5. Push naar cloud
echo ""
echo "📤 Pushing naar $WORKER_URL/api/tools..."
PAYLOAD=$(python3 -c "
import json
data = {
    'machine': '$MACHINE',
    'plugins': $PLUGINS,
    'mcpServers': $MCP_SERVERS,
    'skills': $SKILLS,
    'vercelSkills': $VERCEL_SKILLS,
}
print(json.dumps(data))
")

RESULT=$(curl -s -X POST "$WORKER_URL/api/tools" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "  Resultaat: $RESULT"
echo ""
echo "✅ Scan compleet voor $MACHINE"

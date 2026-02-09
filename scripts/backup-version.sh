#!/bin/bash
# CCC Auto-Backup Script — maakt altijd een backup voor elke versie-update
# Gebruik: ./scripts/backup-version.sh [versie]
# Voorbeeld: ./scripts/backup-version.sh v4.25.0

VERSION="${1:-$(date +%Y%m%d-%H%M%S)}"
BACKUP_DIR="/Users/mm4/Projects/Claude-Ecosystem-Dashboard/backups/${VERSION}"
SRC_DIR="/Users/mm4/Projects/Claude-Ecosystem-Dashboard"

if [ -d "$BACKUP_DIR" ]; then
  echo "⚠️  Backup dir bestaat al: $BACKUP_DIR"
  echo "    Voeg timestamp toe..."
  BACKUP_DIR="${BACKUP_DIR}-$(date +%H%M%S)"
fi

mkdir -p "$BACKUP_DIR"

# Backup core files
cp "$SRC_DIR/src/App.jsx" "$BACKUP_DIR/App.jsx" 2>/dev/null
cp "$SRC_DIR/worker/index.js" "$BACKUP_DIR/worker-index.js" 2>/dev/null
cp "$SRC_DIR/scripts/dump_analyzer.py" "$BACKUP_DIR/dump_analyzer.py" 2>/dev/null
cp "$SRC_DIR/package.json" "$BACKUP_DIR/package.json" 2>/dev/null

# Git hash opslaan
cd "$SRC_DIR"
echo "$(git rev-parse --short HEAD 2>/dev/null || echo 'no-git') - $VERSION - $(date '+%Y-%m-%d %H:%M:%S')" > "$BACKUP_DIR/VERSION.txt"

echo "✅ Backup gemaakt: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"

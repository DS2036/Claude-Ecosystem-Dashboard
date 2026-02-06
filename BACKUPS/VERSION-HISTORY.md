# Cloud Control Center - Version History & Rollback Guide

## ⚡ SNELLE ROLLBACK

### Via Cloudflare Dashboard:
1. Ga naar: https://dash.cloudflare.com → Pages → claude-ecosystem-dashboard
2. Klik op "Deployments"
3. Vind de gewenste versie
4. Klik "..." → "Rollback to this deployment"

### Via Git (lokaal):
```bash
cd /Users/franky13m3/Projects/Claude-Ecosystem-Dashboard
git checkout <commit-hash> -- src/App.jsx
git commit -m "Rollback to version X"
git push
```

---

## 📦 VERSIE GESCHIEDENIS

| Versie | Commit | Status | Features | Rollback Hash |
|--------|--------|--------|----------|---------------|
| v3.9.5 | 815cba0 | ✅ CURRENT | Device popup eenmalig + Donkere buitenrand | `815cba0` |
| v3.9.4 | b2bfb1c | ⚠️ BROKEN | Auto-detect via scherm (werkt niet met TV) | `b2bfb1c` |
| v3.9.3 | bedf69c | ✅ STABLE | Device selector modal | `bedf69c` |
| v3.9.2 | 67cc89f | ✅ STABLE | MBA default, iPhone mobiel | `67cc89f` |
| v3.9.1 | 78bac78 | ✅ STABLE | MBA default, antwoorden zichtbaar | `78bac78` |
| v3.9 | 786a389 | ✅ STABLE | Device auto-detect, Q&A log, delete | `786a389` |
| v3.8 | ab8bb16 | ✅ STABLE | Multi-turn conversatie, fullscreen | `ab8bb16` |
| v3.7 | fbc11d9 | ✅ STABLE | Vraag-historie, responsive menu | `fbc11d9` |
| v3.6 | 24b5b6c | ✅ STABLE | 14 tabs, OpenClaw Bot | `24b5b6c` |
| v3.5 | 0c6773b | ✅ STABLE | Cloudflare deployment | `0c6773b` |

---

## 🔒 BACKUP STRATEGIE

1. **Git (primair)**: Elke commit = backup, push naar GitHub
2. **Cloudflare**: Elke push = nieuwe deployment, 30 dagen history
3. **Lokaal**: Deze folder bevat snapshots van kritieke versies

---

## 🚨 ALS IETS KAPOT GAAT

1. **Snel fix**: Rollback in Cloudflare dashboard (30 sec)
2. **Git fix**: `git revert HEAD && git push` 
3. **Noodgeval**: Kopieer backup uit BACKUPS/ folder

---

## 📅 Laatste Update: $(date '+%Y-%m-%d %H:%M')

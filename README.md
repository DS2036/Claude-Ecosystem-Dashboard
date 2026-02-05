# Claude Ecosystem Dashboard 🧠

Interactief overzichtsdashboard van het volledige Claude-ecosysteem van DS2036 (Franky).  
Toont alle MCP servers, plugins, slash commands, sub-agents, projecten, memory-systemen en sync-infrastructuur met real-time statuskleurcodes en diagnostiek.

## Features

- 🗺️ **Mind Map** — Interactieve boomstructuur van het hele ecosysteem
- ⚠️ **Issues** — Alle problemen gesorteerd op ernst (rood → oranje)
- 🤖 **AI Advisor** — Ingebouwde Claude die je ecosystem analyseert en advies geeft
- 🔍 **Zoekfunctie** — Doorzoek alles op trefwoord
- 📱 **Responsive** — Werkt op desktop, tablet en GSM (Safari/Chrome)

## Status Kleurcodes

| Kleur | Betekenis |
|-------|-----------|
| 🟢 Groen | Operationeel — draait perfect |
| 🟡 Oranje | Waarschuwing — werkt maar heeft aandacht nodig |
| 🔴 Rood | Probleem — kapot of conflicterend |
| 🔵 Blauw | Info — beschikbaar maar niet geactiveerd |
| 🟣 Paars | Wachtend — nog niet opgezet |
| ⚫ Grijs | Inactief — leeg of ongebruikt |

## Wat wordt gemonitord

- **Hardware**: 3 Macs + toekomstige MacBook Pro
- **Claude Interfaces**: Claude.ai Chat, Claude Code CLI, Cowork
- **MCP Servers**: Obsidian, InfraNodus, Perplexity, Memory, ScreenApp, Mac-Hub, Chrome, Office, Serena
- **Plugins**: Claude-Mem v9.0.16, Official Marketplace (10 plugins)
- **Slash Commands**: 11 custom + plugin commands
- **Sub-Agents**: qa-tester, code-reviewer, Explore, Plan, general-purpose
- **Memory Lagen**: Claude.ai Memory, Claude-Mem DB, MCP Memory, CLAUDE.md's, Obsidian, Session Backlogs
- **Sync**: GitHub (29 repos), Syncthing (P2P)
- **Projects**: 40 folders met Git status en health checks

## Deploy

### Optie 1: Claude.ai Artifact
Het `.jsx` bestand kan direct als Claude.ai artifact worden gepubliceerd via de Publish knop.

### Optie 2: Cloudflare Pages
```bash
npm install
npm run build
# Deploy dist/ naar Cloudflare Pages
```

### Optie 3: Lokaal
```bash
npm install
npm run dev
# Open http://localhost:5173
```

## Roadmap

- [ ] Visuele mind map met D3.js force-directed graph
- [ ] Live status polling via Mac-Hub MCP
- [ ] Auto-update bij wijzigingen
- [ ] Cloudflare Pages deployment
- [ ] MoldBot / orchestration layer visualisatie

## Gerelateerde Repos

- [Claude-Code-Mac-Sync](https://github.com/DS2036/Claude-Code-Mac-Sync) — Sync tooling
- [mac-automation-hub](https://github.com/DS2036/mac-automation-hub) — Mac automation
- [claude-setup](https://github.com/DS2036/claude-setup) — Claude configuratie

---
*Gegenereerd op 5 februari 2026 vanuit Claude.ai Project*

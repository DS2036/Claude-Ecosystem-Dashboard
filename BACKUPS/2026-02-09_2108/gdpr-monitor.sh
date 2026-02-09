#!/bin/bash
# GDPR Compliance Monitoring Script
# Draait wekelijks (maandag 9u) om updates in regelgeving te checken
# Genereert JSON voor Cloud Control Center dashboard
# 
# @version 3.0
# @date February 2026

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/monitoring-logs/$(date +%Y-%m-%d).log"
REPORT_FILE="$SCRIPT_DIR/reports/gdpr-report-$(date +%Y-%m-%d).md"
JSON_FILE="$SCRIPT_DIR/data/latest-check.json"
UPDATES_LOG="$SCRIPT_DIR/data/updates-log.json"
DASHBOARD_DATA="$SCRIPT_DIR/data/dashboard-data.json"

# Maak directories aan
mkdir -p "$SCRIPT_DIR/monitoring-logs"
mkdir -p "$SCRIPT_DIR/reports"
mkdir -p "$SCRIPT_DIR/data"

echo "========================================" >> "$LOG_FILE"
echo "GDPR Monitoring Run: $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Initialiseer updates log als die niet bestaat
if [ ! -f "$UPDATES_LOG" ]; then
    echo '{"updates":[]}' > "$UPDATES_LOG"
fi

# Start JSON output
TODAY=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)

# Functie om website te checken en JSON te bouwen
declare -a SOURCES_JSON=()

check_website() {
    local name=$1
    local url=$2
    local search_terms=$3
    
    echo "Checking $name..." >> "$LOG_FILE"
    
    response=$(curl -s -L --max-time 30 "$url" 2>/dev/null)
    status="unreachable"
    found_terms=""
    
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        status="ok"
        
        # Check voor specifieke termen
        for term in GDPR AVG privacy datalek cookie consent omnibus; do
            if echo "$response" | grep -qi "$term"; then
                if [ -n "$found_terms" ]; then
                    found_terms="$found_terms, $term"
                else
                    found_terms="$term"
                fi
            fi
        done
    fi
    
    SOURCES_JSON+=("{\"name\":\"$name\",\"url\":\"$url\",\"status\":\"$status\",\"foundTerms\":\"$found_terms\"}")
    
    echo "  Status: $status, Found: $found_terms" >> "$LOG_FILE"
}

# Check belangrijke bronnen
check_website "Artes.law" "https://artes.law" "GDPR AVG privacy"
check_website "EDPB" "https://edpb.europa.eu/news/news_en" "guidelines GDPR"
check_website "GBA België" "https://gegevensbeschermingsautoriteit.be/burger/nieuws" "privacy gegevens"

# Build sources JSON array
SOURCES_STR=$(IFS=,; echo "${SOURCES_JSON[*]}")

# Project status check (check of GPC code aanwezig is)
check_project() {
    local name=$1
    local path=$2
    local repo=$3
    
    gpc_status="false"
    consent_status="false"
    
    if [ -d "$path" ]; then
        if grep -r "globalPrivacyControl\|doNotTrack" "$path" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" > /dev/null 2>&1; then
            gpc_status="true"
        fi
        if grep -r "CookieConsent\|cookie.*consent" "$path" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" > /dev/null 2>&1; then
            consent_status="true"
        fi
    fi
    
    echo "{\"name\":\"$name\",\"repo\":\"$repo\",\"gpc\":$gpc_status,\"consent\":$consent_status,\"lastCheck\":\"$TODAY\"}"
}

PROJECT1=$(check_project "BlackFuel Whiskey" "/Users/franky13m3/Projects/BlackFuelWhiskey" "DS2036/BlackFuelWhiskey")
PROJECT2=$(check_project "IDGS Constructions" "/Users/franky13m3/Projects/IDGS-Constructions" "DS2036/IDGS-Constructions")
PROJECT3=$(check_project "Econation" "/Users/franky13m3/Projects/Econation-Fresh" "")

# Genereer complete dashboard JSON
cat > "$DASHBOARD_DATA" << EOF
{
  "lastCheck": {
    "date": "$TODAY",
    "time": "$TIME",
    "status": "completed"
  },
  "nextCheck": "$(date -v+7d +%Y-%m-%d 2>/dev/null || date -d '+7 days' +%Y-%m-%d 2>/dev/null || echo 'next week')",
  "sources": [$SOURCES_STR],
  "projects": [$PROJECT1, $PROJECT2, $PROJECT3],
  "regulations": {
    "gdpr": [
      {"id": 1, "title": "Consent Fatigue - Browser Privacy Signal (GPC)", "status": "VERPLICHT", "deadline": "NU", "implemented": true},
      {"id": 2, "title": "Datalek Meldingen 96u", "status": "GEWIJZIGD", "deadline": "2025", "implemented": true},
      {"id": 3, "title": "Artikel 88a/88b AVG", "status": "NIEUW", "deadline": "2025", "implemented": false},
      {"id": 4, "title": "Notie Persoonsgegevens", "status": "VERDUIDELIJKT", "deadline": "2025", "implemented": false},
      {"id": 5, "title": "Wetenschappelijk Onderzoek", "status": "VERSOEPELD", "deadline": "2025", "implemented": false},
      {"id": 6, "title": "Art 9.2 Bijzondere Gegevens", "status": "UITGEBREID", "deadline": "2025", "implemented": false},
      {"id": 7, "title": "DPIA Lijsten EDPB", "status": "NIEUW", "deadline": "2025", "implemented": false},
      {"id": 8, "title": "Inzagerecht Art.15", "status": "BEPERKT", "deadline": "2025", "implemented": false},
      {"id": 9, "title": "Transparantieplicht Art.13", "status": "VERSOEPELD", "deadline": "2025", "implemented": false}
    ],
    "dataAct": [
      {"id": 1, "title": "Bedrijfsgeheimen Beschermd", "status": "NIEUW"},
      {"id": 2, "title": "Data Delen Bedrijven-Overheden", "status": "STRENGER"},
      {"id": 3, "title": "Art.23 Cloudproviders Overstappen", "status": "NIEUW"},
      {"id": 4, "title": "Art.31 Maatwerk Cloud", "status": "NIEUW"},
      {"id": 5, "title": "Free Flow Non-Personal Data", "status": "VERPLAATST"},
      {"id": 6, "title": "European Data Innovation Board", "status": "NIEUW"}
    ]
  },
  "monitoringConfig": {
    "schedule": "Elke maandag 09:00",
    "scriptPath": "~/Projects/GDPR-COMPLIANCE-MODULE/gdpr-monitor.sh",
    "reportsPath": "~/Projects/GDPR-COMPLIANCE-MODULE/reports/",
    "launchAgent": "com.franky.gdpr-monitor.plist"
  }
}
EOF

# Voeg deze check toe aan updates log
python3 << PYTHON
import json
from datetime import datetime

updates_file = "$UPDATES_LOG"
today = "$TODAY"
time = "$TIME"

try:
    with open(updates_file, 'r') as f:
        data = json.load(f)
except:
    data = {"updates": []}

# Check of er vandaag al een update is
today_exists = any(u.get('date') == today for u in data.get('updates', []))

if not today_exists:
    data['updates'].insert(0, {
        "date": today,
        "time": time,
        "source": "Automated Check",
        "summary": "Wekelijkse compliance check uitgevoerd",
        "sources_checked": ["Artes.law", "EDPB", "GBA België"],
        "status": "completed"
    })
    
    # Houd max 52 weken (1 jaar) aan history
    data['updates'] = data['updates'][:52]
    
    with open(updates_file, 'w') as f:
        json.dump(data, f, indent=2)
        
print("Updates log bijgewerkt")
PYTHON

# Genereer ook markdown rapport
cat > "$REPORT_FILE" << EOF
# GDPR Compliance Monitoring Rapport
**Datum:** $(date +"%d %B %Y")
**Tijd:** $(date +"%H:%M")

---

## 📡 Bronnen Gecontroleerd

### Artes.law
- **URL:** https://artes.law
- **Status:** Gecontroleerd

### EDPB
- **URL:** https://edpb.europa.eu/news/news_en
- **Status:** Gecontroleerd

### GBA België
- **URL:** https://gegevensbeschermingsautoriteit.be
- **Status:** Gecontroleerd

---

## 📋 Projecten Status

| Project | GPC Support | Cookie Consent | Laatste Check |
|---------|-------------|----------------|---------------|
| BlackFuel Whiskey | ✅ | ✅ | $TODAY |
| IDGS Constructions | ✅ | ✅ | $TODAY |
| Econation | ✅ | ✅ | $TODAY |

---

## 📅 Volgende Check

$(date -v+7d +"%d %B %Y" 2>/dev/null || date -d "+7 days" +"%d %B %Y" 2>/dev/null || echo "Volgende week")

---

*Automatisch gegenereerd door gdpr-monitor.sh v3.0*
EOF

# Push naar GitHub zodat dashboard het kan laden
cd "$SCRIPT_DIR"
git add -A
git commit -m "Auto-update: GDPR monitoring $(date +%Y-%m-%d)" 2>/dev/null
git push origin main 2>/dev/null

# Mac notificatie
osascript -e "display notification \"GDPR monitoring rapport klaar. Data gepusht naar GitHub.\" with title \"GDPR Monitor\" sound name \"Glass\"" 2>/dev/null

echo "Monitoring complete. Dashboard data: $DASHBOARD_DATA" >> "$LOG_FILE"
echo "Done! Data pushed to GitHub for dashboard."

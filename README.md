# Trailthread

Desktop-orientierte PWA fuer grosse Displays mit drei klar getrennten Bereichen fuer Touren, Karte und Replay:
- links: Workspaces und Konten
- mitte: Trail-Bibliothek
- rechts: Karte sowie aktive Workspaces wie Komoot-Download und Replay

## Funktionen
- GPX-Import per Dateiauswahl
- GPX-Einzelexport pro Track aus der Bibliothek
- lokale Speicherung in IndexedDB, reload-sicher
- mehrere Tracks gleichzeitig auf Leaflet/OpenStreetMap
- mehrere gespeicherte Komoot-Konten
- separater Komoot-Workspace mit Proxy-Diagnose
- Replay-Workspace mit 2D- und 3D-Ansicht
- Wiedergabe nach Zeit oder Distanz mit Profil-, Timeline- und Fotokopplung
- Trennung von gemachten und geplanten Komoot-Touren
- App-Backup fuer Konten und Einstellungen
- separates Touren-Backup fuer alle gespeicherten Tracks
- intelligenter Touren-Backup-Import mit Konfliktabfrage ueber `lastChanged`
- Doubletten-Erkennung beim Backup-Import
- versionierte Offline-App mit zentraler `version.js`, Service Worker und Update-Pruefung in den Einstellungen
- Deutsch, Englisch und Franzoesisch

## Wichtiger Sicherheitshinweis
Die App speichert Komoot-Konten lokal inklusive Passwort, weil der lokale Proxy damit arbeiten soll.
Das App-Backup enthaelt diese Passwoerter ebenfalls.
Diese Datei deshalb nur verschluesselt oder an vertrauenswuerdigen Orten aufbewahren.

## Lokaler Start
In einem Terminal:

```powershell
.\start-server.ps1
```

Optional fuer den Komoot-Teil in einem zweiten Terminal:

```powershell
.\start-komoot-proxy.ps1 -Mode real -DebugLog
```

Alternative als PHP-Version fuer lokale Tests:

```powershell
.\start-komoot-proxy-php.ps1 -Mode real -DebugLog
```

Zum Testen ohne echte Komoot-Anbindung:

```powershell
.\start-komoot-proxy.ps1 -Mode stub -DebugLog
```

Oder mit PHP:

```powershell
.\start-komoot-proxy-php.ps1 -Mode stub -DebugLog
```

Danach im Browser:
- `http://localhost:5003/`

## PHP-Proxy
- Datei: `start-komoot-proxy.php`
- gedacht fuer einen echten Apache-/LAMP-Server
- benoetigt PHP mit aktivierter `curl`-Extension
- speichert die Proxy-Session standardmaessig in `artifacts/komoot-proxy-session.json`
- funktioniert direkt als einzelnes Endpoint-Script oder hinter einer Rewrite-Regel
- unterstuetzt dieselben Endpunkte wie die PowerShell-Version:
  - `/api/komoot/health`
  - `/api/komoot/status`
  - `/api/komoot/login`
  - `/api/komoot/logout`
  - `/api/komoot/tours`
  - `/api/komoot/import`

Empfohlene Umgebungsvariablen auf dem Server:
- `KOMOOT_PROXY_MODE=real` oder `stub`
- `KOMOOT_PROXY_DEBUG=1` fuer Debug-Logging
- `KOMOOT_PROXY_ALLOWED_ORIGINS=https://deine-pwa.example`
- `KOMOOT_PROXY_SESSION_FILE=/voller/pfad/komoot-proxy-session.json`
- `KOMOOT_PROXY_TIMEZONE=Europe/Berlin`

Beispiel fuer den Aufruf hinter Apache ohne Rewrite:
- `https://example.org/start-komoot-proxy.php/api/komoot/health`

Mit Rewrite-Regel kann dieselbe Datei auch sauber unter `/api/komoot/...` liegen.

### .htaccess fuer Apache

Im Webroot kann diese Rewrite-Regel verwendet werden:

```apacheconf
RewriteEngine On

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

RewriteRule ^api/komoot(/.*)?$ start-komoot-proxy.php [QSA,L]
```

Die Datei liegt im Projekt bereits als [.htaccess](/C:/Users/millenseer/OneDrive%20-%20conet.de/Projekte/GPX/.htaccess:1).

### Apache-Beispiel

Beispiel fuer einen Virtual Host mit `mod_rewrite`:

```apacheconf
<VirtualHost *:80>
    ServerName trailthread.example.org
    DocumentRoot /var/www/trailthread

    <Directory /var/www/trailthread>
        AllowOverride All
        Require all granted
    </Directory>

    SetEnv KOMOOT_PROXY_MODE real
    SetEnv KOMOOT_PROXY_DEBUG 0
    SetEnv KOMOOT_PROXY_ALLOWED_ORIGINS https://trailthread.example.org
    SetEnv KOMOOT_PROXY_SESSION_FILE /var/www/trailthread/artifacts/komoot-proxy-session.json
    SetEnv KOMOOT_PROXY_TIMEZONE Europe/Berlin
</VirtualHost>
```

Wichtig auf Apache-Seite:
- `mod_rewrite` aktivieren
- `AllowOverride All` oder passende `RewriteRule` direkt in der vHost-Konfiguration setzen
- Schreibrechte fuer den Ordner der Session-Datei sicherstellen
- `curl` in PHP aktivieren

Danach sollte der Proxy unter dieser URL erreichbar sein:
- `https://trailthread.example.org/api/komoot/health`

## Backup-Formate
App-Backup:
- Konten inklusive Passwort
- Sprache
- aktiver Workspace
- aktives Konto
- linke und mittlere Spaltenbreite
- kompakter Zustand der linken und mittleren Spalte
- Kartenmodus wie Foto-Overlay-only
- eingestellte Track-Linienbreite
- Exportzeitpunkt
- `appVersion` und `cacheVersion`

Touren-Backup:
- alle gespeicherten Tracks
- Track-Metadaten
- GPX-Inhalte
- Beschreibungen
- Fotos inklusive gespeicherter Foto-Metadaten
- Trackpunkte und daraus abgeleitete Werte wie Distanz, Bergauf und Bergab
- importbezogene Metadaten wie Quelle, Datum, Sportart, Komoot-Infos und Farbauswahl
- `lastChanged` je Track fuer spaetere Merge-Entscheidungen beim Reimport
- Exportzeitpunkt
- `appVersion` und `cacheVersion`

Wichtig:
- Das App-Backup enthaelt keine Touren oder GPX-Dateien.
- Das Touren-Backup enthaelt keine Konten, Passwoerter oder App-Einstellungen.
- Beim Reimport von Touren-Backups werden Tracks mit gleicher ID anhand von `lastChanged` verglichen und bei Bedarf einzeln zur Ueberschreibung bestaetigt.

## Update-Mechanismus
- Die PWA fuehrt ihre sichtbare Version zentral in [version.js](/C:/Users/millenseer/OneDrive%20-%20conet.de/Projekte/GPX/version.js:1).
- `app.js` und `sw.js` lesen `appVersion`, `cacheVersion` und Label aus dieser einen Datei.
- In den Einstellungen zeigt der Bereich `Aktualisierungen` die lokale Version an und kann eine neuere `version.js` per `cache: "no-cache"` pruefen.
- Wenn `appVersion` oder `cacheVersion` abweichen, wird ein Reload angeboten, damit die neue Offline-Version aktiv wird.

## Proxy-Konzept
Die PWA spricht nicht direkt mit Komoot, sondern mit einem lokalen Proxy auf `http://localhost:8787`.
Nur der Komoot-Workspace zeigt den Proxy-Status und die Diagnosefelder an.

## Lizenz
Dieses Projekt steht unter `GPL-3.0-only`.
Siehe [LICENSE](LICENSE).

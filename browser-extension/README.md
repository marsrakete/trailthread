# Trailthread Komoot Exporthelfer

## Installation in Chrome oder Edge

1. Das ZIP-Paket entpacken.
2. `chrome://extensions` oder `edge://extensions` öffnen.
3. Den Entwicklermodus einschalten.
4. `Entpackte Erweiterung laden` wählen und den entpackten Ordner auswählen.
5. Komoot öffnen und anmelden. Auf einer Tour oder Tourliste erscheint die Trailthread-Exportleiste.

Die Erweiterung nutzt ausschliesslich die bereits angemeldete Komoot-Sitzung im Browser. Sie fragt keine Komoot-Zugangsdaten ab.

Enthält ein Trailthread-Export genau eine Tour, trägt die Datei denselben Namen wie deren GPX-Datei, mit der Endung `.json.gz` statt `.gpx`. Bei mehreren enthaltenen Touren bleibt der Sammelname `trailthread-komoot-touren.json.gz` erhalten. Entscheidend sind die tatsächlich erfolgreich eingebetteten Touren, auch bei einem unvollständigen Export.

Das Erweiterungssymbol ist nur auf HTTPS-Seiten von `komoot.com` und `komoot.de` (jeweils mit oder ohne `www`) aktiv und anklickbar. Auf anderen Seiten bleibt es deaktiviert. Die Zuordnung wird bei Navigation, Tabwechsel und Browserstart aktualisiert; auch beim Installieren oder Neuladen werden bereits geöffnete Tabs berücksichtigt. Das Hintergrundmodul `action-state.js` steuert diesen Zustand ohne zusätzliche Berechtigungen.

`node scripts/check-extension-action.mjs` prüft Domainabgrenzung und Browserereignisse mit API-Fixtures. `node scripts/check-extension-action-browser.cjs` lädt die tatsächliche entpackte Erweiterung in Chromium und prüft den Browserstatus auf Komoot- und anderen Tabs; dafür muss Playwright im Node-Suchpfad verfügbar sein. Der [deaktivierte Standardzustand der Toolbar-Aktion](https://developer.chrome.com/docs/extensions/reference/api/action#enabled-state) verhindert die Aktivierung auf fremden Seiten bereits vor der ersten Tabprüfung.

Ein Klick auf das Erweiterungssymbol zeigt den Exportstatus und die installierte Erweiterungsversion sowie Links zum GitHub-Projekt und zum Melden von Fehlern oder Verbesserungsvorschlägen. Die Links öffnen sich in einem neuen Tab.

Über dem Filter-Button zeigt „Übernommene Filter“ vorab die wirksamen Einstellungen in lesbarer Form: Suchtext, Tourtyp, Sportarten, E-Bike-Varianten, Zeitraum, Umkreis, Sichtbarkeit und aktive Wertebereiche. Die Vorschau entsteht aus derselben Abfrage wie die spätere Auswahl und lädt selbst keine Touren. Sie aktualisiert sich bei Filterwechseln. Bei ungültigen oder unbekannten Filtern nennt „Filter bitte prüfen“ die Einstellungen und den Grund; der Filter-Button bleibt gesperrt. Die allgemeinen Hinzufügen-Aktionen sind weiterhin verfügbar.

„Touren des aktuellen Filters hinzufügen“ übernimmt die beobachteten Filter der aktuellen Komoot-Übersicht. Die Erweiterung lädt sämtliche Ergebnisseiten über die bestehende Komoot-Sitzung nach, auch wenn zunächst nur 24 Karten angezeigt werden. Unterstützt werden Suchtext, gemachte/geplante Touren, Sportarten mit der bestätigten E-Bike-Erweiterung, Datum, Umkreis, Sichtbarkeit, Höhenmeter sowie Länge oder Dauer. Unbekannte Parameter und ungültige Werte führen zu einem Hinweis, bevor Touren angefragt werden; die bestehende Auswahl bleibt erhalten.

| Übersicht | API |
| --- | --- |
| `search` / `name`, `type` | `name`, `tour_recorded` / `tour_planned` |
| `sport` (kommagetrennt oder mehrfach vorhanden) | `sport_types`, ohne doppelte Sportarten |
| `include_ebike=true` | Ergänzt die beobachteten Varianten `e_mtb_easy` zu `mtb_easy` und `e_racebike` zu `racebike`. Bei `false` oder fehlender Option werden keine Varianten ergänzt. Bereits ausdrücklich gewählte E-Sportarten bleiben erhalten. |
| `date=YYYY-MM-DD,YYYY-MM-DD` | `start_date`, `end_date`: inklusive lokaler Tagesgrenzen, als UTC-Zeitstempel und unter Berücksichtigung der Sommerzeit |
| `location=Breite,Länge,Radiusr` | `center=Breite,Länge`, `max_distance`: Radius von Kilometern in Meter umgerechnet |
| `visibility` | `visibilities` |
| `min_uphill`, `max_uphill` | Unverändert in Metern; auch explizit gesetzte Nullwerte |
| `min_length`, `max_length` | Unverändert in Metern |
| `min_duration`, `max_duration` | Unverändert in Sekunden; der beobachtete obere Reglerwert `36000` (10 Stunden / unbegrenzt) wird wie bei Komoot weggelassen |

`filter_by_duration=false` aktiviert die Längengrenzen und ignoriert eventuell noch vorhandene Dauerwerte. Bei `true` gilt das Umgekehrte. Fehlt der Umschalter, werden die vorhandenen Grenzen übernommen. Sämtliche aktiven Filter bleiben auf allen Folgeseiten erhalten.

Der Übersichtsparameter `order` wird ignoriert: Die Sortierung ändert die Auswahl nicht und blockiert weder die Filtervorschau noch das Hinzufügen.

Für weitere Sportarten werden die Bezeichner unverändert übernommen. Eine automatische E-Bike-Erweiterung anderer Sportarten wird bis zur Bestätigung ihrer API-Zuordnung mit einem Hinweis abgelehnt. Ohne ausgewählte Sportarten schränkt die E-Bike-Option allein die Abfrage nicht zusätzlich ein; das wird in der Vorschau angezeigt.

Zusätzlich stehen „Alle Touren hinzufügen“, „Alle gemachten Touren hinzufügen“ und „Alle geplanten Touren hinzufügen“ bereit. Diese drei Aktionen berücksichtigen die übrigen Filter der Übersicht nicht. Auf der jeweiligen Komoot-Seite steht die passende Typ-Aktion zuerst. Alle Aktionen ergänzen die bestehende Auswahl ohne Duplikate. So lässt sich aus mehreren Suchen ein gemeinsames Exportpaket zusammenstellen. Der Status nennt neu hinzugefügte Touren und die Gesamtzahl. Bei einem Ladefehler bleiben die bisherige Auswahl und bereits hinzugefügte Treffer erhalten; der Status meldet die unvollständige Ergänzung. „Auswahl aufheben“ entfernt sämtliche Markierungen, auch bei Touren, die gerade nicht sichtbar sind.

Die Abfrage- und Auswahlregeln liegen in `tour-selection.js`, die templatebasierte Vorschau in `filter-preview.js`. Beide Module werden laut Manifest vor `content-komoot.js` geladen. `node scripts/check-komoot-selection.mjs` prüft die Modulverträge, Vorschautexte und Auswahlabläufe. `node scripts/check-komoot-selection-browser.cjs` prüft die echte Toolbar und Vorschau in Chromium mit simulierten Komoot-Antworten; dafür muss Playwright im Node-Suchpfad verfügbar sein. Dieser Test greift nicht auf das echte Komoot-Konto zu.

Die Kopfzeile „Trailthread“ klappt die Exportleiste ein und wieder auf. Eingeklappt bleiben nur Name und Aufklapp-Pfeil sichtbar. Auswahl und laufende Exporte bleiben erhalten; die Leiste startet auf einer neu geladenen Seite eingeklappt. Der Pfeil nach oben und „Trailthread aufklappen“ öffnen sie; der Pfeil nach unten und „Trailthread einklappen“ schließen sie.

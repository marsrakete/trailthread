# Trailthread Komoot Exporthelfer

## Installation in Chrome oder Edge

1. Das ZIP-Paket entpacken.
2. `chrome://extensions` oder `edge://extensions` öffnen.
3. Den Entwicklermodus einschalten.
4. `Entpackte Erweiterung laden` wählen und den entpackten Ordner auswählen.
5. Komoot öffnen und anmelden. Auf einer Tour oder Tourliste erscheint die Trailthread-Exportleiste.

Die Erweiterung nutzt ausschliesslich die bereits angemeldete Komoot-Sitzung im Browser. Sie fragt keine Komoot-Zugangsdaten ab.

„Touren des aktuellen Filters hinzufügen“ übernimmt den Suchtext und Tourtyp der aktuellen Komoot-Übersicht. Die Erweiterung lädt sämtliche Ergebnisseiten über die bestehende Komoot-Sitzung nach, auch wenn zunächst nur 24 Karten angezeigt werden. Unterstützt werden Suchtext (`search` in der Übersicht, `name` in der API) und gemachte/geplante Touren. Weitere Filterparameter führen zu einem Hinweis; es wird dann keine ungefilterte Liste hinzugefügt.

Zusätzlich stehen „Alle Touren hinzufügen“, „Alle gemachten Touren hinzufügen“ und „Alle geplanten Touren hinzufügen“ bereit. Diese drei Aktionen berücksichtigen keinen Suchtext. Auf der jeweiligen Komoot-Seite steht die passende Typ-Aktion zuerst. Alle Aktionen ergänzen die bestehende Auswahl ohne Duplikate. So lässt sich aus mehreren Suchen ein gemeinsames Exportpaket zusammenstellen. Der Status nennt neu hinzugefügte Touren und die Gesamtzahl. Bei einem Ladefehler bleiben die bisherige Auswahl und bereits hinzugefügte Treffer erhalten; der Status meldet die unvollständige Ergänzung. „Auswahl aufheben“ entfernt sämtliche Markierungen, auch bei Touren, die gerade nicht sichtbar sind.

Die Abfrage- und Auswahlregeln liegen in `tour-selection.js`, das laut Manifest vor `content-komoot.js` geladen wird. `node scripts/check-komoot-selection.mjs` prüft die Modulverträge und Auswahlabläufe. `node scripts/check-komoot-selection-browser.cjs` prüft die echte Toolbar in Chromium mit simulierten Komoot-Antworten; dafür muss Playwright im Node-Suchpfad verfügbar sein. Dieser Test greift nicht auf das echte Komoot-Konto zu.

Die Kopfzeile „Trailthread“ klappt die Exportleiste ein und wieder auf. Eingeklappt bleiben nur Name und Aufklapp-Pfeil sichtbar. Auswahl und laufende Exporte bleiben erhalten; die Leiste startet auf einer neu geladenen Seite eingeklappt. Der Pfeil nach oben und „Trailthread aufklappen“ öffnen sie; der Pfeil nach unten und „Trailthread einklappen“ schließen sie.

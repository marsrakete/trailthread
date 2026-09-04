# Trailthread TODO

Diese Liste sammelt nächste sinnvolle Ausbaustufen für Trailthread. Sie ist bewusst knapp gehalten und soll eher Richtung und Prioritäten festhalten als schon fertige Spezifikationen.

## Status

- `erledigt`: Heatmap
- `erledigt`: Directions übersetzen
- `offen`: Abgleich Gemacht / Geplant
- `offen`: Animierter Verlauf im aktiven Track
- `offen`: Strava Anbindung für Import und Upload

## Priorität 1: Komoot-Export Und Aufräumen `offen`

Die Browser-Erweiterung ist der aktuelle Komoot-Weg. Die ältere Proxy-Anbindung bleibt im Repository, wird aber nicht weiter ausgebaut.

1. ~~Die Browser-Erweiterung muss beim Download den Komoot-Status `gemacht` oder `geplant` in das Trailthread-Exportformat schreiben. Der Import soll diesen Wert in den Tracktyp übernehmen, damit die Bibliotheksfilter funktionieren.~~ `erledigt`
2. ~~Die Schaltfläche `GPX importieren` wird zu `Tracks importieren`. Sie akzeptiert GPX-Dateien sowie Trailthread-Sicherungen und erkennt das jeweilige Format automatisch.~~ `erledigt`
3. ~~Der Einstieg für die Komoot-Browser-Erweiterung wird als kompakte Kachel vor `Konten` in die linke Seitenleiste verschoben.~~ `erledigt`
4. ~~Der Bereich `Konten` und die zugehörige lokale Passwortspeicherung werden aus der Oberfläche und dem aktiven Datenpfad entfernt.~~ `erledigt`
5. ~~Der Kasten `Schnell starten` wird aus der Oberfläche entfernt.~~ `erledigt`
6. ~~Der PHP-Proxy bleibt als historische Implementierung im Repository, wird in der README aber klar als obsolet markiert.~~ `erledigt`
7. ~~Das PowerShell-Proxy-Skript bleibt ebenfalls als historische Implementierung im Repository und wird in der README als obsolet markiert.~~ `erledigt`
8. ~~Deutsche Texte in Oberfläche, README und TODO werden mit korrekten Umlauten geschrieben.~~ `erledigt`
9. ~~Die Galerie-Ansichten erhalten eine Vollbildansicht für Fotos und Bildserien.~~ `erledigt`
10. ~~Die aus Komoot importierte Timeline wird in der Track-Detailansicht als chronologische Liste mit Highlights, Tipps und Empfehlungen angezeigt.~~ `erledigt`
11. ~~Import und Export von KML/KMZ mit Tracks, Trailthread-Metadaten, Bildern und Bildmetadaten ergänzen. Für Trailthread-spezifische Angaben wird ein dokumentiertes `ExtendedData`-Profil verwendet.~~ `erledigt`

## Code-Aufräumen Nach AGENTS-Review

- `erledigt`: Die sichtbaren KML/KMZ-Importfehler wurden aus dem Datenpfad in `translations.js` ausgelagert und für Deutsch, Englisch und Französisch ergänzt.
- `offen`: Die besonders langen, kompakten Bereiche in [app.js](/C:/Projekte/trailthread/app.js:42) und den Render-/Event-Handlern in kleine, klar abgegrenzte Funktionen aufteilen. Dabei verschachtelte Ternaries und Einzeiler schrittweise durch lesbare `if`/`else`-Blöcke ersetzen.
- `offen`: Wiederkehrende UI-Markups, die in JavaScript als große HTML-Strings erzeugt werden, auf vorhandene `<template>`-Elemente oder strukturierte DOM-Erzeugung umstellen. XML-Serialisierung für KML/KMZ bleibt davon ausgenommen.

## Nächste Ideen

### ~~1. Heatmap~~

Trailthread soll sichtbar machen, welche Bereiche besonders oft gefahren oder gegangen wurden.

Mögliche Richtung:
- Heatmap über alle passenden Tracks eines Bereichs
- getrennt nach Aktivitätsarten wie Rad, Laufen, Wandern
- optional nur für ausgewählte Tracks oder Favoriten

Nutzen:
- Wiederholte Lieblingsrouten werden sofort sichtbar
- Viel genutzte Korridore und Hotspots lassen sich leichter erkennen

### 2. Abgleich Gemacht / Geplant `offen`

Geplante und gemachte Tracks derselben Runde sollen besser miteinander verglichen werden können.

Mögliche Richtung:
- passende geplante und gemachte Runde automatisch erkennen
- Start, Ziel, Distanz und Streckenverlauf vergleichen
- Abweichungen sichtbar machen

Nutzen:
- Schnell sehen, ob die geplante Runde so gefahren oder gegangen wurde
- Unterschiede zwischen Plan und Realität besser verstehen

### ~~3. Directions Übersetzen~~

Rohwerte und Flags aus den Komoot-Directions sollen in verständliche Sprache übersetzt werden.

Beispiele:
- `TLS`
- technische Richtungs- oder Manöver-Kürzel
- interne Typwerte aus den Navigationsdaten

Nutzen:
- Replay und Detailansicht werden deutlich lesbarer
- Navigationshinweise wirken weniger technisch und mehr alltagstauglich

### 4. Animierter Verlauf Im Aktiven Track `offen`

Der aktuell aktive Track soll auf der Karte lebendiger und besser lesbar dargestellt werden.

Mögliche Richtung:
- animierter Flow entlang des aktiven Tracks
- dezente Bewegung statt unruhiger Effekte
- nur für den gerade hervorgehobenen Track

Nutzen:
- Aktiver Track hebt sich klarer von anderen ab
- Richtung und Dynamik werden schneller erfasst

### 5. Strava Anbindung Für Import Und Upload `offen`

Trailthread soll Strava als zusätzliche Plattform anbinden, nicht nur für den Import, sondern auch für den Export eigener Tracks.

Mögliche Richtung:
- OAuth-Verbindung mit einem Strava-Konto
- Aktivitäten aus Strava in die Bibliothek laden
- ausgewählte Trailthread-Tracks als GPX zu Strava hochladen
- Upload-Status und Fehler sauber in der UI anzeigen

Nutzen:
- Offizieller API-Weg statt fragiler Web-Workarounds
- Einfacherer Austausch zwischen Trailthread und Strava
- Spannender Ausbaupfad für Import, Export und späteren Sync

### 6. FIT-Sensordaten Zu Bestehendem Track Ergänzen `offen`

Zeitgleich zu einer Komoot-Tour aufgezeichnete FIT-Dateien sollen gezielt Messwerte an einen bestehenden Trailthread-Track ergänzen können.

Mögliche Richtung:
- FIT-Datei an einem ausgewählten vorhandenen Track importieren, ohne dessen GPX-Geometrie zu ersetzen
- Zeitstempel der FIT-Aufzeichnung mit den Trackpunkten abgleichen
- erkannte Messreihen vor der Übernahme anzeigen und einzeln auswählbar machen
- zunächst Kadenz, Temperatur und Herzfrequenz in BPM unterstützen
- nur ausgewählte Werte übernehmen und vorhandene Trackwerte nicht stillschweigend überschreiben
- ergänzte Sensordaten im Track-Backup erhalten und in Detailansicht, Profil oder Replay sinnvoll anzeigen

Nutzen:
- Komoot-Track bleibt die Routenbasis, FIT liefert die fehlenden Sensorwerte
- Fahrraddaten aus Garmin und ähnlichen Geräten werden ohne vollständigen Track-Neuimport nutzbar
- Nutzer behalten die Kontrolle darüber, welche persönlichen Gesundheits- und Leistungsdaten gespeichert werden

## Hinweis

Diese Punkte sind bewusst noch offen formuliert. Vor der Umsetzung sollte jeweils entschieden werden, wie stark der Fokus auf Analyse, Orientierung oder visuelle Wirkung liegen soll.

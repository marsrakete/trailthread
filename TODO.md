# Trailthread TODO

Diese Liste sammelt naechste sinnvolle Ausbaustufen fuer Trailthread. Sie ist bewusst knapp gehalten und soll eher Richtung und Prioritaeten festhalten als schon fertige Spezifikationen.

## Status

- `erledigt`: Heatmap
- `erledigt`: Directions Uebersetzen
- `offen`: Abgleich Gemacht / Geplant
- `offen`: Animierter Verlauf im aktiven Track
- `offen`: Strava Anbindung fuer Import und Upload

## Naechste Ideen

### ~~1. Heatmap~~

Trailthread soll sichtbar machen, welche Bereiche besonders oft gefahren oder gegangen wurden.

Moegliche Richtung:
- Heatmap ueber alle passenden Tracks eines Bereichs
- getrennt nach Aktivitaetsarten wie Rad, Laufen, Wandern
- optional nur fuer ausgewaehlte Tracks oder Favoriten

Nutzen:
- Wiederholte Lieblingsrouten werden sofort sichtbar
- Viel genutzte Korridore und Hotspots lassen sich leichter erkennen

### 2. Abgleich Gemacht / Geplant `offen`

Geplante und gemachte Tracks derselben Runde sollen besser miteinander verglichen werden koennen.

Moegliche Richtung:
- passende geplante und gemachte Runde automatisch erkennen
- Start, Ziel, Distanz und Streckenverlauf vergleichen
- Abweichungen sichtbar machen

Nutzen:
- Schnell sehen, ob die geplante Runde so gefahren oder gegangen wurde
- Unterschiede zwischen Plan und Realitaet besser verstehen

### ~~3. Directions Uebersetzen~~

Rohwerte und Flags aus den Komoot-Directions sollen in verstaendliche Sprache uebersetzt werden.

Beispiele:
- `TLS`
- technische Richtungs- oder Manoever-Kuerzel
- interne Typwerte aus den Navigationsdaten

Nutzen:
- Replay und Detailansicht werden deutlich lesbarer
- Navigationshinweise wirken weniger technisch und mehr alltagstauglich

### 4. Animierter Verlauf Im Aktiven Track `offen`

Der aktuell aktive Track soll auf der Karte lebendiger und besser lesbar dargestellt werden.

Moegliche Richtung:
- animierter Flow entlang des aktiven Tracks
- dezente Bewegung statt unruhiger Effekte
- nur fuer den gerade hervorgehobenen Track

Nutzen:
- Aktiver Track hebt sich klarer von anderen ab
- Richtung und Dynamik werden schneller erfasst

### 5. Strava Anbindung Fuer Import Und Upload `offen`

Trailthread soll Strava als zusaetzliche Plattform anbinden, nicht nur fuer den Import, sondern auch fuer den Export eigener Tracks.

Moegliche Richtung:
- OAuth-Verbindung mit einem Strava-Konto
- Aktivitaeten aus Strava in die Bibliothek laden
- ausgewaehlte Trailthread-Tracks als GPX zu Strava hochladen
- Upload-Status und Fehler sauber in der UI anzeigen

Nutzen:
- Offizieller API-Weg statt fragiler Web-Workarounds
- Einfacherer Austausch zwischen Trailthread und Strava
- Spannender Ausbaupfad fuer Import, Export und spaeteren Sync

## Hinweis

Diese Punkte sind bewusst noch offen formuliert. Vor der Umsetzung sollte jeweils entschieden werden, wie stark der Fokus auf Analyse, Orientierung oder visuelle Wirkung liegen soll.

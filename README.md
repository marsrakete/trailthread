# Trailthread

Desktop-orientierte PWA für große Displays mit Bibliothek, Karte und Replay:
- links: Navigation und Komoot-Erweiterung
- mitte: Trail-Bibliothek
- rechts: Karte und Replay

## Projektlinks
- GitHub Pages: [https://marsrakete.github.io/trailthread/](https://marsrakete.github.io/trailthread/)
- GitHub Repository: [https://github.com/marsrakete/trailthread](https://github.com/marsrakete/trailthread)
- Kontakt: [millux@marsrakete.de](mailto:millux@marsrakete.de)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/U7U01OC260)

## Funktionen
- GPX-Import per Dateiauswahl
- GPX-Einzelexport pro Track aus der Bibliothek
- lokale Speicherung in IndexedDB, reload-sicher
- mehrere Tracks gleichzeitig auf Leaflet/OpenStreetMap
- Komoot-Erweiterung mit konfigurierbarem Paket-Download
- Komoot-Timeline mit Highlights, Tipps und Empfehlungen in Detailansicht und Karte
- kompakte Bibliothekskarten mit begrenzter Beschreibung, Aufklappen und Timeline-Zähler
- bedarfsgesteuerte OSM-Wegtypanalyse pro Track mit lokal gespeicherten Segmenten
- Replay-Workspace mit 2D- und 3D-Ansicht
- Wiedergabe nach Zeit oder Distanz mit Profil-, Timeline- und Fotokopplung
- Trennung von gemachten und geplanten Komoot-Touren
- App-Backup für Einstellungen
- separates Touren-Backup für alle gespeicherten Tracks
- intelligenter Touren-Backup-Import mit Konfliktabfrage über `lastChanged`
- Doubletten-Erkennung beim Backup-Import
- versionierte Offline-App mit zentraler `version.js`, Service Worker und Update-Prüfung in den Einstellungen
- Deutsch, Englisch und Französisch

## Sicherheit
Trailthread arbeitet lokal und speichert keine Komoot-Passwörter. Der frühere passwortbasierte Proxy ist deaktiviert. App-Backups enthalten keine Konten.

## Backup-Formate
Wichtig für den Unterschied zwischen normalem GPX-Export und Trailthread-Backup:
- Ein GPX-Export ist für den Datenaustausch mit anderen Tools gedacht.
- Ein GPX enthält üblicherweise Trackpunkte, Zeit, Höhe und einfache Metadaten.
- Fotos werden dabei normalerweise nicht in die GPX-Datei eingebettet.
- Eigene Tags haben in GPX ebenfalls keinen einheitlichen Standardplatz pro Track.
- Genau deshalb gibt es in Trailthread zusätzlich das Touren-Backup: Es bewahrt auch Fotos, Beschreibungen, eigene Tags und weitere App-Daten eines Tracks.
- Bei Komoot-Importen bleiben auch die rohen Timeline-Daten erhalten. Trailthread zeigt daraus lesbare Hinweise und setzt Marker nur für Einträge mit Koordinate oder eindeutigem Distanzbezug zum Track.

App-Backup:
- Sprache
- aktiver Workspace
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
- eigene Tags und Favoritenstatus
- Fotos inklusive gespeicherter Foto-Metadaten
- Trackpunkte und daraus abgeleitete Werte wie Distanz, Bergauf und Bergab
- importbezogene Metadaten wie Quelle, Datum, Sportart, Komoot-Infos und Farbauswahl
- lokal abgeleitete Wegtypsegmente aus einer auf Klick gestarteten OpenStreetMap-Analyse
- `lastChanged` je Track für spätere Merge-Entscheidungen beim Reimport
- Exportzeitpunkt
- `appVersion` und `cacheVersion`

Wichtig:
- Das App-Backup enthält keine Touren oder GPX-Dateien.
- Das Touren-Backup enthält keine Passwörter oder App-Einstellungen.
- Ein Touren-Backup kann komplett oder nur für die aktuell ausgewählten Tracks erstellt werden.
- Auch Teil-Backups bleiben später wieder importierbar und laufen durch denselben Merge mit `lastChanged`.
- Dadurch lassen sich einzelne Tracks inklusive Fotos, Beschreibungen, Tags und Metadaten gezielt mit anderen Nutzern teilen.
- Beim Reimport von Touren-Backups werden Tracks mit gleicher ID anhand von `lastChanged` verglichen und bei Bedarf einzeln zur Überschreibung bestätigt.

## OSM-Wegtypen

Der Bibliotheksbutton `Wegtypen aus OSM analysieren` fragt bei Bedarf nur Wege mit einem OSM-`highway`-Tag nahe gleichmäßig verteilter Trackpunkte ab. Trailthread ordnet dem jeweils nächstgelegenen Weg den Wegetyp zu und speichert daraus abgeleitete Segmentdaten direkt am lokalen Track. GPX, Timeline, Fotos und Untergrunddaten bleiben unverändert. Die öffentliche OSM-Abfrage erfolgt nur nach ausdrücklichem Klick; die OSM-Rohantwort wird nicht gespeichert. Die Qualität hängt von der aktuellen OSM-Datenpflege und der räumlichen Nähe paralleler Wege ab.

## Update-Mechanismus
- Die PWA führt ihre sichtbare Version zentral in [version.js](/C:/Projekte/trailthread/version.js:1).
- `app.js` und `sw.js` lesen `appVersion`, `cacheVersion` und Label aus dieser einen Datei.
- In den Einstellungen zeigt der Bereich `Aktualisierungen` die lokale Version an und kann eine neuere `version.js` per `cache: "no-cache"` prüfen.
- Wenn `appVersion` oder `cacheVersion` abweichen, wird ein Reload angeboten, damit die neue Offline-Version aktiv wird.

## UTF-8-Prüfung

`node scripts/check-encoding.js` prüft alle gepflegten Quelltextdateien auf typische UTF-8-/Windows-1252-Schäden und beendet sich bei einem Fund mit Fehlerstatus. Die Prüfung lässt generierte Downloads, Schnappschüsse und Git-Metadaten aus.

`node scripts/repair-mojibake.js <datei>` zeigt bekannte Reparaturen nur an. Erst `node scripts/repair-mojibake.js --write <datei>` schreibt sie in die ausdrücklich angegebene Datei. Damit bleibt eine Korrektur nachvollziehbar und verändert nie stillschweigend den Bestand.

## Historischer Komoot-Proxy

Der PHP-Proxy und die beiden PowerShell-Skripte bleiben als historische Referenz im Repository. Sie sind **obsolet** und werden von Trailthread nicht mehr gestartet, angesprochen oder mit Zugangsdaten versorgt. Die aktive Komoot-Integration ist ausschließlich die Browser-Erweiterung.

Das frühere Proxy-Konzept basierte auf lokal gespeicherten Komoot-Passwörtern. Wenn künftig eine offizielle Komoot- oder Strava-Schnittstelle verfügbar ist, soll sie als neuer OAuth-basierter Connector entstehen, nicht durch Reaktivierung des Passwort-Proxys.

## Browser-Erweiterung Für Komoot

Der aktive Komoot-Weg liegt unter `browser-extension/`: der **Trailthread Komoot Exporthelfer**. Die Erweiterung wird in Chrome oder Edge über die Erweiterungsverwaltung im Entwicklermodus aus diesem Ordner entpackt geladen. Sie arbeitet auf `komoot.com` und `komoot.de` und setzt eine bereits im Browser bestehende Komoot-Anmeldung voraus.

Die App bietet dafür in der linken Seitenleiste ein fertiges ZIP-Paket unter `downloads/trailthread-komoot-exporthelfer.zip` an. Die URL des Download-Buttons steht zentral in `config.js` als `komootExtensionDownloadUrl`; für eine Release- oder externe Download-Adresse muss nur dieser Wert angepasst werden. Das Paket wird nach Änderungen mit `./package-browser-extension.ps1` neu erstellt.

Auf Tourlisten fügt sie eine Auswahl je Tour und zwei Exportaktionen ein. `Ausgewählte GPX-Dateien herunterladen` lädt jede Auswahl nacheinander als einzelne GPX-Datei. `Als Trailthread-Datei mit Bildern exportieren` ruft jede Auswahl über die von Komoot selbst verwendete GPX-Download-Route in der bereits eingeloggten Browser-Sitzung ab, lädt die verfügbaren Tourbilder und erstellt daraus eine gemeinsame Datei `trailthread-komoot-touren.json.gz`. Dafür werden keine einzelnen Tour-Unterseiten geöffnet. Die Datei kann direkt über den Touren-Backup-Import von Trailthread eingelesen werden.

Das Paket verwendet Trailthreads bestehendes Sicherungsformat `gpx-bibliothek-touren` in Version `1`. Es enthält den GPX-Text, Komoot-Tour-ID, URL, Titel und Beschreibung aus den Tourdetails, eingebettete Bilddaten und vorhandene Bildpositionen auf der Route. Einzelne nicht verfügbare Bilder bleiben als Referenz mit einer Fehlermeldung im Paket erhalten; der übrige Export bleibt nutzbar.

Die Erweiterung speichert weder Passwort noch Cookies noch Tokens. Komoot-Freigaben und die sichtbare GPX-Exportfunktion bleiben maßgeblich. Da die Erweiterung auf der sichtbaren Komoot-Oberfläche arbeitet, kann eine Änderung des Seitendesigns einzelne Schritte beeinträchtigen. Das Popup selbst enthält bewusst keine eigene Export-Aktion mehr, sondern verweist nur noch auf die Leiste direkt in der Komoot-Seite.

Beim Export fragt die Erweiterung alle Seiten von Komoots Tour-Bildreferenzen ab und lädt die Bilder in die Sicherungsdatei. Der GPX-Export bleibt erfolgreich, falls einzelne Bilder nicht verfügbar sind; die Sicherung enthält dann den entsprechenden Bildfehler.

## KML Und KMZ

`Tracks importieren` akzeptiert neben GPX und Trailthread-Sicherungen auch `.kml` und `.kmz`. Eine normale KML-Datei wird als Track mit Name, Beschreibung und Linienpunkten importiert. Eine KMZ-Datei darf ihre KML und Bilder komprimiert bündeln; Trailthread liest sowohl unkomprimierte als auch Deflate-komprimierte ZIP-Einträge.

Im Ausklappmenü neben `Ausgewählte GPX exportieren` gibt es zwei KMZ-Ziele. `Als kompatible KMZ mit Foto-Pins` nutzt Track- und Foto-`Placemark`-Einträge mit lokalen Bild-Icons; diese Variante ist für Google Earth Web und KMZView gedacht. `Als KMZ mit Foto-Overlays (Google Earth Pro)` exportiert lokal gespeicherte Fotos als KML-`PhotoOverlay`. Die Kamerarichtung folgt dem nächstgelegenen Track-Segment; dadurch wird jedes Foto als Rechteck senkrecht zur Route projiziert. In Google Earth Pro zeigt der Informationsballon dabei das Foto, nicht die interne Trailthread-JSON. Beide Varianten exportieren die Trailthread-Trackfarbe als KML-`LineStyle` mit Breite `4`. Beide Varianten enthalten die Bilddateien unter `photos/`, den Track und die Trailthread-Metadaten. Externe, nicht lokal gespeicherte HTTPS-Bildadressen bleiben in Beschreibungen als Referenz erhalten.

Für den verlustfreien Rückweg nutzt Trailthread das dokumentierte `ExtendedData`-Profil `trailthread-kmz-v1`: Jeder Track-`Placemark` enthält `Data name="trailthread:track-json"` mit allen Trailthread-Metadaten und Foto-Metadaten. Bilddateien werden darin durch ihren Pfad im KMZ referenziert. Andere KML-Programme können die normalen Linien und Foto-`Placemark`-Einträge anzeigen; unbekannte Trailthread-Felder dürfen sie ignorieren.

## Lizenz
Dieses Projekt steht unter `GPL-3.0-only`.
Siehe [LICENSE](LICENSE).

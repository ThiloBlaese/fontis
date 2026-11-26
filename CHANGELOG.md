# Changelog

Alle wesentlichen Änderungen an **Fontis** werden in dieser Datei dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), und das Projekt nutzt [Semantic Versioning](https://semver.org/lang/de/).

## [1.0.0] – 2026-11-25

Erste freie Open-Source-Veröffentlichung von **Fontis** als eigenständige, lokale Desktop-Anwendung unter der MIT-Lizenz.

### Funktionen
- **Archivtektonik & Bestandsbaum:** Beliebig tief verschachtelbare Bestände und Unterbestände mit Drag & Drop zum Verschieben und Sortieren.
- **Freie Eingabemasken:** Felder per Doppelklick anlegen, frei verschieben, skalieren, duplizieren, mit Auswahllisten versehen und automatische Fachfunktionen nutzen (Laufzeit-Auswertung, Sperrfrist-/Schutzfrist-Warnung, Signatur-Hochzählung).
- **Lokale Digitalisate:** Bilder, PDFs (inkl. Vorschaubild), Videos, Audio und Dokumente direkt am Datensatz verwalten – gespeichert im Ordner `digitalisate/` neben der jeweiligen `.db`-Datenbank.
- **Volltext- & semantische Suche:** Schnelle SQLite-FTS5-Trigram-Suche mit Jahres-Zeitraumfilter sowie optionaler lokaler semantischer Suche (`fastembed`) ohne Cloud-API.
- **Integrierte Rechtschreibprüfung:** Deutsche Rechtschreibprüfung direkt in den Textfeldern mit Korrekturvorschlägen und datenbankbezogenem Benutzerwörterbuch.
- **Findbuch-PDF-Export:** Druckfertige Findbücher für das gesamte Archiv oder einzelne Bestände (optional mit Ausblendung gesperrter Einheiten).
- **Import & Export:** Vollständiger Datenaustausch als JSON, Excel-kompatibles CSV und EAD-XML – jeweils mit automatischem Sicherheits-Backup vor jedem Import.
- **Lokale Backups & Mehrdatenbank-Betrieb:** Beliebige SQLite-Archive anlegen oder wechseln (inkl. Sperrdatei-Schutz), automatische Backups alle 48 Stunden (Rotation der letzten 15 Sicherungen) sowie manuelle Sicherung und Wiederherstellung.
- **Desktop-Bedienung:** Natives Anwendungsfenster (`pywebview`), frei verschiebbare Schnellzugriffsleiste, vollständige Menüleiste und Tastaturkürzel (`Strg+N`, `Strg+←/→`, `Strg+J`, `Strg+F`, `Strg+B`, `Strg+Entf`, `F1`, `F2`, `F11`).

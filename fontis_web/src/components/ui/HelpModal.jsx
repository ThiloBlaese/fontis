import React from 'react';
import { 
    HelpCircle, X, MousePointer2, Move, Layout, Layers, Copy, 
    MoreVertical, DownloadCloud, Clock, AlertTriangle, Hash, 
    Maximize2, CheckCircle2, Sparkles, Search, List
} from 'lucide-react';

const HelpModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 sm:p-6 animate-modal-backdrop">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-modal-content relative border border-slate-200">

                {/* Header */}
                <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-3.5">
                        <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl shadow-sm border border-slate-200">
                            <HelpCircle size={20} className="text-slate-700" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-800 tracking-tight">Hilfe & Anleitung</h2>
                            <p className="text-xs text-slate-500 font-medium">Fontis – Freies Archivsystem</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer"
                        title="Schließen"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 sm:px-8 py-6 overflow-y-auto bg-slate-50/50 space-y-6">

                    {/* Section 1: Steuerung & Bedienung */}
                    <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2.5 mb-4 pb-2.5 border-b border-slate-100">
                            <Layout size={20} className="text-slate-600" />
                            <h3 className="text-base font-semibold text-slate-800">1. Arbeitsfläche & Felder bedienen</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Doppelklick: Neue Felder */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3.5">
                                <div className="p-2 bg-slate-200/70 text-slate-700 rounded-lg shrink-0 h-fit mt-0.5">
                                    <MousePointer2 size={20} />
                                </div>
                                <div className="text-sm">
                                    <h4 className="font-semibold text-slate-800 mb-1">Neues Feld anlegen</h4>
                                    <p className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                                        Klicken Sie einfach <strong>doppelt</strong> auf eine freie Stelle der Fläche.
                                    </p>
                                </div>
                            </div>

                            {/* Felder bewegen */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3.5">
                                <div className="p-2 bg-slate-200/70 text-slate-700 rounded-lg shrink-0 h-fit mt-0.5">
                                    <Move size={20} />
                                </div>
                                <div className="text-sm">
                                    <h4 className="font-semibold text-slate-800 mb-1">Feld verschieben</h4>
                                    <p className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                                        Halten Sie das <strong>Pfeil-Symbol</strong> oben links am Feld gedrückt und ziehen Sie es an die gewünschte Stelle.
                                    </p>
                                </div>
                            </div>

                            {/* Größe & Form */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3.5">
                                <div className="p-2 bg-slate-200/70 text-slate-700 rounded-lg shrink-0 h-fit mt-0.5">
                                    <Maximize2 size={20} />
                                </div>
                                <div className="text-sm">
                                    <h4 className="font-semibold text-slate-800 mb-1">Größe anpassen</h4>
                                    <p className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                                        Ziehen Sie an der <strong>Ecke unten rechts</strong>, um ein Feld breiter, schmaler, höher oder flacher zu machen.
                                    </p>
                                </div>
                            </div>

                            {/* Bestandsbaum */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3.5">
                                <div className="p-2 bg-slate-200/70 text-slate-700 rounded-lg shrink-0 h-fit mt-0.5">
                                    <Layers size={20} />
                                </div>
                                <div className="text-sm">
                                    <h4 className="font-semibold text-slate-800 mb-1">Bestände organisieren</h4>
                                    <p className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                                        Im linken Baum können Sie Bestände neu anlegen, umbenennen oder mit der Maus verschieben.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Suchvorschau Hinweis */}
                        <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                            <Search size={16} className="text-slate-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-700 leading-relaxed">
                                <strong className="text-slate-800">Suchergebnis-Vorschau:</strong> Das Feld mit der Bezeichnung <strong>„Titel“</strong> oder <strong>„Betreff“</strong> (mit Lupe-Symbol) wird in der Suchliste als Überschrift verwendet. Gibt es kein Titelfeld, dient das Feld ganz oben links als Vorschau.
                            </p>
                        </div>
                    </div>

                    {/* Section 2: Spezialfelder */}
                    <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2.5 mb-2 pb-2.5 border-b border-slate-100">
                            <Sparkles size={20} className="text-slate-600" />
                            <div>
                                <h3 className="text-base font-semibold text-slate-800">2. Felder mit Sonderfunktionen</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Bestimmte Feldnamen lösen im System praktische Automatismen aus:
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {/* Titel / Betreff */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-slate-600 text-white rounded-lg shadow-sm">
                                            <Search size={16} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800 text-sm">Titel / Betreff</h4>
                                            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Feldname: „Titel“ oder „Betreff“</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed mt-2">
                                        Der Name oder Hauptbetreff des Dokuments.
                                    </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-slate-200 text-[11px] text-slate-600 flex items-start gap-1.5">
                                    <CheckCircle2 size={14} className="text-slate-600 shrink-0 mt-0.5" />
                                    <span>Erhält das <strong>Lupe-Icon</strong> und wird in der Suche als Hauptüberschrift gezeigt.</span>
                                </div>
                            </div>

                            {/* Laufzeit */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-[#66A8CB] text-white rounded-lg shadow-sm">
                                            <Clock size={16} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800 text-sm">Laufzeit</h4>
                                            <span className="text-[11px] font-semibold text-[#66A8CB] uppercase tracking-wide">Feldname enthält „Laufzeit“</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed mt-2">
                                        Für Jahreszahlen und Zeiträume (z. B. <code className="bg-white px-1 py-0.5 rounded border text-[11px] text-slate-700">1920-1945</code> oder <code className="bg-white px-1 py-0.5 rounded border text-[11px] text-slate-700">1890</code>).
                                    </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-slate-200 text-[11px] text-slate-600 flex items-start gap-1.5">
                                    <CheckCircle2 size={14} className="text-[#66A8CB] shrink-0 mt-0.5" />
                                    <span>Ermöglicht das <strong>gezielte Suchen und Eingrenzen nach Jahren</strong>.</span>
                                </div>
                            </div>

                            {/* Sperrfrist / Schutzfrist */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-[#CC823F] text-white rounded-lg shadow-sm">
                                            <AlertTriangle size={16} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800 text-sm">Sperrfrist / Schutzfrist</h4>
                                            <span className="text-[11px] font-semibold text-[#CC823F] uppercase tracking-wide">„Sperrfrist“ oder „Schutzfrist“</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed mt-2">
                                        Für Sperrdaten bei vertraulichen Unterlagen (z. B. ein Endjahr wie <code className="bg-white px-1 py-0.5 rounded border text-[11px] text-slate-700">2038</code>).
                                    </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-slate-200 text-[11px] text-slate-600 flex items-start gap-1.5">
                                    <CheckCircle2 size={14} className="text-[#CC823F] shrink-0 mt-0.5" />
                                    <span>Zeigt ein <strong>orangefarbenes Warn-Icon</strong>, solange die Frist noch läuft.</span>
                                </div>
                            </div>

                            {/* Signatur */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-[#8BB158] text-white rounded-lg shadow-sm">
                                            <Hash size={16} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800 text-sm">Signatur</h4>
                                            <span className="text-[11px] font-semibold text-[#8BB158] uppercase tracking-wide">Feldname enthält „Signatur“</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed mt-2">
                                        Die feste Archivnummer (z. B. <code className="bg-white px-1 py-0.5 rounded border text-[11px] text-slate-700">Best. A / Nr. 001</code>).
                                    </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-slate-200 text-[11px] text-slate-600 flex items-start gap-1.5">
                                    <CheckCircle2 size={14} className="text-[#8BB158] shrink-0 mt-0.5" />
                                    <span>Zählt bei jedem neuen Datensatz <strong>automatisch um 1 weiter</strong>.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Drei-Punkte-Menü & Feld-Optionen */}
                    <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2.5 mb-4 pb-2.5 border-b border-slate-100">
                            <MoreVertical size={20} className="text-slate-600" />
                            <h3 className="text-base font-semibold text-slate-800">3. Drei-Punkte-Menü an Feldern</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-2 mb-1.5 text-slate-800 font-semibold text-xs">
                                    <DownloadCloud size={16} className="text-slate-500" />
                                    <span>Digitalisate</span>
                                </div>
                                <p className="text-slate-600 text-xs leading-relaxed">
                                    Bilder, Dokumente oder Videos direkt mit dem Datensatz verknüpfen.
                                </p>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-2 mb-1.5 text-slate-800 font-semibold text-xs">
                                    <Copy size={16} className="text-slate-500" />
                                    <span>Wert übernehmen</span>
                                </div>
                                <p className="text-slate-600 text-xs leading-relaxed">
                                    Übernimmt den Inhalt aus dem vorherigen Datensatz (ideal bei wiederkehrenden Angaben).
                                </p>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-2 mb-1.5 text-slate-800 font-semibold text-xs">
                                    <List size={16} className="text-slate-500" />
                                    <span>Auswahlliste</span>
                                </div>
                                <p className="text-slate-600 text-xs leading-relaxed">
                                    Schlägt bisherige Einträge vor, die Sie in diesem Feld schon einmal genutzt haben.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tip Note */}
                    <div className="bg-slate-100/70 border border-slate-200 p-4 rounded-xl flex items-start gap-3.5">
                        <MousePointer2 size={20} className="text-slate-600 shrink-0 mt-0.5" />
                        <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                            <span className="font-semibold text-slate-800">Automatisch gespeichert: </span>
                            Sie müssen nicht extra speichern – Ihre Texte werden sofort gesichert, sobald Sie das Feld verlassen. Änderungen an Größe oder Position gelten automatisch für alle Datensätze des Bestands.
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="bg-white px-6 py-4 flex items-center justify-between border-t border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">Fontis – Freies Archivsystem</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-[#66A8CB] hover:bg-[#538eaF] text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
                    >
                        Zurück
                    </button>
                </div>

            </div>
        </div>
    );
};

export default HelpModal;

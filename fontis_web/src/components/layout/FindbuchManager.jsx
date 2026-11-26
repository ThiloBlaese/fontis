import React, { useState } from 'react';
import { X, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { saveBlobWithDialog } from '../../utils/windowUtils';

export default function FindbuchManager({ isOpen, onClose, activeNodeId }) {
    const [exportScope, setExportScope] = useState('archive'); // 'archive' | 'node'
    const [hideBlocked, setHideBlocked] = useState(false);
    const [importStatus, setImportStatus] = useState(null); // null | 'uploading' | 'success' | 'error'
    const [importMessage, setImportMessage] = useState('');

    React.useEffect(() => {
        if (!isOpen) {
            setImportStatus(null);
            setImportMessage('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleExport = async () => {
        setImportStatus('uploading');
        setImportMessage('Findbuch wird generiert... Bitte warten.');
        
        try {
            const params = new URLSearchParams();
            if (exportScope === 'node' && activeNodeId) {
                params.append('node_id', activeNodeId);
            }
            if (hideBlocked) {
                params.append('hide_blocked', 'true');
            }
            const queryString = params.toString() ? `?${params.toString()}` : '';
            
            const response = await fetch(`/api/export/pdf${queryString}`);
            
            if (!response.ok) throw new Error('PDF Export fehlgeschlagen');
            const blob = await response.blob();
            const filename = `findbuch_${new Date().toISOString().split('T')[0]}.pdf`;

            const result = await saveBlobWithDialog(blob, filename, 'PDF Dokument', 'pdf');
            if (result.cancelled) {
                setImportStatus(null);
                setImportMessage('');
                return;
            }

            setImportStatus('success');
            setImportMessage(result.path ? `Findbuch gespeichert unter: ${result.path}` : 'Findbuch erfolgreich erstellt und heruntergeladen!');
            
        } catch (e) {
            setImportStatus('error');
            setImportMessage("Fehler beim Exportieren: " + e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-800/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-modal-backdrop">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] animate-modal-content">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                        <FileText className="text-[#66A8CB]" size={20} />
                        Findbuch erstellen
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md text-slate-500 transition-all active:scale-95">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    {!importStatus && (
                        <div className="space-y-4">
                            <p className="text-slate-600 text-sm">
                                Erstellen Sie ein druckfertiges Findbuch (PDF) mit Inhaltsverzeichnis und allen Datensätzen aus der aktuellen Datenbank.
                            </p>

                            <div className="p-3 rounded-lg flex items-start gap-3 bg-[#66A8CB]/10 text-[#28465A]">
                                <FileText size={20} className="shrink-0 mt-0.5 text-[#66A8CB]" />
                                <div className="text-sm font-semibold">
                                    Wählen Sie den Umfang für das Findbuch aus.
                                </div>
                            </div>

                            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                        type="radio" 
                                        name="exportScope" 
                                        value="archive" 
                                        checked={exportScope === 'archive'} 
                                        onChange={() => setExportScope('archive')}
                                        className="w-4 h-4 text-[#66A8CB] focus:ring-[#66A8CB] border-slate-300"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-800">Gesamtes Archiv</span>
                                        <span className="text-xs text-slate-500">Erstellt ein Findbuch für alle Bestände der aktuellen Datenbank.</span>
                                    </div>
                                </label>
                                
                                <label className={`flex items-center gap-3 cursor-pointer group ${!activeNodeId ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <input 
                                        type="radio" 
                                        name="exportScope" 
                                        value="node" 
                                        disabled={!activeNodeId}
                                        checked={exportScope === 'node'} 
                                        onChange={() => setExportScope('node')}
                                        className="w-4 h-4 text-[#66A8CB] focus:ring-[#66A8CB] border-slate-300"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-800">Aktueller Bestand & Unterbestände</span>
                                        <span className="text-xs text-slate-500">
                                            {activeNodeId ? 'Exportiert nur den derzeit ausgewählten Teilbaum.' : 'Kein Bestand ausgewählt.'}
                                        </span>
                                    </div>
                                </label>

                                <div className="h-px bg-slate-200 my-1"></div>

                                <label className="flex items-center gap-3 cursor-pointer group pt-1">
                                    <input 
                                        type="checkbox" 
                                        checked={hideBlocked} 
                                        onChange={(e) => setHideBlocked(e.target.checked)}
                                        className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-slate-300 rounded"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-800">Gesperrte Inhalte verbergen</span>
                                        <span className="text-xs text-slate-500">Ersetzt Details von Archivalien mit laufender Schutzfrist durch einen Warnhinweis.</span>
                                    </div>
                                </label>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    onClick={handleExport}
                                    style={{ backgroundColor: '#66A8CB' }}
                                    className="hover:brightness-90 text-white px-5 py-2.5 rounded-md font-medium transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                                >
                                    <FileText size={20} />
                                    Jetzt als Findbuch (PDF) exportieren
                                </button>
                            </div>
                        </div>
                    )}

                    {importStatus === 'uploading' && (
                        <div className="flex flex-col items-center justify-center py-8 gap-4 text-slate-600">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-[#66A8CB] rounded-full animate-spin"></div>
                            <p className="font-medium animate-pulse">{importMessage}</p>
                            <p className="text-sm text-slate-400">Das Fenster kann nach dem Start geöffnet bleiben.</p>
                        </div>
                    )}

                    {importStatus === 'success' && (
                        <div className="bg-green-50 text-green-800 p-6 rounded-lg flex flex-col items-center gap-3 text-center border border-green-200">
                            <CheckCircle size={48} className="text-green-600" />
                            <div className="font-semibold text-base">{importMessage}</div>
                            <button
                                onClick={onClose}
                                className="mt-2 bg-white text-green-700 border border-green-300 px-4 py-2 rounded-md font-medium hover:bg-green-50 transition-all active:scale-95"
                            >
                                Schließen
                            </button>
                        </div>
                    )}

                    {importStatus === 'error' && (
                        <div className="bg-red-50 text-red-800 p-6 rounded-lg flex flex-col gap-3 border border-red-200">
                            <div className="flex items-center gap-2 font-semibold text-red-700">
                                <AlertTriangle size={20} />
                                Export fehlgeschlagen
                            </div>
                            <p className="text-sm break-words">{importMessage}</p>
                            <button
                                onClick={() => setImportStatus(null)}
                                className="bg-white text-red-700 border border-red-300 px-4 py-2 rounded-md font-medium hover:bg-red-50 transition-all active:scale-95"
                            >
                                Erneut versuchen
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

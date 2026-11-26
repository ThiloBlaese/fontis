import React, { useRef, useState } from 'react';
import { DownloadCloud, HardDriveUpload, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { exportJson, importJson, exportCsv, importCsv, exportEadXml, importEadXml } from '../../api';
import ConfirmDialog from '../ui/ConfirmDialog';
import { saveBlobWithDialog } from '../../utils/windowUtils';

export default function ImportExportManager({ isOpen, onClose, activeNodeId }) {
    const [activeTab, setActiveTab] = useState('import'); // 'export' | 'import'
    const [format, setFormat] = useState('json'); // 'json' | 'csv' | 'ead'
    const [exportScope, setExportScope] = useState('archive'); // 'archive' | 'node'
    const [isAppend, setIsAppend] = useState(true);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false });
    const fileInputRef = useRef(null);

    const [importStatus, setImportStatus] = useState(null); // 'uploading', 'success', 'error'
    const [importMessage, setImportMessage] = useState('');

    // Reset status when menu is closed/reopened
    React.useEffect(() => {
        if (!isOpen) {
            setImportStatus(null);
            setImportMessage('');
        }
    }, [isOpen]);

    // EAD Mapping State
    const [eadMapping, setEadMapping] = useState({
        unittitle: 'titel',
        unitid: 'signatur',
        unitdate: 'laufzeit'
    });

    if (!isOpen) return null;


    const handleExport = async () => {
        setImportStatus('uploading');
        setImportMessage('Export wird vorbereitet...');
        
        try {
            let blob, filename, label, ext;
            if (format === 'json') {
                const data = await exportJson();
                const jsonString = JSON.stringify(data, null, 2);
                blob = new Blob([jsonString], { type: 'application/json' });
                filename = `fontis_export_${new Date().toISOString().split('T')[0]}.json`;
                label = 'JSON Datei';
                ext = 'json';
            } else if (format === 'csv') {
                const csvString = await exportCsv(exportScope === 'node' ? activeNodeId : null);
                // Add BOM for Excel UTF-8 support
                const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
                blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });
                filename = `fontis_export_${new Date().toISOString().split('T')[0]}.csv`;
                label = 'CSV Datei';
                ext = 'csv';
            } else if (format === 'ead') {
                const eadXmlString = await exportEadXml(eadMapping);
                blob = new Blob([eadXmlString], { type: 'application/xml;charset=utf-8;' });
                filename = `fontis_export_${new Date().toISOString().split('T')[0]}.xml`;
                label = 'EAD XML Datei';
                ext = 'xml';
            }

            const result = await saveBlobWithDialog(blob, filename, label, ext);
            if (result.cancelled) {
                setImportStatus(null);
                setImportMessage('');
                return;
            }

            setImportStatus('success');
            setImportMessage(result.path ? `Export gespeichert unter: ${result.path}` : 'Export erfolgreich abgeschlossen!');
            
        } catch (e) {
            setImportStatus('error');
            setImportMessage("Fehler beim Exportieren: " + e.message);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check extension
        const expectedExt = format === 'ead' ? '.xml' : `.${format}`;
        if (!file.name.toLowerCase().endsWith(expectedExt)) {
            alert(`Bitte wählen Sie eine ${expectedExt} Datei aus.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
    };

    const triggerImportClick = () => {
        const file = fileInputRef.current?.files[0];
        if (!file) {
            alert("Bitte wählen Sie zuerst eine Datei aus.");
            return;
        }
        setConfirmDialog({ isOpen: false }); 
        setConfirmDialog({ isOpen: true });
    };

    const confirmImport = async () => {
        setConfirmDialog({ isOpen: false });
        const file = fileInputRef.current?.files[0];
        if (!file) return;

        setImportStatus('uploading');
        setImportMessage('Importiere Daten...');

        try {
            let resp;
            if (format === 'json') {
                resp = await importJson(file, isAppend, activeNodeId);
            } else if (format === 'csv') {
                resp = await importCsv(file, isAppend, activeNodeId);
            } else if (format === 'ead') {
                resp = await importEadXml(file, eadMapping, isAppend, activeNodeId);
            }
            setImportStatus('success');
            setImportMessage(resp.message || 'Import erfolgreich!');

            if (!isAppend) {
                localStorage.removeItem('fontis_activeNodeId');
                localStorage.removeItem('fontis_currentRecordIndex');
            }

            // Reload the app to reflect new data after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (e) {
            setImportStatus('error');
            setImportMessage(`Fehler beim Importieren: ${e.message}`);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };


    return (
        <div className="fixed inset-0 bg-slate-800/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-modal-backdrop">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] animate-modal-content">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                        Import / Export
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md text-slate-500 transition-all active:scale-95">
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b px-6 pt-2 gap-4">
                    <button
                        onClick={() => {
                            setActiveTab('import');
                            setImportStatus(null);
                        }}
                        className={`pb-2 px-1 border-b-2 font-medium transition-colors ${activeTab === 'import' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Daten importieren
                    </button>
                    <button
                        onClick={() => { setActiveTab('export'); setImportStatus(null); }}
                        className={`pb-2 px-1 border-b-2 font-medium transition-colors ${activeTab === 'export' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Daten exportieren
                    </button>
                </div>

                {/* Format Selector */}
                <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700 mt-0.5">Format:</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="format" value="json" checked={format === 'json'} onChange={() => { setFormat('json'); setImportStatus(null); if (fileInputRef.current) fileInputRef.current.value = ''; setIsAppend(true); }} className="text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-slate-700">JSON</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="format" value="csv" checked={format === 'csv'} onChange={() => { setFormat('csv'); setImportStatus(null); if (fileInputRef.current) fileInputRef.current.value = ''; setIsAppend(true); }} className="text-amber-600 focus:ring-amber-500" />
                        <span className="text-sm text-slate-700">CSV</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="format" value="ead" checked={format === 'ead'} onChange={() => { setFormat('ead'); setImportStatus(null); if (fileInputRef.current) fileInputRef.current.value = ''; setIsAppend(true); }} className="text-teal-600 focus:ring-teal-500" />
                        <span className="text-sm text-slate-700">EAD/XML</span>
                    </label>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">

                    {activeTab === 'export' && (
                        <div className="space-y-4">
                            {!importStatus && (
                                <>
                                    <p className="text-slate-600 text-sm">
                                        Exportieren Sie das aktuelle Archiv als Datei (JSON für Sicherungen, CSV für Tabellenkalkulationen, EAD/XML für den Datenaustausch).
                                    </p>

                                    {format === 'csv' && activeNodeId && (
                                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mt-4 space-y-2 animate-fade-in">
                                            <span className="text-sm font-semibold text-slate-800 block">Export-Umfang:</span>
                                            <div className="flex flex-col gap-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="exportScope" 
                                                        value="archive" 
                                                        checked={exportScope === 'archive'} 
                                                        onChange={() => setExportScope('archive')} 
                                                        className="text-blue-600 focus:ring-blue-500" 
                                                    />
                                                    <span className="text-sm text-slate-700 font-medium">Gesamtes Archiv</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="exportScope" 
                                                        value="node" 
                                                        checked={exportScope === 'node'} 
                                                        onChange={() => setExportScope('node')} 
                                                        className="text-blue-600 focus:ring-blue-500" 
                                                    />
                                                    <span className="text-sm text-slate-700 font-medium">Nur ausgewählter Bestand und Unterbestände</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {format === 'ead' && (
                                        <div className="bg-teal-50 border border-teal-200 p-4 rounded-lg mt-4">
                                            <h3 className="text-sm font-semibold text-teal-800 mb-2">EAD Feld-Zuordnung</h3>
                                            <p className="text-xs text-teal-700 mb-3 block">Namen oder IDs der Felder für die EAD-Elemente (z. B. „Titel“, „Signatur“, „Laufzeit“):</p>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">&lt;unittitle&gt; (Titel)</label>
                                                    <input type="text" value={eadMapping.unittitle} onChange={(e) => setEadMapping({ ...eadMapping, unittitle: e.target.value })} className="w-full text-sm border-slate-300 rounded focus:ring-teal-500 focus:border-teal-500 shadow-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">&lt;unitid&gt; (Signatur)</label>
                                                    <input type="text" value={eadMapping.unitid} onChange={(e) => setEadMapping({ ...eadMapping, unitid: e.target.value })} className="w-full text-sm border-slate-300 rounded focus:ring-teal-500 focus:border-teal-500 shadow-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">&lt;unitdate&gt; (Laufzeit)</label>
                                                    <input type="text" value={eadMapping.unitdate} onChange={(e) => setEadMapping({ ...eadMapping, unitdate: e.target.value })} className="w-full text-sm border-slate-300 rounded focus:ring-teal-500 focus:border-teal-500 shadow-sm" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-4 flex justify-end">
                                        <button
                                            onClick={handleExport}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-medium transition-all active:scale-95 flex items-center gap-2 shadow-sm cursor-pointer"
                                        >
                                            <DownloadCloud size={20} />
                                            Als {format.toUpperCase()} exportieren
                                        </button>
                                    </div>
                                </>
                            )}
                            {importStatus === 'uploading' && (
                                <div className="flex flex-col items-center justify-center py-8 gap-4 text-slate-600">
                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                                    <p className="font-medium animate-pulse">{importMessage}</p>
                                </div>
                            )}

                            {importStatus === 'success' && (
                                <div className="bg-green-50 text-green-800 p-6 rounded-lg flex flex-col items-center gap-3 text-center border border-green-200">
                                    <CheckCircle size={48} className="text-green-600" />
                                    <div className="font-semibold text-base">{importMessage}</div>
                                    <button
                                        onClick={() => setImportStatus(null)}
                                        className="mt-2 bg-white text-green-700 border border-green-300 px-4 py-2 rounded-md font-medium hover:bg-green-50 transition-all active:scale-95"
                                    >
                                        Zurück
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
                                        className="mt-2 bg-white text-red-700 border border-red-300 px-4 py-2 rounded-md font-medium hover:bg-red-50 transition-all active:scale-95 self-start"
                                    >
                                        Erneut versuchen
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'import' && (
                        <div className="space-y-4">

                            {!importStatus && (
                                <>
                                    <div className={`p-3.5 rounded-lg flex flex-col gap-1.5 border ${isAppend ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                                        <div className={`flex items-center gap-2 font-semibold text-sm ${isAppend ? 'text-blue-700' : 'text-amber-700'}`}>
                                            {isAppend ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                            {isAppend ? 'Daten anhängen' : 'Achtung: Bestehende Daten werden ersetzt'}
                                        </div>
                                        <p className="text-xs text-slate-700">
                                            {isAppend 
                                                ? `Die Inhalte der ${format.toUpperCase()}-Datei werden als neue Bestände ergänzt. Bestehende Daten bleiben erhalten.`
                                                : `Alle Daten der aktuellen Datenbank werden durch die ${format.toUpperCase()}-Datei ersetzt (vorab wird automatisch ein Backup erstellt).`
                                            }
                                        </p>
                                    </div>

                                    {format === 'ead' && (
                                        <div className="bg-teal-50 border border-teal-200 p-4 rounded-lg mt-4">
                                            <h3 className="text-sm font-semibold text-teal-800 mb-2">EAD Feld-Zuordnung</h3>
                                            <p className="text-xs text-teal-700 mb-3 block">Namen oder IDs der Zielfelder (z. B. „titel“, „signatur“, „laufzeit“):</p>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">Von &lt;unittitle&gt; nach:</label>
                                                    <input type="text" value={eadMapping.unittitle} onChange={(e) => setEadMapping({ ...eadMapping, unittitle: e.target.value })} className="w-full text-sm border-slate-300 rounded focus:ring-teal-500 focus:border-teal-500 shadow-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">Von &lt;unitid&gt; nach:</label>
                                                    <input type="text" value={eadMapping.unitid} onChange={(e) => setEadMapping({ ...eadMapping, unitid: e.target.value })} className="w-full text-sm border-slate-300 rounded focus:ring-teal-500 focus:border-teal-500 shadow-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">Von &lt;unitdate&gt; nach:</label>
                                                    <input type="text" value={eadMapping.unitdate} onChange={(e) => setEadMapping({ ...eadMapping, unitdate: e.target.value })} className="w-full text-sm border-slate-300 rounded focus:ring-teal-500 focus:border-teal-500 shadow-sm" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4 space-y-3">
                                        <label className="block text-sm font-medium text-slate-700">
                                            Datei auswählen:
                                        </label>
                                        <input
                                            type="file"
                                            accept={format === 'ead' ? '.xml' : `.${format}`}
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-amber-50 file:text-amber-700
                        hover:file:bg-amber-100
                        cursor-pointer border border-slate-300 rounded-md p-2 bg-slate-50"
                                        />
                                        
                                        <label className="flex items-center gap-2 mt-4 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={isAppend} 
                                                onChange={(e) => setIsAppend(e.target.checked)} 
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                                            />
                                            <span className="text-sm font-medium text-slate-700">Daten an bestehende Archivstruktur anhängen</span>
                                        </label>
                                    </div>

                                    <div className="pt-4 flex justify-end">
                                        <button
                                            onClick={triggerImportClick}
                                            className={`${isAppend ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'} text-white px-5 py-2.5 rounded-md font-medium transition-all active:scale-95 flex items-center gap-2`}
                                        >
                                            <HardDriveUpload size={20} />
                                            Daten importieren
                                        </button>
                                    </div>
                                </>
                            )}

                            {importStatus === 'uploading' && (
                                <div className="flex flex-col items-center justify-center py-8 gap-4 text-slate-600">
                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-amber-600 rounded-full animate-spin"></div>
                                    <p className="font-medium animate-pulse">{importMessage}</p>
                                    <p className="text-sm text-slate-400">Bitte schließen Sie dieses Fenster nicht.</p>
                                </div>
                            )}

                            {importStatus === 'success' && (
                                <div className="bg-green-50 text-green-800 p-6 rounded-lg flex flex-col items-center gap-3 text-center border border-green-200">
                                    <CheckCircle size={48} className="text-green-600" />
                                    <div className="font-semibold text-base">{importMessage}</div>
                                    <p className="text-sm">Ansicht wird aktualisiert...</p>
                                </div>
                            )}

                            {importStatus === 'error' && (
                                <div className="bg-red-50 text-red-800 p-6 rounded-lg flex flex-col gap-3 border border-red-200">
                                    <div className="flex items-center gap-2 font-semibold text-red-700">
                                        <AlertTriangle size={20} />
                                        Import fehlgeschlagen
                                    </div>
                                    <p className="text-sm break-words">{importMessage}</p>
                                    <button
                                        onClick={() => setImportStatus(null)}
                                        className="mt-2 bg-white text-red-700 border border-red-300 px-4 py-2 rounded-md font-medium hover:bg-red-50 transition-all active:scale-95 self-start"
                                    >
                                        Erneut versuchen
                                    </button>
                                </div>
                            )}

                        </div>
                    )}

                </div>
            </div >

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={isAppend ? "Daten anhängen" : "Archiv-Daten überschreiben"}
                message={isAppend 
                    ? "Die neuen Daten werden an den bestehenden Archivbaum angehängt. Vorab wird automatisch ein Backup erstellt. Fortfahren?"
                    : "Alle aktuellen Daten dieser Datenbank werden ersetzt. Vorab wird automatisch ein Backup erstellt. Fortfahren?"
                }
                onConfirm={confirmImport}
                onCancel={() => setConfirmDialog({ isOpen: false })}
                confirmText={isAppend ? "Importieren & Anhängen" : "Importieren & Ersetzen"}
                isDanger={!isAppend}
            />
        </div >
    );
}

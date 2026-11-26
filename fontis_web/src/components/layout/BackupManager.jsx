import React, { useState, useEffect } from 'react';
import { X, Clock, RotateCcw, PlusCircle } from 'lucide-react';
import { fetchBackups, createBackup, restoreBackup } from '../../api';
import ConfirmDialog from '../ui/ConfirmDialog';

const BackupManager = ({ isOpen, onClose }) => {
    const [backups, setBackups] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, filename: null });

    useEffect(() => {
        if (isOpen) {
            loadBackups();
        }
    }, [isOpen]);

    const loadBackups = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchBackups();
            setBackups(data);
        } catch (e) {
            setError("Fehler beim Laden der Backups.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateBackup = async () => {
        setIsCreating(true);
        setError(null);
        try {
            await createBackup();
            await loadBackups();
        } catch (e) {
            setError("Fehler beim Erstellen des Backups.");
            console.error(e);
        } finally {
            setIsCreating(false);
        }
    };

    const handleRestoreClick = (filename) => {
        setConfirmDialog({ isOpen: true, filename });
    };

    const confirmRestore = async () => {
        const filename = confirmDialog.filename;
        setConfirmDialog({ isOpen: false, filename: null });

        setIsLoading(true);
        try {
            await restoreBackup(filename);
            alert("Backup erfolgreich wiederhergestellt! Die Anwendung wird nun neu geladen.");
            window.location.reload();
        } catch (e) {
            alert("Fehler bei der Wiederherstellung: " + e.message);
            setIsLoading(false);
        }
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleString('de-DE', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-modal-backdrop">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-content">

                {/* Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3 text-slate-700">
                        <Clock className="text-blue-600" size={20} />
                        <h2 className="text-base font-semibold">Sicherheitskopien (Backups)</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <p className="text-sm text-slate-500">
                            Automatische Sicherungen der Archiv-Datenbank (alle 48 Stunden beim Start, maximal 15 Versionen, ohne Digitalisate).
                        </p>
                        <button
                            onClick={handleCreateBackup}
                            disabled={isCreating || isLoading}
                            className="shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#66A8CB] hover:bg-[#528cae] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                            <PlusCircle size={16} />
                            <span>{isCreating ? 'Erstelle...' : 'Jetzt Backup erstellen'}</span>
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 mb-4 text-sm text-red-700 bg-red-50 rounded border border-red-200">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                    ) : backups.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                            Noch keine Sicherheitskopien vorhanden. Sie können jederzeit über die Schaltfläche oben manuell eine Sicherung anlegen.
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Datum / Uhrzeit</th>
                                        <th className="px-4 py-3 font-medium">Größe</th>
                                        <th className="px-4 py-3 font-medium text-right">Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-slate-700">
                                    {backups.map((backup, index) => (
                                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-medium">
                                                {formatDate(backup.timestamp)}
                                                {index === 0 && <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Neuestes</span>}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {formatBytes(backup.size_bytes)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end">
                                                    <button
                                                        onClick={() => handleRestoreClick(backup.filename)}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded text-xs font-medium transition-colors border border-amber-200"
                                                        title="Diesen Stand wiederherstellen"
                                                    >
                                                        <RotateCcw size={14} /> Wiederherstellen
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title="Backup wiederherstellen"
                message={`ACHTUNG: Möchten Sie das Backup "${confirmDialog.filename}" wirklich wiederherstellen?\nAlle Änderungen seit diesem Zeitpunkt gehen unwiederbringlich verloren!`}
                onConfirm={confirmRestore}
                onCancel={() => setConfirmDialog({ isOpen: false, filename: null })}
                confirmText="Wiederherstellen"
                isDanger={true}
            />
        </div>
    );
};

export default BackupManager;

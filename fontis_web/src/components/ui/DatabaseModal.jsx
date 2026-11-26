import React, { useState, useEffect } from 'react';
import { Database, FolderOpen, PlusCircle, AlertTriangle, CheckCircle, FileText, Clock } from 'lucide-react';
import { selectDatabaseFileDialog } from '../../utils/windowUtils';

const DatabaseModal = ({ isOpen, onClose, onDatabaseChanged }) => {
  const [dbInfo, setDbInfo] = useState({
    active_db_path: '',
    recent_dbs: [],
    is_locked_by_other: false,
    lock_info: null
  });
  const [newPath, setNewPath] = useState('');
  const [archiveName, setArchiveName] = useState('Neues Archiv');
  const [mode, setMode] = useState('overview'); // 'overview', 'open', 'create'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDbInfo = async () => {
    try {
      const res = await fetch('/api/system/database');
      if (res.ok) {
        const data = await res.json();
        setDbInfo(data);
      }
    } catch (e) {
      console.error('Error fetching database info:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDbInfo();
      setMode('overview');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPath = async (targetPath, isNew = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/system/database/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          db_path: targetPath,
          create_if_missing: isNew,
          archive_name: isNew ? archiveName : 'Mein Archiv'
        })
      });
      if (!res.ok) {
        throw new Error('Konnte Datenbank nicht öffnen oder anlegen.');
      }
      await fetchDbInfo();
      if (onDatabaseChanged) {
        onDatabaseChanged(targetPath);
      }
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseOpen = async () => {
    try {
      const selected = await selectDatabaseFileDialog('open');
      if (selected) {
        setNewPath(selected);
      }
    } catch (e) {
      console.error('File chooser error:', e);
    }
  };

  const handleBrowseSave = async () => {
    try {
      const defaultFilename = archiveName ? `${archiveName.toLowerCase().replace(/[^a-z0-9_-]/gi, '_')}.db` : 'archiv.db';
      const selected = await selectDatabaseFileDialog('create', defaultFilename);
      if (selected) {
        setNewPath(selected);
      }
    } catch (e) {
      console.error('File chooser error:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#66A8CB]/10 text-[#66A8CB] rounded-xl">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Archiv-Datenbank verwalten</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Database Info Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aktive Datenbank</span>
              {dbInfo.is_locked_by_other && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={14} /> Von anderem Nutzer geöffnet
                </span>
              )}
            </div>

            <div className="font-mono text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 break-all select-all">
              {dbInfo.active_db_path || 'Keine Datei aktiv'}
            </div>

            {dbInfo.is_locked_by_other && dbInfo.lock_info && (
              <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                Achtung: Diese Datei wird aktuell bearbeitet von <strong>{dbInfo.lock_info.user}</strong> auf Rechner <strong>{dbInfo.lock_info.host}</strong> ({dbInfo.lock_info.human_time}).
              </p>
            )}
          </div>

          {/* Action Selector */}
          {mode === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setMode('open'); setNewPath(''); }}
                  className="p-3.5 border border-slate-200 hover:border-[#66A8CB] hover:bg-[#66A8CB]/5 rounded-xl text-left transition-all group flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-700 text-xs group-hover:text-[#66A8CB]">
                    <FolderOpen size={16} /> Bestehende Datei öffnen
                  </div>
                  <span className="text-[11px] text-slate-500 leading-tight">Pfad zu einer vorhandenen .db Datei angeben</span>
                </button>

                <button
                  onClick={() => { setMode('create'); setNewPath(''); }}
                  className="p-3.5 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/5 rounded-xl text-left transition-all group flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-700 text-xs group-hover:text-emerald-600">
                    <PlusCircle size={16} /> Neue Datenbank anlegen
                  </div>
                  <span className="text-[11px] text-slate-500 leading-tight">Ein leeres Archiv an beliebigem Ort erstellen</span>
                </button>
              </div>

              {/* Recent Databases List */}
              {dbInfo.recent_dbs && dbInfo.recent_dbs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock size={14} /> Zuletzt geöffnete Datenbanken
                  </h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                    {dbInfo.recent_dbs.map((p, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors ${
                          p === dbInfo.active_db_path ? 'bg-blue-50/40 font-medium' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate mr-2">
                          <FileText size={14} className="text-slate-400 shrink-0" />
                          <span className="truncate text-slate-700 font-mono text-[11px]">{p}</span>
                        </div>
                        {p === dbInfo.active_db_path ? (
                          <span className="text-[11px] bg-[#66A8CB] text-white px-2 py-0.5 rounded-full shrink-0">Aktiv</span>
                        ) : (
                          <button
                            onClick={() => handleSelectPath(p, false)}
                            disabled={loading}
                            className="text-xs text-[#66A8CB] hover:underline font-semibold shrink-0 cursor-pointer"
                          >
                            Öffnen
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode: Open Existing */}
          {mode === 'open' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Dateipfad zur bestehenden .db Datei:</span>
                <button onClick={() => setMode('overview')} className="text-xs text-slate-500 hover:underline cursor-pointer">
                  Zurück
                </button>
              </div>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="/pfad/zum/archiv.db oder Z:\Archiv\archiv.db"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  className="flex-1 text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#66A8CB]"
                />
                <button
                  type="button"
                  onClick={handleBrowseOpen}
                  className="px-3 py-2.5 bg-white border border-slate-200 hover:border-[#66A8CB] hover:bg-[#66A8CB]/10 text-slate-700 hover:text-[#66A8CB] text-xs font-medium rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95"
                >
                  <FolderOpen size={16} />
                  <span>Durchsuchen...</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Tipp: Auch Netzwerk-Pfade (z. B. auf einem gemeinsamen Netzlaufwerk Ihrer Organisation) werden unterstützt.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setMode('overview')}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleSelectPath(newPath, false)}
                  disabled={!newPath.trim() || loading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#66A8CB] hover:bg-[#5293b5] disabled:opacity-40 rounded-lg transition-all cursor-pointer shadow-xs"
                >
                  {loading ? 'Öffne...' : 'Datei öffnen'}
                </button>
              </div>
            </div>
          )}

          {/* Mode: Create New */}
          {mode === 'create' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Neues Archiv erstellen:</span>
                <button onClick={() => setMode('overview')} className="text-xs text-slate-500 hover:underline cursor-pointer">
                  Zurück
                </button>
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1 font-medium">Name des obersten Bestands:</label>
                <input
                  type="text"
                  placeholder="z. B. Stadtarchiv Musterstadt"
                  value={archiveName}
                  onChange={(e) => setArchiveName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1 font-medium">Speicherpfad der neuen .db Datei:</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="/pfad/zu/meinem_neuen_archiv.db"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    className="flex-1 text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseSave}
                    className="px-3 py-2.5 bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10 text-slate-700 hover:text-emerald-700 text-xs font-medium rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95"
                  >
                    <FolderOpen size={16} />
                    <span>Speicherort wählen...</span>
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setMode('overview')}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleSelectPath(newPath, true)}
                  disabled={!newPath.trim() || loading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg transition-all cursor-pointer shadow-xs"
                >
                  {loading ? 'Erstelle...' : 'Datenbank erstellen'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end text-xs text-slate-500">
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatabaseModal;

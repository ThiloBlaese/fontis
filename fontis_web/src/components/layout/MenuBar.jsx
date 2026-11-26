import React, { useState, useEffect, useRef } from 'react';
import { toggleAppFullscreen } from '../../utils/windowUtils';

const MenuBar = ({
  onOpenDatabase,
  onOpenBackups,
  onExit,
  onAddNode,
  onRenameNode,
  onDeleteNode,
  canRenameNode = false,
  canDeleteNode = false,
  onNewRecord,
  onPrevRecord,
  onNextRecord,
  onDeleteRecord,
  onOpenJumpToRecord,
  totalRecords = 0,
  canPrevRecord = false,
  canNextRecord = false,
  canDeleteRecord = false,
  hasActiveNode = false,
  isSidebarOpen = true,
  isRightSidebarOpen = false,
  onToggleSidebar,
  onToggleSearch,
  onOpenFindbuch,
  onOpenImportExport,
  spellcheckEnabled = true,
  onToggleSpellcheck,
  searchMode = 'classic',
  onToggleSearchMode,
  lowestLevelOnly = false,
  onToggleLowestLevelOnly,
  onOpenHelp,
  onOpenAbout,
  onToggleFullscreen
}) => {
  const [openMenu, setOpenMenu] = useState(null);
  const activeMenuRef = useRef(null);

  // Close menus when clicking outside the currently open menu
  useEffect(() => {
    if (!openMenu) return;

    const handleClickOutside = (e) => {
      if (activeMenuRef.current && !activeMenuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  const handleMenuClick = (menuName) => {
    setOpenMenu(openMenu === menuName ? null : menuName);
  };

  const handleMenuHover = (menuName) => {
    if (openMenu !== null && openMenu !== menuName) {
      setOpenMenu(menuName);
    }
  };

  const handleAction = (action, shouldClose = false) => {
    if (shouldClose) {
      setOpenMenu(null);
    }
    if (action) action();
  };

  const handleFullscreenAction = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      toggleAppFullscreen();
    }
  };

  return (
    <div
      className="bg-slate-100/90 border-b border-slate-200/90 px-2 h-7 flex items-center text-xs text-slate-700 select-none z-50 shrink-0 font-sans"
    >
      {/* 1. Datei */}
      <div
        ref={openMenu === 'datei' ? activeMenuRef : null}
        className="relative"
      >
        <button
          onClick={() => handleMenuClick('datei')}
          onMouseEnter={() => handleMenuHover('datei')}
          className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
            openMenu === 'datei' ? 'bg-slate-200 text-slate-900 font-medium' : 'hover:bg-slate-200/70 text-slate-700'
          }`}
        >
          Datei
        </button>

        {openMenu === 'datei' && (
          <div className="absolute top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[230px] z-50">
            <button
              onClick={() => handleAction(onOpenDatabase, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Datenbank verwalten / wechseln...</span>
            </button>

            <button
              onClick={() => handleAction(onOpenBackups, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Sicherheitskopien verwalten...</span>
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              onClick={() => handleAction(onExit || (() => window.close()), true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Beenden</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Bestand */}
      <div
        ref={openMenu === 'bestand' ? activeMenuRef : null}
        className="relative"
      >
        <button
          onClick={() => handleMenuClick('bestand')}
          onMouseEnter={() => handleMenuHover('bestand')}
          className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
            openMenu === 'bestand' ? 'bg-slate-200 text-slate-900 font-medium' : 'hover:bg-slate-200/70 text-slate-700'
          }`}
        >
          Bestand
        </button>

        {openMenu === 'bestand' && (
          <div className="absolute top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[240px] z-50">
            <button
              onClick={() => handleAction(onAddNode, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Neuen Bestand anlegen</span>
            </button>

            <button
              disabled={!canRenameNode}
              onClick={() => handleAction(onRenameNode, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Bestand umbenennen</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight ml-3">F2</span>
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              disabled={!canDeleteNode}
              onClick={() => handleAction(onDeleteNode, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Bestand löschen...</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Datensatz */}
      <div
        ref={openMenu === 'datensatz' ? activeMenuRef : null}
        className="relative"
      >
        <button
          onClick={() => handleMenuClick('datensatz')}
          onMouseEnter={() => handleMenuHover('datensatz')}
          className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
            openMenu === 'datensatz' ? 'bg-slate-200 text-slate-900 font-medium' : 'hover:bg-slate-200/70 text-slate-700'
          }`}
        >
          Datensatz
        </button>

        {openMenu === 'datensatz' && (
          <div className="absolute top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[240px] z-50">
            <button
              disabled={!hasActiveNode}
              onClick={() => handleAction(onNewRecord, false)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Neuen Datensatz anlegen</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight ml-3">Strg+N</span>
            </button>

            <button
              disabled={!canPrevRecord}
              onClick={() => handleAction(onPrevRecord, false)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Vorheriger Datensatz</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight ml-3">Strg+←</span>
            </button>

            <button
              disabled={!canNextRecord}
              onClick={() => handleAction(onNextRecord, false)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Nächster Datensatz</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight ml-3">Strg+→</span>
            </button>

            <button
              disabled={!hasActiveNode || totalRecords <= 0}
              onClick={() => handleAction(onOpenJumpToRecord, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Zu Datensatznummer springen...</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight ml-3">Strg+J</span>
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              disabled={!canDeleteRecord}
              onClick={() => handleAction(onDeleteRecord, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Aktuellen Datensatz löschen...</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight ml-3">Strg+Entf</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Suche */}
      <div
        ref={openMenu === 'suche' ? activeMenuRef : null}
        className="relative"
      >
        <button
          onClick={() => handleMenuClick('suche')}
          onMouseEnter={() => handleMenuHover('suche')}
          className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
            openMenu === 'suche' ? 'bg-slate-200 text-slate-900 font-medium' : 'hover:bg-slate-200/70 text-slate-700'
          }`}
        >
          Suche
        </button>

        {openMenu === 'suche' && (
          <div className="absolute top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[240px] z-50">
            <button
              onClick={() => handleAction(onToggleSearchMode)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Semantische Suche</span>
              {searchMode === 'hybrid' && <span className="font-semibold text-[#66A8CB]">✓</span>}
            </button>

            <button
              onClick={() => handleAction(onToggleLowestLevelOnly)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Nur unterste Ebene (Archivalien)</span>
              {lowestLevelOnly && <span className="font-semibold text-[#66A8CB]">✓</span>}
            </button>
          </div>
        )}
      </div>

      {/* 5. Ansicht */}
      <div
        ref={openMenu === 'ansicht' ? activeMenuRef : null}
        className="relative"
      >
        <button
          onClick={() => handleMenuClick('ansicht')}
          onMouseEnter={() => handleMenuHover('ansicht')}
          className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
            openMenu === 'ansicht' ? 'bg-slate-200 text-slate-900 font-medium' : 'hover:bg-slate-200/70 text-slate-700'
          }`}
        >
          Ansicht
        </button>

        {openMenu === 'ansicht' && (
          <div className="absolute top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[220px] z-50">
            <button
              onClick={() => handleAction(onToggleSidebar)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>{isSidebarOpen ? 'Bestandsbaum ausblenden' : 'Bestandsbaum einblenden'}</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight ml-3">Strg+B</span>
            </button>

            <button
              onClick={() => handleAction(onToggleSearch)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>{isRightSidebarOpen ? 'Suchleiste schließen' : 'Suchleiste öffnen'}</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight ml-3">Strg+F</span>
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              onClick={() => handleAction(handleFullscreenAction)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Vollbild umschalten</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight ml-3">F11</span>
            </button>
          </div>
        )}
      </div>

      {/* 6. Werkzeuge */}
      <div
        ref={openMenu === 'werkzeuge' ? activeMenuRef : null}
        className="relative"
      >
        <button
          onClick={() => handleMenuClick('werkzeuge')}
          onMouseEnter={() => handleMenuHover('werkzeuge')}
          className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
            openMenu === 'werkzeuge' ? 'bg-slate-200 text-slate-900 font-medium' : 'hover:bg-slate-200/70 text-slate-700'
          }`}
        >
          Werkzeuge
        </button>

        {openMenu === 'werkzeuge' && (
          <div className="absolute top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[240px] z-50">
            <button
              onClick={() => handleAction(onOpenFindbuch, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Findbuch generieren (PDF)...</span>
            </button>

            <button
              onClick={() => handleAction(onOpenImportExport, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Daten importieren / exportieren...</span>
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              onClick={() => handleAction(onToggleSpellcheck)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Rechtschreibprüfung</span>
              {spellcheckEnabled && <span className="font-semibold text-[#66A8CB]">✓</span>}
            </button>
          </div>
        )}
      </div>

      {/* 7. Hilfe */}
      <div
        ref={openMenu === 'hilfe' ? activeMenuRef : null}
        className="relative"
      >
        <button
          onClick={() => handleMenuClick('hilfe')}
          onMouseEnter={() => handleMenuHover('hilfe')}
          className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
            openMenu === 'hilfe' ? 'bg-slate-200 text-slate-900 font-medium' : 'hover:bg-slate-200/70 text-slate-700'
          }`}
        >
          Hilfe
        </button>

        {openMenu === 'hilfe' && (
          <div className="absolute top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[200px] z-50">
            <button
              onClick={() => handleAction(onOpenHelp, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Hilfe & Anleitung...</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight ml-3">F1</span>
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              onClick={() => handleAction(onOpenAbout, true)}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#66A8CB]/10 hover:text-[#66A8CB] flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Über Fontis...</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuBar;

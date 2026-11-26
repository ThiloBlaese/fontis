import React, { useState, useEffect, useRef } from 'react';
import { GripVertical, ChevronLeft, ChevronRight, Hash, FilePlus, Search } from 'lucide-react';

const STORAGE_POS_KEY = 'fontis_toolbar_pos';

const clampPosition = (x, y, width = 315, height = 46) => {
  const padding = 12;
  const maxX = Math.max(padding, window.innerWidth - width - padding);
  const maxY = Math.max(36, window.innerHeight - height - padding);
  return {
    x: Math.max(padding, Math.min(x, maxX)),
    y: Math.max(36, Math.min(y, maxY)) // Keep below the 28px MenuBar
  };
};

const getDefaultPosition = () => {
  const defaultX = Math.max(12, Math.round((window.innerWidth - 315) / 2));
  const defaultY = Math.max(44, window.innerHeight - 72);
  return { x: defaultX, y: defaultY };
};

const FloatingToolbar = ({
  hasActiveNode = false,
  currentRecordIndex = 0,
  totalRecords = 0,
  canPrevRecord = false,
  canNextRecord = false,
  isSearchOpen = false,
  onPrevRecord,
  onNextRecord,
  onOpenJumpToRecord,
  onNewRecord,
  onToggleSearch
}) => {
  const toolbarRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return clampPosition(parsed.x, parsed.y);
        }
      }
    } catch (_) {
      // Ignore storage errors
    }
    return getDefaultPosition();
  });

  // Re-clamp toolbar into viewport when window resizes
  useEffect(() => {
    const handleResize = () => {
      const rect = toolbarRef.current?.getBoundingClientRect();
      setPosition(prev => clampPosition(prev.x, prev.y, rect?.width || 315, rect?.height || 46));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const rect = toolbarRef.current?.getBoundingClientRect();
      const next = clampPosition(
        e.clientX - dragOffsetRef.current.x,
        e.clientY - dragOffsetRef.current.y,
        rect?.width || 315,
        rect?.height || 46
      );
      setPosition(next);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Persist position whenever dragging stops
  useEffect(() => {
    if (!isDragging) {
      try {
        localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(position));
      } catch (_) {
        // Ignore storage errors
      }
    }
  }, [isDragging, position]);

  const handleDragStart = (e) => {
    e.preventDefault();
    const rect = toolbarRef.current?.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - (rect ? rect.left : position.x),
      y: e.clientY - (rect ? rect.top : position.y)
    };
    setIsDragging(true);
  };

  const displayCurrent = hasActiveNode && totalRecords > 0 ? currentRecordIndex + 1 : 0;
  const displayTotal = hasActiveNode ? totalRecords : 0;

  return (
    <div
      ref={toolbarRef}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className={`fixed z-40 flex items-center gap-1 px-2 py-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg select-none transition-shadow ${
        isDragging ? 'shadow-2xl ring-2 ring-[#66A8CB]/30' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={handleDragStart}
        title="Schnelleiste verschieben"
        className="flex items-center justify-center w-6 h-8 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing rounded-lg hover:bg-slate-100/80 transition-colors"
      >
        <GripVertical size={16} />
      </div>

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* 1. Vorheriger Datensatz */}
      <button
        type="button"
        disabled={!canPrevRecord}
        onClick={onPrevRecord}
        title="Vorheriger Datensatz (Strg+←)"
        className="w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100 text-slate-600 hover:text-[#66A8CB] hover:bg-[#66A8CB]/10"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Datensatznummer-Anzeige */}
      <span
        className="px-1.5 text-xs font-semibold text-slate-700 tabular-nums min-w-[3.2rem] text-center"
        title="Aktueller Datensatz"
      >
        {hasActiveNode ? `${displayCurrent} / ${displayTotal}` : '– / –'}
      </span>

      {/* 2. Nächster Datensatz */}
      <button
        type="button"
        disabled={!canNextRecord}
        onClick={onNextRecord}
        title="Nächster Datensatz (Strg+→)"
        className="w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100 text-slate-600 hover:text-[#66A8CB] hover:bg-[#66A8CB]/10"
      >
        <ChevronRight size={16} />
      </button>

      {/* 3. Zu Datensatznummer springen */}
      <button
        type="button"
        disabled={!hasActiveNode || totalRecords <= 0}
        onClick={onOpenJumpToRecord}
        title="Zu Datensatznummer springen... (Strg+J)"
        className="w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100 text-slate-600 hover:text-[#66A8CB] hover:bg-[#66A8CB]/10"
      >
        <Hash size={16} />
      </button>

      {/* 4. Neuen Datensatz anlegen */}
      <button
        type="button"
        disabled={!hasActiveNode}
        onClick={onNewRecord}
        title="Neuen Datensatz anlegen (Strg+N)"
        className="w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100 text-slate-600 hover:text-[#66A8CB] hover:bg-[#66A8CB]/10"
      >
        <FilePlus size={16} />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* 5. Suchleiste öffnen / schließen */}
      <button
        type="button"
        onClick={onToggleSearch}
        title={isSearchOpen ? 'Suchleiste schließen (Strg+F)' : 'Suchleiste öffnen (Strg+F)'}
        className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95 ${
          isSearchOpen
            ? 'bg-[#66A8CB]/15 text-[#66A8CB] border border-[#66A8CB]/40'
            : 'text-slate-600 hover:text-[#66A8CB] hover:bg-[#66A8CB]/10'
        }`}
      >
        <Search size={16} />
      </button>
    </div>
  );
};

export default FloatingToolbar;

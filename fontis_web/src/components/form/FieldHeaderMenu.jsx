import React, { useState, useEffect, useRef } from 'react';
import {
    Copy,
    Trash2,
    List,
    Clock,
    AlertTriangle,
    Search,
    Hash,
    MoreVertical,
    Plus,
    CloudUpload
} from 'lucide-react';

const FieldHeaderMenu = ({
    field,
    isAdmin,
    isDeleteMode,
    isMenuOpen,
    setIsMenuOpen,
    onDeselect,
    isSearchPreview,
    isRuntimeField,
    isBlockingField,
    isVisuallyBlocking,
    isSignatureField,
    isMediaField,
    isMediaDisabled,
    canCopyPrevious,
    onCopyPrevious,
    onTriggerFileUpload,
    onRemoveAsset,
    onUpdate,
    onDuplicate,
    onDelete
}) => {
    const [menuPlacement, setMenuPlacement] = useState('bottom');
    const menuRef = useRef(null);

    // Close menu on outside click and determine vertical placement
    useEffect(() => {
        if (!isMenuOpen) return;

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
                if (onDeselect) onDeselect();
            }
        };

        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setMenuPlacement(spaceBelow < 280 ? 'top' : 'bottom');
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen, onDeselect, setIsMenuOpen]);

    const hasFeatureIcons = isSearchPreview || isRuntimeField || isBlockingField || isSignatureField;

    return (
        <div className="flex items-center gap-0.5 flex-shrink-0 relative" ref={menuRef}>
            {/* Feature Indicator Icons */}
            {hasFeatureIcons && (
                <div className="flex items-center gap-1 mr-1 pr-1 border-r border-slate-200">
                    {isSearchPreview && (
                        <div className="relative flex items-center justify-center p-1 hover:[&>div]:opacity-100">
                            <Search size={16} className="text-slate-400" />
                            <div className="absolute bottom-full right-0 mb-1 px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none transition-opacity duration-200 whitespace-nowrap shadow-lg z-50">
                                Vorschau-Feld in der Suchliste
                            </div>
                        </div>
                    )}
                    {isRuntimeField && (
                        <div className="relative flex items-center justify-center p-1 hover:[&>div]:opacity-100">
                            <Clock size={16} className="text-[#66A8CB]" />
                            <div className="absolute bottom-full right-0 mb-1 px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none transition-opacity duration-200 whitespace-nowrap shadow-lg z-50">
                                wird in der Suche berücksichtigt
                            </div>
                        </div>
                    )}
                    {isBlockingField && (
                        <div className="relative flex items-center justify-center p-1 hover:[&>div]:opacity-100">
                            <AlertTriangle size={16} className={isVisuallyBlocking ? 'text-[#CC823F]' : 'text-slate-300'} />
                            <div className="absolute bottom-full right-0 mb-1 px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none transition-opacity duration-200 whitespace-nowrap shadow-lg z-50">
                                {isVisuallyBlocking ? 'Sperrfrist aktiv' : 'Sperrfrist abgelaufen'}
                            </div>
                        </div>
                    )}
                    {isSignatureField && (
                        <div className="relative flex items-center justify-center p-1 hover:[&>div]:opacity-100">
                            <Hash size={16} className="text-[#8BB158]" />
                            <div className="absolute bottom-full right-0 mb-1 px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none transition-opacity duration-200 whitespace-nowrap shadow-lg z-50">
                                wird automatisch hochgezählt
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Dropdown Menu Trigger */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                }}
                tabIndex={-1}
                className={`p-1 rounded transition-colors hover:bg-black/5 ${isMenuOpen ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                title="Feld-Optionen"
                disabled={isDeleteMode}
            >
                <MoreVertical size={16} />
            </button>

            {/* Dropdown Menu Content */}
            {isMenuOpen && (
                <div
                    className={`absolute right-0 ${menuPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white border border-slate-200 shadow-xl rounded-lg z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150`}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCopyPrevious(field.id);
                            setIsMenuOpen(false);
                        }}
                        disabled={!canCopyPrevious}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                        <Copy size={14} />
                        Wert übernehmen
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onTriggerFileUpload();
                        }}
                        disabled={isMediaDisabled}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:text-slate-500"
                    >
                        <CloudUpload size={14} />
                        {isMediaField ? 'Digitalisate hinzufügen' : 'Digitalisat importieren'}
                    </button>

                    {isMediaField && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMenuOpen(false);
                                onRemoveAsset(e);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-2 transition-colors"
                        >
                            <Trash2 size={14} />
                            Digitalisat entfernen
                        </button>
                    )}

                    {isAdmin && !isMediaField && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdate(field.id, 'isSelectionList', !field.isSelectionList);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${field.isSelectionList ? 'text-blue-600 bg-blue-100 hover:bg-blue-200' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'}`}
                        >
                            <List size={14} />
                            Auswahlliste {field.isSelectionList ? 'deaktivieren' : 'aktivieren'}
                        </button>
                    )}

                    {isAdmin && (
                        <>
                            <div className="border-t border-slate-100 my-1"></div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(false);
                                    onDuplicate(field.id);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors"
                            >
                                <Plus size={14} />
                                Neues Feld erstellen
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(false);
                                    onDelete(field.id);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                            >
                                <Trash2 size={14} />
                                Feld löschen
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default FieldHeaderMenu;

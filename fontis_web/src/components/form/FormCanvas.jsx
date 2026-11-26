import React from 'react';
import { Database, Plus } from 'lucide-react';
import DraggableField from './DraggableField';

const FormCanvas = ({
    containerRef,
    activeNode,
    activeNodeId,
    layoutFields,
    records,
    currentRecordIndex,
    selectedId,
    newlyCreatedFieldId,
    onBackgroundMouseDown,
    onBackgroundTouchStart,
    onBackgroundContextMenu,
    onDoubleClick,
    onFieldMouseDown,
    onFieldDragStart,
    onFieldResizeStart,
    onFieldUpdate,
    onFieldDelete,
    onFieldDuplicate,
    onFieldCopyPrevious,
    onFieldBlur,
    isDeleteMode,
    isAdmin,
    gridSize = 24,
    showGrid = false,
    searchQueries = [],
    isSearchOpen = false,
    spellCheckEnabled = true
}) => {
    const [openMenuFieldId, setOpenMenuFieldId] = React.useState(null);

    // Get the effective node ID, favoring the explicit prop or current activeNode object
    const effectiveNodeId = activeNodeId || activeNode?.id;

    // Calculate unique values for each field across all records to use as suggestions
    const fieldSuggestions = React.useMemo(() => {
        const suggestions = {};
        if (!records || records.length === 0) return suggestions;

        layoutFields.forEach(field => {
            const values = new Set();
            records.forEach(record => {
                const val = record[field.id];
                if (val && typeof val === 'string' && val.trim() !== '') {
                    values.add(val.trim());
                }
            });
            suggestions[field.id] = Array.from(values).sort();
        });
        return suggestions;
    }, [records, layoutFields]);

    const sortedFields = React.useMemo(() => {
        if (!layoutFields || layoutFields.length === 0) return [];
        return [...layoutFields].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    }, [layoutFields]);

    const searchPreviewFieldId = React.useMemo(() => {
        if (!layoutFields || layoutFields.length === 0) return null;
        // Prioritize explicit title/subject special fields
        const titleField = layoutFields.find(f => {
            const label = (f.label || '').trim().toUpperCase();
            return label.includes('TITEL') || label.includes('BETREFF') || label.includes('BEZEICHNUNG');
        });
        if (titleField) return titleField.id;
        // Fallback to top-left field
        return sortedFields[0]?.id || null;
    }, [layoutFields, sortedFields]);

    const canvasDimensions = React.useMemo(() => {
        if (!layoutFields || layoutFields.length === 0) {
            return { width: '100%', height: '100%' };
        }
        
        let maxX = 0;
        let maxY = 0;
        
        layoutFields.forEach(field => {
            const fieldWidth = field.width || 288;
            const fieldHeight = field.height || 128;
            
            const rightBound = field.x + fieldWidth;
            const bottomBound = field.y + fieldHeight;
            
            if (rightBound > maxX) maxX = rightBound;
            if (bottomBound > maxY) maxY = bottomBound;
        });
        
        const padding = 64;
        
        return {
            width: `max(100%, ${maxX + padding}px)`,
            height: `max(100%, ${maxY + padding}px)`
        };
    }, [layoutFields]);

    return (
        <div
            ref={containerRef}
            onDoubleClick={onDoubleClick}
            onMouseDown={(e) => {
                setOpenMenuFieldId(null);
                onBackgroundMouseDown(e);
            }}
            onTouchStart={(e) => {
                setOpenMenuFieldId(null);
                onBackgroundTouchStart(e);
            }}
            onContextMenu={onBackgroundContextMenu}
            className="flex-1 h-full w-full relative overflow-auto bg-transparent cursor-default"
        >
            {!activeNode ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                    <Database size={48} className="text-slate-400 mb-4" />
                    <p className="text-base font-medium text-slate-500">Kein Bestand ausgewählt</p>
                    <p className="text-base text-slate-400">Wählen Sie links einen Bestand aus.</p>
                </div>
            ) : layoutFields.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                    {isAdmin ? (
                        <>
                            <Plus size={48} className="text-slate-400 mb-4" />
                            <p className="text-base font-medium text-slate-500">Leeres Formular: "{activeNode.label}"</p>
                            <p className="text-base text-slate-400">Doppelklicken zum Hinzufügen von Feldern</p>
                        </>
                    ) : (
                        <>
                            <Database size={48} className="text-slate-400 mb-4" />
                            <p className="text-base font-medium text-slate-500">Formular "{activeNode.label}" ist noch leer</p>
                            <p className="text-base text-slate-400">Bitte kontaktieren Sie den Administrator (Archivleiter), um Felder anzulegen.</p>
                        </>
                    )}
                </div>
            ) : null}

            <div 
                style={{ 
                    position: 'relative',
                    width: canvasDimensions.width, 
                    height: canvasDimensions.height, 
                    pointerEvents: 'none',
                    backgroundImage: showGrid 
                        ? `linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)`
                        : 'none',
                    backgroundSize: `${gridSize}px ${gridSize}px`
                }}
            >
                {activeNode && sortedFields.map((field) => {
                    return (
                        <div key={field.id} style={{ pointerEvents: 'auto' }}>
                            <DraggableField
                                field={field}
                                currentValue={records[currentRecordIndex]?.[field.id] || ''}
                                isSelected={selectedId === field.id}
                                isAdmin={isAdmin}
                                onMouseDown={onFieldMouseDown}
                                onDragStart={onFieldDragStart}
                                onResizeStart={onFieldResizeStart}
                                onUpdate={onFieldUpdate}
                                onDelete={onFieldDelete}
                                onDuplicate={onFieldDuplicate}
                                onCopyPrevious={onFieldCopyPrevious}
                                canCopyPrevious={currentRecordIndex > 0}
                                onBlur={onFieldBlur}
                                isMenuOpen={openMenuFieldId === field.id}
                                setIsMenuOpen={(isOpen) => setOpenMenuFieldId(isOpen ? field.id : null)}
                                isDeleteMode={isDeleteMode}
                                isNew={newlyCreatedFieldId.current === field.id}
                                inputRef={(el) => {
                                    if (el && newlyCreatedFieldId.current === field.id) {
                                        el.focus();
                                        newlyCreatedFieldId.current = null;
                                    }
                                }}
                                suggestions={fieldSuggestions[field.id]}
                                isSearchPreview={field.id === searchPreviewFieldId}
                                searchQueries={searchQueries}
                                isSearchOpen={isSearchOpen}
                                recordId={records[currentRecordIndex]?.id}
                                nodeId={effectiveNodeId}
                                spellCheckEnabled={spellCheckEnabled}
                            />
                        </div>
                    );
                })}
            </div>
        </div >
    );
};

export default FormCanvas;

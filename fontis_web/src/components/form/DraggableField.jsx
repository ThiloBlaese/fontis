import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Move, Loader2 } from 'lucide-react';
import headerBg from '../../assets/titelleisten_hintergrund_einfach.png';
import { identifyBlockingPeriod } from '../../utils/validators';
import FieldHeaderMenu from './FieldHeaderMenu';
import MediaFieldViewer from './MediaFieldViewer';
import SpellcheckTextarea from './SpellcheckTextarea';

const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.tiff', '.tif', // Bilder
    '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.odt', '.rtf',  // Dokumente
    '.mp4', '.webm', '.mov', '.ogv', '.m4v',                           // Video
    '.mp3', '.wav', '.m4a', '.ogg'                                     // Audio
];

const FIELD_COLORS = {
    activeBorder: 'border-slate-400',
    activeRing: 'ring-slate-400',
    activeHeaderBg: 'bg-slate-100',
    activeHeaderBorder: 'border-slate-200',
    activeResizer: 'bg-slate-400',
    inactiveBorder: 'border-slate-300',
    inactiveHeaderBg: 'bg-slate-50',
    inactiveHeaderBorder: 'border-slate-200',
    hover: 'hover:border-slate-400'
};

const DraggableField = ({
    field,
    currentValue,
    isSelected,
    onMouseDown,
    onDragStart,
    onResizeStart,
    onUpdate,
    onDelete,
    onDuplicate,
    onCopyPrevious,
    canCopyPrevious,
    onBlur,
    inputRef,
    isDeleteMode,
    isMenuOpen = false,
    setIsMenuOpen,
    isNew = false,
    suggestions = [],
    isSearchPreview = false,
    isAdmin = false,
    searchQueries = [],
    isSearchOpen = false,
    recordId = null,
    nodeId = null,
    spellCheckEnabled = true
}) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isInitialMount, setIsInitialMount] = useState(isNew);
    const [isEditing, setIsEditing] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null); // 'uploading' | null
    const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
    const [isTouchDraggingActive, setIsTouchDraggingActive] = useState(false);

    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const touchTimeoutRef = useRef(null);
    const touchStartPosRef = useRef(null);

    // Long-press touch dragging for touch screens / tablets
    const handleHeaderTouchStart = (e) => {
        if (!isAdmin || isDeleteMode || e.touches.length !== 1) return;

        const touch = e.touches[0];
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

        touchTimeoutRef.current = setTimeout(() => {
            setShowSuggestions(false);
            setIsEditing(false);
            textareaRef.current?.blur();
            setIsTouchDraggingActive(true);
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            onDragStart(e, field.id);
        }, 450);
    };

    const handleHeaderTouchMove = (e) => {
        if (!touchTimeoutRef.current || !touchStartPosRef.current) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartPosRef.current.x;
        const dy = touch.clientY - touchStartPosRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
            clearTimeout(touchTimeoutRef.current);
            touchTimeoutRef.current = null;
        }
    };

    const handleHeaderTouchEnd = () => {
        if (touchTimeoutRef.current) {
            clearTimeout(touchTimeoutRef.current);
            touchTimeoutRef.current = null;
        }
        setIsTouchDraggingActive(false);
    };

    // Feature detection based on field label
    const labelUpper = (field.label || '').toUpperCase();
    const isRuntimeField = labelUpper.includes('LAUFZEIT');
    const isBlockingField = labelUpper.includes('SPERRFRIST') || labelUpper.includes('SCHUTZFRIST');
    const isSignatureField = labelUpper.includes('SIGNATUR');
    const isVisuallyBlocking = identifyBlockingPeriod(currentValue);

    // Multi-asset parsing ("asset:id|mime|name|thumb;;...")
    const isMediaField =
        typeof currentValue === 'string' &&
        (currentValue.startsWith('asset:') || currentValue.includes('|'));
    const rawAssetString = isMediaField
        ? currentValue.startsWith('asset:')
            ? currentValue.substring(6)
            : currentValue
        : '';
    const assets = rawAssetString.split(';;').filter(a => a.trim().includes('|'));

    useEffect(() => {
        if (currentAssetIndex >= assets.length && assets.length > 0) {
            setCurrentAssetIndex(assets.length - 1);
        }
    }, [assets.length, currentAssetIndex]);

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Auto-save if record ID is missing (e.g. newly added unsaved record)
        let effectiveRecordId = recordId;
        if (!effectiveRecordId && nodeId) {
            try {
                const savedRecords = await onBlur(field.id, currentValue, 'value');
                if (savedRecords && Array.isArray(savedRecords)) {
                    const lastRecord = savedRecords[savedRecords.length - 1];
                    if (lastRecord && lastRecord.id) {
                        effectiveRecordId = lastRecord.id;
                    }
                }
            } catch (err) {
                console.error('Auto-save failed', err);
            }
        }

        if (!effectiveRecordId || !nodeId) {
            console.error('Missing ID context for upload:', { recordId: effectiveRecordId, nodeId });
            alert(
                'Digitalisat kann nicht importiert werden: Der Datensatz wurde noch nicht gespeichert.\n\nBitte ändern Sie kurz ein beliebiges Textfeld, um die Speicherung auszulösen, und versuchen Sie es dann erneut.'
            );
            return;
        }

        const invalidFiles = files.filter(file => {
            const match = file.name.match(/\.[^.]+$/);
            const ext = match ? match[0].toLowerCase() : '';
            return !ALLOWED_EXTENSIONS.includes(ext);
        });

        if (invalidFiles.length > 0) {
            alert(
                `Ungültige Dateitypen: ${invalidFiles.map(f => f.name).join(', ')}.\n\nErlaubt sind: ${ALLOWED_EXTENSIONS.join(', ')}`
            );
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setUploadStatus('uploading');
        setIsMenuOpen(false);

        try {
            const uploadedAssetStrings = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                if (nodeId) {
                    formData.append('folder_id', nodeId);
                }

                const uploadRes = await fetch('/api/cloud/files', {
                    method: 'POST',
                    body: formData
                });

                if (!uploadRes.ok) {
                    let detail = '';
                    try {
                        const errJson = await uploadRes.json();
                        if (errJson && errJson.detail) {
                            detail = `: ${errJson.detail}`;
                        }
                    } catch {
                        // Ignore JSON parse errors on error response
                    }
                    throw new Error(`Import von ${file.name} fehlgeschlagen${detail}`);
                }

                const savedFile = await uploadRes.json();
                uploadedAssetStrings.push(
                    `${savedFile.id}|${savedFile.mime_type}|${file.name}|${savedFile.thumbnail_id || ''}`
                );
            }

            const newAssetString = isMediaField
                ? `asset:${assets.join(';;')};;${uploadedAssetStrings.join(';;')}`
                : `asset:${uploadedAssetStrings.join(';;')}`;

            onUpdate(field.id, 'value', newAssetString);
            onBlur(field.id, newAssetString, 'value');
            setCurrentAssetIndex(assets.length + uploadedAssetStrings.length - 1);
        } catch (err) {
            alert(err.message);
        } finally {
            setUploadStatus(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveAsset = (e) => {
        e.stopPropagation();
        const newAssets = assets.filter((_, i) => i !== currentAssetIndex);
        const newValue = newAssets.length > 0 ? `asset:${newAssets.join(';;')}` : '';

        onUpdate(field.id, 'value', newValue);
        onBlur(field.id, newValue, 'value');

        if (currentAssetIndex > 0) {
            setCurrentAssetIndex(currentAssetIndex - 1);
        }
    };

    const handleMenuDeselect = useCallback(() => {
        if (onMouseDown) onMouseDown(null);
    }, [onMouseDown]);

    // Search match highlight at field level
    const isMatch = useMemo(() => {
        if (!isSearchOpen || !searchQueries || searchQueries.length === 0) return false;
        const activeQueries = searchQueries
            .map(q => (q || '').trim().toLowerCase())
            .filter(q => q.length > 0);
        if (activeQueries.length === 0) return false;

        const val = (currentValue || '').toLowerCase();
        return activeQueries.some(query => val.includes(query));
    }, [currentValue, searchQueries, isSearchOpen]);

    const isMediaDisabled =
        typeof currentValue === 'string' && currentValue.trim().length > 0 && !isMediaField;

    const zIndexClass =
        isDeleteMode || isTouchDraggingActive
            ? 'z-50'
            : isMenuOpen || showSuggestions || isEditing
                ? 'z-30'
                : isSelected
                    ? 'z-20'
                    : isMatch
                        ? 'z-10'
                        : 'z-0';

    return (
        <div
            className={`absolute rounded-none shadow-md border flex flex-col bg-white transition-[box-shadow,border-color,transform] duration-200 group
                ${zIndexClass}
                ${isDeleteMode ? 'hover:ring-2 hover:ring-red-500 hover:border-red-500' : FIELD_COLORS.hover}
                ${isSelected && !isDeleteMode
                    ? `${FIELD_COLORS.activeBorder} shadow-lg ring-1 ${FIELD_COLORS.activeRing}`
                    : isMatch
                        ? 'shadow-xl border-slate-300'
                        : isDeleteMode
                            ? 'border-slate-200'
                            : FIELD_COLORS.inactiveBorder}
                ${isInitialMount ? 'animate-field-pop-in' : ''}
                ${isTouchDraggingActive ? 'ring-2 ring-blue-500 scale-[1.02] shadow-2xl' : ''}
            `}
            style={{
                left: field.x,
                top: field.y,
                width: field.width || 288,
                height: field.height || 128,
                pointerEvents: 'auto'
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                onMouseDown && onMouseDown(field.id);
            }}
            onTouchStart={(e) => {
                e.stopPropagation();
                onMouseDown && onMouseDown(field.id);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            onAnimationEnd={() => {
                setIsInitialMount(false);
                if (isNew) onBlur(field.id, null, 'new-field-done');
            }}
        >
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={handleFileUpload}
            />

            {/* Delete Mode Overlay */}
            {isDeleteMode && (
                <div
                    className="absolute inset-0 z-50 cursor-pointer bg-red-50/10 rounded-none"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        onMouseDown(field.id);
                    }}
                />
            )}

            {/* Header Bar */}
            <div
                className={`h-9 border-b rounded-none flex items-center px-2 select-none transition-colors gap-2
                    ${isSelected && !isDeleteMode
                        ? `${FIELD_COLORS.activeHeaderBg} ${FIELD_COLORS.activeHeaderBorder}`
                        : `${FIELD_COLORS.inactiveHeaderBg} ${FIELD_COLORS.inactiveHeaderBorder}`}
                `}
                style={{
                    backgroundImage: `url(${headerBg})`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: 'auto'
                }}
                onTouchStart={handleHeaderTouchStart}
                onTouchMove={handleHeaderTouchMove}
                onTouchEnd={handleHeaderTouchEnd}
                onTouchCancel={handleHeaderTouchEnd}
            >
                {isAdmin && (
                    <>
                        <div
                            className="p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 hover:bg-black/5 rounded flex-shrink-0"
                            onMouseDown={(e) => {
                                if (isDeleteMode) return;
                                e.preventDefault();
                                e.stopPropagation();
                                setShowSuggestions(false);
                                setIsEditing(false);
                                textareaRef.current?.blur();
                                onMouseDown && onMouseDown(field.id);
                                onDragStart(e, field.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            title="Verschieben"
                        >
                            <Move size={14} />
                        </div>
                        <div className="w-px h-3 bg-slate-400/30 mx-0.5"></div>
                    </>
                )}

                {isAdmin ? (
                    <input
                        type="text"
                        ref={inputRef}
                        disabled={isDeleteMode}
                        tabIndex={-1}
                        value={field.label}
                        onChange={(e) => onUpdate(field.id, 'label', e.target.value)}
                        onBlur={() => onBlur(field.id, field.label, 'label')}
                        className="bg-transparent border-none outline-none text-sm font-semibold text-slate-700 flex-1 min-w-0 focus:ring-0 px-1 tracking-wide truncate disabled:cursor-pointer"
                        placeholder=""
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="bg-transparent border-none outline-none text-sm font-semibold text-slate-700 flex-1 min-w-0 px-1 tracking-wide truncate">
                        {field.label}
                    </span>
                )}

                <FieldHeaderMenu
                    field={field}
                    isAdmin={isAdmin}
                    isDeleteMode={isDeleteMode}
                    isMenuOpen={isMenuOpen}
                    setIsMenuOpen={setIsMenuOpen}
                    onDeselect={handleMenuDeselect}
                    isSearchPreview={isSearchPreview}
                    isRuntimeField={isRuntimeField}
                    isBlockingField={isBlockingField}
                    isVisuallyBlocking={isVisuallyBlocking}
                    isSignatureField={isSignatureField}
                    isMediaField={isMediaField}
                    isMediaDisabled={isMediaDisabled}
                    canCopyPrevious={canCopyPrevious}
                    onCopyPrevious={onCopyPrevious}
                    onTriggerFileUpload={() => fileInputRef.current?.click()}
                    onRemoveAsset={handleRemoveAsset}
                    onUpdate={onUpdate}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                />
            </div>

            {/* Content Area */}
            <div
                className={`flex-1 p-2 min-h-0 relative bg-white rounded-none shadow-inner transition-colors border-t border-transparent focus-within:border-slate-100 ${isMediaField ? '' : 'cursor-text'}`}
                onClick={() => {
                    if (!isEditing && !isMediaField) {
                        setIsEditing(true);
                        setTimeout(() => textareaRef.current?.focus(), 0);
                    }
                }}
            >
                {uploadStatus === 'uploading' && (
                    <div className="absolute top-2 right-2 z-30">
                        <div className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md border border-blue-100 flex items-center gap-2 shadow-sm">
                            <Loader2 size={14} className="text-blue-600 animate-spin" />
                            <span className="text-[11px] font-semibold text-blue-700 uppercase">Import...</span>
                        </div>
                    </div>
                )}

                {isMediaField ? (
                    <MediaFieldViewer
                        assets={assets}
                        currentAssetIndex={currentAssetIndex}
                        setCurrentAssetIndex={setCurrentAssetIndex}
                    />
                ) : (
                    <SpellcheckTextarea
                        field={field}
                        currentValue={currentValue}
                        isDeleteMode={isDeleteMode}
                        isEditing={isEditing}
                        setIsEditing={setIsEditing}
                        showSuggestions={showSuggestions}
                        setShowSuggestions={setShowSuggestions}
                        suggestions={suggestions}
                        isSearchOpen={isSearchOpen}
                        isMatch={isMatch}
                        searchQueries={searchQueries}
                        spellCheckEnabled={spellCheckEnabled}
                        isUploading={uploadStatus === 'uploading'}
                        textareaRef={textareaRef}
                        onUpdate={onUpdate}
                        onBlur={onBlur}
                    />
                )}
            </div>

            {/* Resize Handle */}
            {!isDeleteMode && isAdmin && (
                <div
                    className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1.5 z-20 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowSuggestions(false);
                        setIsEditing(false);
                        textareaRef.current?.blur();
                        onResizeStart(e, field.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => {
                        e.stopPropagation();
                        setShowSuggestions(false);
                        setIsEditing(false);
                        onResizeStart(e, field.id);
                    }}
                >
                    <div
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${isSelected ? FIELD_COLORS.activeResizer : 'bg-slate-300'}`}
                    ></div>
                </div>
            )}
        </div>
    );
};

export default DraggableField;

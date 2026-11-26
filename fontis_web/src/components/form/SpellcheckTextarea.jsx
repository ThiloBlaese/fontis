import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { spellChecker } from '../../utils/spellChecker';

const calculatePopupPosition = (targetRect, clientX, clientY) => {
    const POPUP_WIDTH = 260;
    const ESTIMATED_HEIGHT = 260;
    const PADDING = 12;

    let x = targetRect ? targetRect.left : (clientX || 100);
    x = Math.max(PADDING, Math.min(window.innerWidth - POPUP_WIDTH - PADDING, x));

    let y;
    if (targetRect) {
        const spaceBelow = window.innerHeight - targetRect.bottom;
        const spaceAbove = targetRect.top;
        if (spaceBelow >= ESTIMATED_HEIGHT || spaceBelow >= spaceAbove) {
            y = targetRect.bottom + 6;
        } else {
            y = Math.max(PADDING, targetRect.top - ESTIMATED_HEIGHT - 6);
        }
    } else {
        const clickY = clientY || 100;
        const spaceBelow = window.innerHeight - clickY;
        if (spaceBelow >= ESTIMATED_HEIGHT) {
            y = clickY + 8;
        } else {
            y = Math.max(PADDING, clickY - ESTIMATED_HEIGHT - 8);
        }
    }

    y = Math.max(PADDING, Math.min(window.innerHeight - ESTIMATED_HEIGHT - PADDING, y));
    return { x, y };
};

const renderSearchMatchesOnly = (text, activeQueries) => {
    if (!text) return null;
    if (!activeQueries || activeQueries.length === 0) return text;
    const escaped = activeQueries.map(q => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => {
        const isMatch = activeQueries.some(q => q.toLowerCase() === (part || '').toLowerCase());
        return isMatch ? (
            <mark key={i} className="bg-amber-100 text-slate-900 font-semibold px-0.5 rounded not-italic">
                {part}
            </mark>
        ) : (
            part
        );
    });
};

const SpellcheckTextarea = ({
    field,
    currentValue,
    isDeleteMode,
    isEditing,
    setIsEditing,
    showSuggestions,
    setShowSuggestions,
    suggestions = [],
    isSearchOpen = false,
    isMatch = false,
    searchQueries = [],
    spellCheckEnabled = true,
    isUploading = false,
    textareaRef,
    onUpdate,
    onBlur
}) => {
    const backdropRef = useRef(null);
    const [spellPopup, setSpellPopup] = useState(null);
    const [spellVersion, setSpellVersion] = useState(0);

    useEffect(() => {
        return spellChecker.subscribe(() => setSpellVersion(v => v + 1));
    }, []);

    useEffect(() => {
        if (!spellPopup) return;
        const handleOutside = () => setSpellPopup(null);
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [spellPopup]);

    const spellingErrors = useMemo(() => {
        if (!spellCheckEnabled) return [];
        return spellChecker.findErrors(currentValue);
    }, [currentValue, spellCheckEnabled, spellVersion]);

    const openSpellPopup = (err, targetRect, clientX, clientY) => {
        const wordSuggestions = spellChecker.getSuggestions(err.word);
        const pos = calculatePopupPosition(targetRect, clientX, clientY);
        setSpellPopup({
            word: err.word,
            suggestions: wordSuggestions,
            start: err.start,
            end: err.end,
            x: pos.x,
            y: pos.y
        });
    };

    const renderFormattedText = (text, queries) => {
        if (!text) return null;
        const activeQueries = Array.isArray(queries)
            ? queries.map(q => (q || '').trim()).filter(q => q.length > 0)
            : [];

        if (spellingErrors.length === 0 || !spellCheckEnabled) {
            return renderSearchMatchesOnly(text, activeQueries);
        }

        const elements = [];
        let lastIndex = 0;

        spellingErrors.forEach((err, idx) => {
            if (err.start > lastIndex) {
                elements.push(
                    <React.Fragment key={`text-${lastIndex}`}>
                        {renderSearchMatchesOnly(text.substring(lastIndex, err.start), activeQueries)}
                    </React.Fragment>
                );
            }
            elements.push(
                <span
                    key={`err-${idx}-${err.start}`}
                    className="underline decoration-wavy decoration-[#CC823F] decoration-2 underline-offset-2 hover:bg-orange-50 cursor-pointer rounded-xs transition-colors"
                    title={`Möglicher Tippfehler: "${err.word}" (Klicken für Vorschläge)`}
                    onClick={(e) => {
                        e.stopPropagation();
                        openSpellPopup(err, e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
                    }}
                >
                    {renderSearchMatchesOnly(err.word, activeQueries)}
                </span>
            );
            lastIndex = err.end;
        });

        if (lastIndex < text.length) {
            elements.push(
                <React.Fragment key={`text-${lastIndex}`}>
                    {renderSearchMatchesOnly(text.substring(lastIndex), activeQueries)}
                </React.Fragment>
            );
        }

        return elements;
    };

    const renderSpellBackdrop = (text) => {
        if (!text || spellingErrors.length === 0) {
            return <span className="text-transparent">{text || ''}</span>;
        }

        const elements = [];
        let lastIndex = 0;

        spellingErrors.forEach((err, idx) => {
            if (err.start > lastIndex) {
                elements.push(
                    <span key={`b-text-${lastIndex}`} className="text-transparent">
                        {text.substring(lastIndex, err.start)}
                    </span>
                );
            }
            elements.push(
                <span
                    key={`b-err-${idx}-${err.start}`}
                    className="text-transparent underline decoration-wavy decoration-[#CC823F] decoration-2 underline-offset-2"
                >
                    {err.word}
                </span>
            );
            lastIndex = err.end;
        });

        if (lastIndex < text.length) {
            elements.push(
                <span key={`b-text-${lastIndex}`} className="text-transparent">
                    {text.substring(lastIndex)}
                </span>
            );
        }

        if (text.endsWith('\n')) {
            elements.push(<br key="b-trailing-br" />);
        }

        return elements;
    };

    const handleTextareaClick = (e) => {
        if (!spellCheckEnabled || spellingErrors.length === 0) return;
        const cursor = e.target.selectionStart;
        const errorUnderCursor = spellingErrors.find(err => cursor >= err.start && cursor <= err.end);
        if (errorUnderCursor) {
            openSpellPopup(errorUnderCursor, null, e.clientX, e.clientY);
        } else if (spellPopup) {
            setSpellPopup(null);
        }
    };

    const handleTextareaContextMenu = (e) => {
        if (!spellCheckEnabled || spellingErrors.length === 0) return;
        const cursor = e.target.selectionStart;
        const errorUnderCursor = spellingErrors.find(err => cursor >= err.start && cursor <= err.end);
        if (errorUnderCursor) {
            e.preventDefault();
            e.stopPropagation();
            openSpellPopup(errorUnderCursor, null, e.clientX, e.clientY);
        }
    };

    const showFormattedReadView =
        !isEditing && ((isSearchOpen && isMatch) || (spellCheckEnabled && spellingErrors.length > 0));

    return (
        <>
            {showFormattedReadView ? (
                <div
                    className="w-full h-full text-sm font-sans text-slate-800 whitespace-pre-wrap break-words overflow-y-auto cursor-text"
                    style={{ lineHeight: '1.25rem' }}
                    onClick={() => {
                        setIsEditing(true);
                        setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                >
                    {renderFormattedText(currentValue, searchQueries)}
                </div>
            ) : (
                <div className="relative w-full h-full overflow-hidden">
                    {spellCheckEnabled && (
                        <div
                            ref={backdropRef}
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full p-0 m-0 pointer-events-none select-none text-sm font-sans whitespace-pre-wrap break-words overflow-y-auto z-0"
                            style={{ lineHeight: '1.25rem' }}
                        >
                            {renderSpellBackdrop(currentValue)}
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        className="relative z-10 w-full h-full resize-none border-0 outline-none p-0 m-0 text-sm font-sans text-slate-800 placeholder:text-slate-300 bg-transparent disabled:bg-transparent disabled:cursor-pointer"
                        style={{ lineHeight: '1.25rem' }}
                        placeholder="..."
                        disabled={isDeleteMode}
                        spellCheck={false}
                        value={currentValue}
                        onClick={handleTextareaClick}
                        onContextMenu={handleTextareaContextMenu}
                        onScroll={(e) => {
                            if (backdropRef.current) {
                                backdropRef.current.scrollTop = e.target.scrollTop;
                            }
                        }}
                        onChange={(e) => onUpdate(field.id, 'value', e.target.value)}
                        onFocus={() => {
                            setIsEditing(true);
                            if (field.isSelectionList) {
                                setShowSuggestions(true);
                            }
                        }}
                        onBlur={() => {
                            if (isUploading) return;
                            setIsEditing(false);
                            onBlur(field.id, currentValue, 'value');
                            // Delay hiding suggestions to allow click
                            setTimeout(() => setShowSuggestions(false), 200);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Spellcheck Suggestions Popover */}
            {spellPopup && (
                <div
                    className="fixed z-[9999] bg-white border border-slate-200 shadow-xl rounded-xl p-2.5 min-w-[220px] max-w-[280px] max-h-[min(380px,85vh)] overflow-y-auto text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: spellPopup.y, left: spellPopup.x }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-1">
                        <div className="flex items-center gap-1.5 truncate">
                            <span className="w-2 h-2 rounded-full bg-[#CC823F] shrink-0"></span>
                            <span className="font-semibold text-slate-800 truncate">„{spellPopup.word}“</span>
                        </div>
                        <button
                            onClick={() => setSpellPopup(null)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {spellPopup.suggestions && spellPopup.suggestions.length > 0 ? (
                        <div className="space-y-1 mb-2">
                            <div className="text-[11px] uppercase font-semibold text-slate-400 px-1 tracking-wider">
                                Korrekturvorschläge:
                            </div>
                            {spellPopup.suggestions.map((sug, sIdx) => (
                                <button
                                    key={sIdx}
                                    onClick={() => {
                                        const newText =
                                            currentValue.substring(0, spellPopup.start) +
                                            sug +
                                            currentValue.substring(spellPopup.end);
                                        onUpdate(field.id, 'value', newText);
                                        onBlur(field.id, newText, 'value');
                                        setSpellPopup(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 font-semibold text-slate-700 hover:bg-[#66A8CB]/15 hover:text-[#2d6f93] rounded-lg transition-colors cursor-pointer flex items-center justify-between group"
                                >
                                    <span>{sug}</span>
                                    <Check size={14} className="opacity-0 group-hover:opacity-100 text-[#66A8CB]" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="px-2 py-1 text-slate-400 text-xs font-normal mb-2">
                            Keine direkten Vorschläge
                        </div>
                    )}

                    <div className="pt-1.5 border-t border-slate-100 space-y-1">
                        <button
                            onClick={() => {
                                spellChecker.addCustomWord(spellPopup.word);
                                setSpellPopup(null);
                            }}
                            className="w-full text-left px-2 py-1.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
                        >
                            <Plus size={14} className="text-emerald-600" />
                            <span>Zu Wörterbuch hinzufügen</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Suggestions Dropdown */}
            {field.isSelectionList && showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full max-h-40 overflow-y-auto bg-white border border-slate-200 shadow-lg rounded-b-lg z-50 mt-1">
                    {suggestions.map((option, idx) => (
                        <div
                            key={idx}
                            className="px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 cursor-pointer"
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                onUpdate(field.id, 'value', option);
                                setShowSuggestions(false);
                            }}
                        >
                            {option}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default SpellcheckTextarea;

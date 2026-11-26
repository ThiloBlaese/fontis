import React, { useState } from 'react';
import { Search, ArrowRight, X, Info, RotateCcw } from 'lucide-react';

import { searchNodes } from '../../api';

const RightSidebar = ({
  width,
  isOpen,
  onResizeStart,
  onToggle,
  onNavigate,
  searchQueries: propSearchQueries,
  setSearchQueries: propSetSearchQueries,
  fromYear: propFromYear,
  setFromYear: propSetFromYear,
  toYear: propToYear,
  setToYear: propSetToYear,
  searchMode: propSearchMode,
  setSearchMode: propSetSearchMode,
  lowestLevelOnly: propLowestLevelOnly,
  setLowestLevelOnly: propSetLowestLevelOnly,
  searchResults: propSearchResults,
  setSearchResults: propSetSearchResults,
  hasSearched: propHasSearched,
  setHasSearched: propSetHasSearched
}) => {
    // Local fallback states if not provided by parent
    const [localSearchQueries, setLocalSearchQueries] = useState([""]);
    const [localFromYear, setLocalFromYear] = useState("");
    const [localToYear, setLocalToYear] = useState("");
    const [localSearchMode, setLocalSearchMode] = useState("classic");
    const [localLowestLevelOnly, setLocalLowestLevelOnly] = useState(false);
    const [localSearchResults, setLocalSearchResults] = useState([]);
    const [localHasSearched, setLocalHasSearched] = useState(false);

    const searchQueries = propSearchQueries !== undefined ? propSearchQueries : localSearchQueries;
    const setSearchQueries = propSetSearchQueries || setLocalSearchQueries;
    const fromYear = propFromYear !== undefined ? propFromYear : localFromYear;
    const setFromYear = propSetFromYear || setLocalFromYear;
    const toYear = propToYear !== undefined ? propToYear : localToYear;
    const setToYear = propSetToYear || setLocalToYear;
    const searchMode = propSearchMode !== undefined ? propSearchMode : localSearchMode;
    const setSearchMode = propSetSearchMode || setLocalSearchMode;
    const lowestLevelOnly = propLowestLevelOnly !== undefined ? propLowestLevelOnly : localLowestLevelOnly;
    const setLowestLevelOnly = propSetLowestLevelOnly || setLocalLowestLevelOnly;
    const searchResults = propSearchResults !== undefined ? propSearchResults : localSearchResults;
    const setSearchResults = propSetSearchResults || setLocalSearchResults;
    const hasSearched = propHasSearched !== undefined ? propHasSearched : localHasSearched;
    const setHasSearched = propSetHasSearched || setLocalHasSearched;

    const [showInfoModal, setShowInfoModal] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchingMore, setIsSearchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const inputRef = React.useRef(null);
    const searchAbortControllerRef = React.useRef(null);
    const searchSeqRef = React.useRef(0);

    React.useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const prevFromYear = React.useRef(fromYear);
    const prevToYear = React.useRef(toYear);

    React.useEffect(() => {
        if (fromYear && toYear && fromYear.length === 4 && toYear.length === 4) {
            const from = parseInt(fromYear, 10);
            const to = parseInt(toYear, 10);
            if (!isNaN(from) && !isNaN(to) && from > to) {
                if (fromYear !== prevFromYear.current && toYear === prevToYear.current) {
                    setFromYear(toYear);
                } else if (toYear !== prevToYear.current && fromYear === prevFromYear.current) {
                    setToYear(fromYear);
                } else {
                    setToYear(fromYear);
                }
            }
        }
        prevFromYear.current = fromYear;
        prevToYear.current = toYear;
    }, [fromYear, toYear]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            handleSearch();
        }, 300); 

        return () => clearTimeout(timer);
    }, [searchQueries, fromYear, toYear, searchMode, lowestLevelOnly]);

    const LIMIT = 50;

    const handleSearch = async () => {
        const activeQueries = searchQueries.map(q => q.trim()).filter(q => q);

        if (activeQueries.length === 0 && !fromYear && !toYear) {
            if (searchAbortControllerRef.current) {
                searchAbortControllerRef.current.abort();
            }
            setSearchResults([]);
            setHasSearched(false);
            setHasMore(false);
            setIsSearching(false);
            return;
        }

        // Cancel previous pending search request
        if (searchAbortControllerRef.current) {
            searchAbortControllerRef.current.abort();
        }
        const controller = new AbortController();
        searchAbortControllerRef.current = controller;
        const currentSeq = ++searchSeqRef.current;

        // Auto-timeout after 20 seconds to prevent getting stuck in "Suche läuft..."
        const timeoutId = setTimeout(() => {
            if (currentSeq === searchSeqRef.current) {
                controller.abort();
            }
        }, 20000);

        setIsSearching(true);
        setHasSearched(true);
        setHasMore(true);
        try {
            const data = await searchNodes(
                activeQueries, 
                fromYear, 
                toYear, 
                0, 
                LIMIT, 
                searchMode, 
                lowestLevelOnly,
                controller.signal
            );
            clearTimeout(timeoutId);
            if (currentSeq === searchSeqRef.current) {
                const resultsArray = Array.isArray(data) ? data : [];
                setSearchResults(resultsArray);
                setHasMore(resultsArray.length === LIMIT);
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                return;
            }
            console.error("Search error:", error);
            if (currentSeq === searchSeqRef.current) {
                setSearchResults([]);
                setHasMore(false);
            }
        } finally {
            if (currentSeq === searchSeqRef.current) {
                setIsSearching(false);
            }
        }
    };

    const handleResetSearch = () => {
        if (searchAbortControllerRef.current) {
            searchAbortControllerRef.current.abort();
        }
        setFromYear("");
        setToYear("");
        setSearchQueries([""]);
        setSearchResults([]);
        setHasSearched(false);
        setIsSearching(false);
        setHasMore(false);
    };

    const handleLoadMore = async () => {
        if (isSearching || isSearchingMore || !hasMore) return;

        const activeQueries = searchQueries.map(q => q.trim()).filter(q => q);
        if (activeQueries.length === 0 && !fromYear && !toYear) return;

        setIsSearchingMore(true);
        const currentOffset = searchResults.length;
        try {
            const data = await searchNodes(activeQueries, fromYear, toYear, currentOffset, LIMIT, searchMode, lowestLevelOnly);
            if (Array.isArray(data)) {
                setSearchResults(prev => [...prev, ...data]);
                setHasMore(data.length === LIMIT);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Error loading more search results:", error);
            setHasMore(false);
        } finally {
            setIsSearchingMore(false);
        }
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 100) {
            handleLoadMore();
        }
    };

    const handleQueryChange = (index, value) => {
        const newQueries = [...searchQueries];
        newQueries[index] = value;

        if (index === newQueries.length - 1 && value.trim() !== "") {
            newQueries.push("");
        }

        if (newQueries.length > 1) {
            const lastIndex = newQueries.length - 1;
            const secondLastIndex = newQueries.length - 2;

            if (newQueries[lastIndex].trim() === "" && newQueries[secondLastIndex].trim() === "") {
                newQueries.pop();
            }
        }

        setSearchQueries(newQueries);
        setHasSearched(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{ width }} className="flex-shrink-0 bg-white border-l border-slate-200 flex flex-col h-full relative z-30 shadow-md">
            {/* Resize Handle */}
            <div
                className="absolute top-0 left-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors z-40"
                onMouseDown={onResizeStart}
            />

            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 font-semibold text-slate-700 bg-slate-50">
                <div className="flex flex-col justify-center">
                    <div className="flex items-center">
                        <Search size={20} className="mr-2 text-blue-600" />
                        <span>Suche</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {(searchQueries.some(q => q.trim()) || fromYear || toYear || searchResults.length > 0) && (
                        <button
                            onClick={handleResetSearch}
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-200 transition-all active:scale-95 cursor-pointer"
                            title="Sucheingaben und Ergebnisse zurücksetzen"
                        >
                            <RotateCcw size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Search filters */}
            <div className="p-4 border-b border-slate-100 flex flex-col gap-2">
                {/* Date Filter */}
                <div className="flex gap-2 items-center text-sm">
                    <div className="flex-1">
                        <input
                            type="number"
                            placeholder="Von"
                            value={fromYear}
                            onChange={(e) => setFromYear(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <span className="text-slate-400">-</span>
                    <div className="flex-1">
                        <input
                            type="number"
                            placeholder="Bis"
                            value={toYear}
                            onChange={(e) => setToYear(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    {searchQueries.map((query, index) => (
                        <div key={index} className="relative flex-1">
                            <input
                                ref={index === 0 ? inputRef : null}
                                type="text"
                                value={query}
                                onChange={(e) => handleQueryChange(index, e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={index === 0 ? "Suchbegriff..." : "und..."}
                                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {query && (
                                <button
                                    onClick={() => handleQueryChange(index, "")}
                                    className="absolute right-2 top-2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div 
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-2"
            >
                {isSearching ? (
                    <div className="text-center text-slate-400 mt-10 text-sm font-medium flex flex-col items-center gap-2">
                        <Search size={20} className="text-slate-400 mb-1" />
                        <span className="text-xs text-slate-500">Suche läuft...</span>
                    </div>
                ) : hasSearched && searchResults.length === 0 ? (
                    <div className="text-center text-slate-500 mt-10 px-4 flex flex-col items-center gap-2">
                        {searchMode === 'hybrid' || searchMode === 'semantic' ? (
                            <>
                                <span className="text-sm font-semibold text-slate-700">Keine hinreichend relevanten Ergebnisse</span>
                                <span className="text-xs text-slate-500 max-w-[280px] leading-relaxed">
                                    Für diesen Suchbegriff wurden keine Datensätze mit ausreichender inhaltlicher Relevanz gefunden.
                                </span>
                                <button
                                    onClick={() => setSearchMode('classic')}
                                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
                                >
                                    <span>Mit klassischer Stichwortsuche versuchen</span>
                                    <ArrowRight size={14} />
                                </button>
                            </>
                        ) : (
                            <span className="text-sm text-slate-500">Keine Ergebnisse gefunden.</span>
                        )}
                    </div>
                ) : !hasSearched && searchResults.length === 0 ? (
                    <div className="text-center text-slate-400 mt-10 text-sm">
                        Geben Sie einen Suchbegriff ein.
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                            {hasMore ? 'Mehr als ' : ''}{searchResults.length} {searchResults.length === 1 && !hasMore ? 'Suchergebnis' : 'Ergebnisse'}
                        </div>
                        {searchResults.map((result) => (
                            <div
                                key={result.id}
                                onClick={() => onNavigate(result.metadata.node_id, result.metadata.record_index)}
                                className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl cursor-pointer transition-all group"
                            >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span 
                                        className="font-semibold text-sm text-slate-800 truncate min-w-0 flex-1" 
                                        title={result.metadata.signature ? `${result.metadata.signature} (${result.metadata.node_label || ''})` : (result.metadata.node_label || "Unbenannt")}
                                    >
                                        {result.metadata.signature ? (
                                            result.metadata.signature
                                        ) : (
                                            `${result.metadata.node_label || "Unbenannt"} #${result.metadata.record_index + 1}`
                                        )}
                                    </span>
                                </div>
                                <div className="mt-1 flex justify-between items-center gap-2">
                                    <span className="text-xs text-slate-500 font-medium leading-relaxed truncate">
                                        {result.metadata.preview || "Keine Vorschau verfügbar"}
                                    </span>
                                    {searchMode === 'hybrid' && result.score && result.score < 1.0 && (
                                        <span className="text-[11px] bg-blue-50 border border-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md font-semibold shrink-0">
                                            {Math.round(result.score * 100)}% Relevanz
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isSearchingMore && (
                            <div className="text-center text-slate-400 py-3 text-xs animate-pulse">
                                Lade weitere Ergebnisse...
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Info Modal for Semantic Search */}
            {showInfoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" onClick={() => setShowInfoModal(false)}>
                    <div 
                        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Info size={20} />
                                </div>
                                <h3 className="font-semibold text-base text-slate-800">Semantische Suche</h3>
                            </div>
                            <button
                                onClick={() => setShowInfoModal(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="text-sm text-slate-600 space-y-3 leading-relaxed">
                            <p>
                                Die <strong>semantische Suche</strong> versteht die inhaltliche Bedeutung Ihrer Suchbegriffe und findet passende Datensätze auch dann, wenn abweichende Wörter verwendet wurden.
                            </p>
                            
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2.5 text-xs">
                                <div>
                                    <span className="font-semibold text-slate-700 block mb-0.5">Klassische Suche (Standard):</span>
                                    <span className="text-slate-500 leading-normal">Sucht exakt nach den eingegebenen Begriffen. Ideal für Signaturen, Aktenzeichen oder konkrete Eigennamen.</span>
                                </div>
                                <div className="pt-2.5 border-t border-slate-200/60">
                                    <span className="font-semibold text-blue-700 block mb-0.5">Semantische Suche (aktiviert):</span>
                                    <span className="text-slate-500 leading-normal">Berücksichtigt Synonyme und verwandte Themen (z. B. findet die Suche nach <em>„Feuerwehr“</em> auch <em>„Rettungseinsatz“</em> oder <em>„Löschwesen“</em>).</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button
                                onClick={() => setShowInfoModal(false)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                            >
                                Verstanden
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RightSidebar;

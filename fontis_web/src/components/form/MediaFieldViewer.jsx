import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    File,
    Music,
    ExternalLink,
    Maximize2,
    X
} from 'lucide-react';
import { openAssetExternally } from '../../utils/windowUtils';

const parseAsset = (assetStr) => {
    const parts = (assetStr || '').split('|');
    const cloudFileId = parts[0]?.trim() || '';
    const mimeType = (parts[1] || '').trim();
    const name = (parts[2] || '').trim();
    const thumbnailId = (parts[3] || '').trim();
    const fileUrl = `/api/cloud/files/${cloudFileId}`;
    return {
        cloudFileId,
        mimeType,
        name,
        thumbnailId,
        fileUrl,
        thumbnailUrl: `${fileUrl}?thumbnail=true`,
        isImage: mimeType.startsWith('image/'),
        isVideo: mimeType.startsWith('video/'),
        isAudio: mimeType.startsWith('audio/'),
        isPdf: mimeType === 'application/pdf'
    };
};

const MediaFieldViewer = ({
    assets,
    currentAssetIndex,
    setCurrentAssetIndex
}) => {
    const [touchStartX, setTouchStartX] = useState(null);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    useEffect(() => {
        if (!isLightboxOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setIsLightboxOpen(false);
            } else if (assets.length > 1 && e.key === 'ArrowLeft') {
                e.preventDefault();
                setCurrentAssetIndex(prev => (prev > 0 ? prev - 1 : assets.length - 1));
            } else if (assets.length > 1 && e.key === 'ArrowRight') {
                e.preventDefault();
                setCurrentAssetIndex(prev => (prev < assets.length - 1 ? prev + 1 : 0));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLightboxOpen, assets.length, setCurrentAssetIndex]);

    const handleTouchStart = (e) => {
        if (assets.length > 1 && e.touches.length === 1) {
            setTouchStartX(e.touches[0].clientX);
        }
    };

    const handleTouchEnd = (e) => {
        if (assets.length > 1 && touchStartX !== null && e.changedTouches.length === 1) {
            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchStartX - touchEndX;
            const threshold = 50;
            if (diffX > threshold) {
                setCurrentAssetIndex(prev => (prev < assets.length - 1 ? prev + 1 : 0));
            } else if (diffX < -threshold) {
                setCurrentAssetIndex(prev => (prev > 0 ? prev - 1 : assets.length - 1));
            }
        }
        setTouchStartX(null);
    };

    const currentAsset = assets[currentAssetIndex];
    if (!currentAsset) return null;

    const {
        name,
        thumbnailId,
        fileUrl,
        thumbnailUrl,
        isImage,
        isVideo,
        isAudio,
        isPdf
    } = parseAsset(currentAsset);

    const canPreviewInLightbox = isImage || isVideo;

    const handleOpenEnlarged = (e) => {
        e.stopPropagation();
        if (canPreviewInLightbox) {
            setIsLightboxOpen(true);
        } else {
            openAssetExternally(fileUrl);
        }
    };

    const goPrev = (e) => {
        e.stopPropagation();
        setCurrentAssetIndex(prev => (prev > 0 ? prev - 1 : assets.length - 1));
    };

    const goNext = (e) => {
        e.stopPropagation();
        setCurrentAssetIndex(prev => (prev < assets.length - 1 ? prev + 1 : 0));
    };

    return (
        <div
            className="w-full h-full relative group/asset"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 rounded overflow-hidden">
                {isImage ? (
                    <img
                        src={fileUrl}
                        alt={name}
                        className="w-full h-full object-contain"
                        onDoubleClick={handleOpenEnlarged}
                    />
                ) : isVideo ? (
                    <div className="w-full h-full relative group/video">
                        <video
                            src={fileUrl}
                            controls
                            className="w-full h-full object-contain z-10"
                            preload="metadata"
                            playsInline
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                        />
                    </div>
                ) : isPdf ? (
                    <div
                        className="w-full h-full relative group/pdf"
                        onDoubleClick={handleOpenEnlarged}
                    >
                        {thumbnailId ? (
                            <img
                                src={thumbnailUrl}
                                alt={name}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-3 justify-center h-full">
                                <div className="p-3 bg-red-50 rounded-none border border-red-100 shadow-sm">
                                    <FileText size={32} className="text-red-500" />
                                </div>
                                <span className="text-[11px] uppercase font-semibold text-slate-500 px-4 text-center line-clamp-1">
                                    {name}
                                </span>
                            </div>
                        )}
                    </div>
                ) : isAudio ? (
                    <div className="w-full h-full relative group/audio flex flex-col items-center justify-center p-2">
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-blue-100/50 pointer-events-none"></div>
                        <div className="z-10 p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-sm mb-3 text-blue-500 border border-blue-100/50">
                            <Music size={20} />
                        </div>
                        <audio
                            src={fileUrl}
                            controls
                            controlsList="nodownload"
                            tabIndex={-1}
                            className="w-full max-w-[240px] h-8 z-10"
                            preload="metadata"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                        />
                        <span className="text-[11px] uppercase font-semibold text-slate-500 px-4 text-center line-clamp-1 mt-2 z-10">
                            {name}
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-slate-100 rounded-none border border-slate-200 shadow-sm">
                            <File size={32} className="text-slate-400" />
                        </div>
                        <span className="text-[11px] uppercase font-semibold text-slate-500 px-4 text-center line-clamp-1">
                            {name}
                        </span>
                    </div>
                )}

                {/* Enlarge / Open button */}
                {!isAudio && (
                    <button
                        type="button"
                        onClick={handleOpenEnlarged}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        tabIndex={-1}
                        className="absolute top-2 right-2 p-1.5 bg-black/45 hover:bg-black/65 backdrop-blur-md rounded-md text-white transition-all z-30 shadow-sm opacity-0 group-hover/asset:opacity-100 cursor-pointer"
                        title={canPreviewInLightbox ? 'Vergrößert anzeigen' : 'Extern öffnen'}
                    >
                        {canPreviewInLightbox ? <Maximize2 size={16} /> : <ExternalLink size={16} />}
                    </button>
                )}

                {/* Asset Navigation Overlay */}
                {assets.length > 1 && (
                    <>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full text-[11px] text-white font-semibold tracking-wider z-20">
                            {currentAssetIndex + 1} / {assets.length}
                        </div>

                        <button
                            type="button"
                            onClick={goPrev}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            tabIndex={-1}
                            className="absolute left-1 top-1/2 -translate-y-1/2 p-1.5 bg-black/30 hover:bg-black/50 active:bg-black/60 rounded-full text-white transition-all z-30 opacity-0 group-hover/asset:opacity-100 cursor-pointer"
                            title="Vorheriges Digitalisat"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <button
                            type="button"
                            onClick={goNext}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            tabIndex={-1}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-black/30 hover:bg-black/50 active:bg-black/60 rounded-full text-white transition-all z-30 opacity-0 group-hover/asset:opacity-100 cursor-pointer"
                            title="Nächstes Digitalisat"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </>
                )}
            </div>

            {/* Fullscreen Lightbox Modal */}
            {isLightboxOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8"
                    onClick={() => setIsLightboxOpen(false)}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Top Bar */}
                    <div
                        className="absolute top-4 left-4 right-4 flex items-center justify-between gap-4 text-white z-20"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 min-w-0 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10">
                            <span className="text-sm font-medium truncate">{name || 'Digitalisat'}</span>
                            {assets.length > 1 && (
                                <span className="text-xs text-slate-300 font-semibold shrink-0">
                                    {currentAssetIndex + 1} / {assets.length}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => openAssetExternally(fileUrl)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-lg border border-white/10 transition-colors cursor-pointer"
                                title="Im Standardprogramm öffnen"
                            >
                                <ExternalLink size={14} />
                                <span>Extern öffnen</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsLightboxOpen(false)}
                                className="p-2 text-white bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-lg border border-white/10 transition-colors cursor-pointer"
                                title="Schließen (Esc)"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Media Content */}
                    <div
                        className="relative max-w-[92vw] max-h-[84vh] flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isImage ? (
                            <img
                                src={fileUrl}
                                alt={name}
                                className="max-w-[92vw] max-h-[84vh] object-contain rounded shadow-2xl select-none"
                            />
                        ) : isVideo ? (
                            <video
                                src={fileUrl}
                                controls
                                autoPlay
                                className="max-w-[92vw] max-h-[84vh] object-contain rounded shadow-2xl"
                            />
                        ) : null}
                    </div>

                    {/* Carousel arrows inside Lightbox */}
                    {assets.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={goPrev}
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/45 hover:bg-black/70 text-white rounded-full border border-white/10 transition-colors cursor-pointer z-20"
                                title="Vorheriges Digitalisat (←)"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                type="button"
                                onClick={goNext}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/45 hover:bg-black/70 text-white rounded-full border border-white/10 transition-colors cursor-pointer z-20"
                                title="Nächstes Digitalisat (→)"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export default MediaFieldViewer;

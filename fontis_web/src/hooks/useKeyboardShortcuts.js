import { useEffect, useRef } from 'react';
import { toggleAppFullscreen } from '../utils/windowUtils';

const isTypingTarget = (target) => {
    if (!target) return false;
    return ['INPUT', 'TEXTAREA'].includes(target.tagName) || Boolean(target.isContentEditable);
};

const blurActiveElement = () => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
};

export const createKeyDownHandler = (getConfig) => (e) => {
    const {
        activeNode,
        activeNodeId,
        currentRecordIndex,
        totalRecords,
        onOpenHelp,
        onStartRenameNode,
        onNewRecord,
        onPrevRecord,
        onNextRecord,
        onOpenJumpModal,
        onOpenSearch,
        onToggleSidebar,
        onDeleteRecord,
        onToggleFullscreen = toggleAppFullscreen
    } = getConfig();

    const isInput = isTypingTarget(e.target);

    // F11 - Vollbild
    if (e.key === 'F11') {
        e.preventDefault();
        onToggleFullscreen();
        return;
    }

    // F1 - Hilfe & Anleitung
    if (e.key === 'F1') {
        e.preventDefault();
        onOpenHelp();
        return;
    }

    // F2 - Bestand umbenennen
    if (e.key === 'F2') {
        if (activeNodeId) {
            e.preventDefault();
            onStartRenameNode(activeNodeId);
        }
        return;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlOrCmd) return;

    const keyLower = e.key.toLowerCase();

    // Strg + N - Neuer Datensatz
    if (!e.shiftKey && keyLower === 'n') {
        if (activeNode) {
            e.preventDefault();
            blurActiveElement();
            onNewRecord();
        }
        return;
    }

    // Strg + Pfeil links - Vorheriger Datensatz (nicht im Textfeld)
    if (!e.shiftKey && e.key === 'ArrowLeft') {
        if (!isInput && currentRecordIndex > 0) {
            e.preventDefault();
            blurActiveElement();
            onPrevRecord();
        }
        return;
    }

    // Strg + Pfeil rechts - Nächster Datensatz (nicht im Textfeld)
    if (!e.shiftKey && e.key === 'ArrowRight') {
        if (!isInput && currentRecordIndex < totalRecords - 1) {
            e.preventDefault();
            blurActiveElement();
            onNextRecord();
        }
        return;
    }

    // Strg + J - Zu Datensatznummer springen
    if (!e.shiftKey && keyLower === 'j') {
        if (activeNode && totalRecords > 0) {
            e.preventDefault();
            onOpenJumpModal();
        }
        return;
    }

    // Strg + F - Suchleiste öffnen & Suchfeld fokussieren
    if (!e.shiftKey && keyLower === 'f') {
        e.preventDefault();
        onOpenSearch();
        setTimeout(() => {
            if (typeof document === 'undefined') return;
            const searchInput =
                document.querySelector('input[placeholder*="Suchbegriff"]') ||
                document.querySelector('input[type="text"]');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }, 60);
        return;
    }

    // Strg + B - Bestandsbaum ein-/ausblenden
    if (!e.shiftKey && keyLower === 'b') {
        e.preventDefault();
        onToggleSidebar();
        return;
    }

    // Strg + Entf - Aktuellen Datensatz löschen (nicht im Textfeld)
    if (e.key === 'Delete' || e.key === 'Del') {
        if (!isInput && totalRecords > 0) {
            e.preventDefault();
            onDeleteRecord(currentRecordIndex);
        }
    }
};

export const useKeyboardShortcuts = (config) => {
    const configRef = useRef(config);
    configRef.current = config;

    useEffect(() => {
        const handleKeyDown = createKeyDownHandler(() => configRef.current);
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
};

import { describe, it, expect, vi } from 'vitest';
import { createKeyDownHandler } from './useKeyboardShortcuts';

const makeEvent = (overrides = {}) => ({
    key: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault: vi.fn(),
    ...overrides
});

const makeConfig = (overrides = {}) => ({
    activeNode: { id: 'node-1', label: 'Bestand A' },
    activeNodeId: 'node-1',
    currentRecordIndex: 1,
    totalRecords: 3,
    onOpenHelp: vi.fn(),
    onStartRenameNode: vi.fn(),
    onNewRecord: vi.fn(),
    onPrevRecord: vi.fn(),
    onNextRecord: vi.fn(),
    onOpenJumpModal: vi.fn(),
    onOpenSearch: vi.fn(),
    onToggleSidebar: vi.fn(),
    onDeleteRecord: vi.fn(),
    onToggleFullscreen: vi.fn(),
    ...overrides
});

describe('createKeyDownHandler', () => {
    it('handles F1, F2 and F11 function keys', () => {
        const config = makeConfig();
        const handler = createKeyDownHandler(() => config);

        const eF1 = makeEvent({ key: 'F1' });
        handler(eF1);
        expect(eF1.preventDefault).toHaveBeenCalled();
        expect(config.onOpenHelp).toHaveBeenCalledOnce();

        const eF2 = makeEvent({ key: 'F2' });
        handler(eF2);
        expect(eF2.preventDefault).toHaveBeenCalled();
        expect(config.onStartRenameNode).toHaveBeenCalledWith('node-1');

        const eF11 = makeEvent({ key: 'F11' });
        handler(eF11);
        expect(eF11.preventDefault).toHaveBeenCalled();
        expect(config.onToggleFullscreen).toHaveBeenCalledOnce();
    });

    it('handles Ctrl+N, Ctrl+J, Ctrl+F and Ctrl+B', () => {
        vi.useFakeTimers();
        const config = makeConfig();
        const handler = createKeyDownHandler(() => config);

        handler(makeEvent({ key: 'n', ctrlKey: true }));
        expect(config.onNewRecord).toHaveBeenCalledOnce();

        handler(makeEvent({ key: 'j', ctrlKey: true }));
        expect(config.onOpenJumpModal).toHaveBeenCalledOnce();

        handler(makeEvent({ key: 'f', ctrlKey: true }));
        expect(config.onOpenSearch).toHaveBeenCalledOnce();
        vi.runAllTimers();

        handler(makeEvent({ key: 'b', ctrlKey: true }));
        expect(config.onToggleSidebar).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });

    it('navigates records with Ctrl+ArrowLeft / Ctrl+ArrowRight outside inputs', () => {
        const config = makeConfig({ currentRecordIndex: 1, totalRecords: 3 });
        const handler = createKeyDownHandler(() => config);

        handler(makeEvent({ key: 'ArrowLeft', ctrlKey: true }));
        expect(config.onPrevRecord).toHaveBeenCalledOnce();

        handler(makeEvent({ key: 'ArrowRight', ctrlKey: true }));
        expect(config.onNextRecord).toHaveBeenCalledOnce();
    });

    it('ignores Ctrl+Arrow and Ctrl+Delete when typing in an input or textarea', () => {
        const config = makeConfig({ currentRecordIndex: 1, totalRecords: 3 });
        const handler = createKeyDownHandler(() => config);
        const textareaTarget = { tagName: 'TEXTAREA', isContentEditable: false };

        handler(makeEvent({ key: 'ArrowLeft', ctrlKey: true, target: textareaTarget }));
        handler(makeEvent({ key: 'ArrowRight', ctrlKey: true, target: textareaTarget }));
        handler(makeEvent({ key: 'Delete', ctrlKey: true, target: textareaTarget }));

        expect(config.onPrevRecord).not.toHaveBeenCalled();
        expect(config.onNextRecord).not.toHaveBeenCalled();
        expect(config.onDeleteRecord).not.toHaveBeenCalled();
    });

    it('deletes current record on Ctrl+Delete outside inputs', () => {
        const config = makeConfig({ currentRecordIndex: 2, totalRecords: 3 });
        const handler = createKeyDownHandler(() => config);

        const eDel = makeEvent({ key: 'Delete', ctrlKey: true });
        handler(eDel);
        expect(eDel.preventDefault).toHaveBeenCalled();
        expect(config.onDeleteRecord).toHaveBeenCalledWith(2);
    });
});

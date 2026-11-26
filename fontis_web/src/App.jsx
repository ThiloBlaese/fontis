import React, { useState, useEffect, useRef } from 'react';

import MenuBar from './components/layout/MenuBar';
import FloatingToolbar from './components/layout/FloatingToolbar';
import Sidebar from './components/layout/Sidebar';
import RightSidebar from './components/layout/RightSidebar';
import BackupManager from './components/layout/BackupManager';
import ImportExportManager from './components/layout/ImportExportManager';
import FindbuchManager from './components/layout/FindbuchManager';
import ConfirmDialog from './components/ui/ConfirmDialog';
import HelpModal from './components/ui/HelpModal';
import AboutModal from './components/ui/AboutModal';
import JumpToRecordModal from './components/ui/JumpToRecordModal';
import DatabaseModal from './components/ui/DatabaseModal';
import FormCanvas from './components/form/FormCanvas';
import { findNodeById, getSubtreeStats } from './utils/treeUtils';
import { findFreePosition } from './utils/layoutUtils';
import { spellChecker } from './utils/spellChecker';
import { toggleAppFullscreen } from './utils/windowUtils';
import { useSidebarState } from './hooks/useSidebarState';
import { useTreeData, expandAll, expandPathToNode } from './hooks/useTreeData';
import { useRecords } from './hooks/useRecords';
import { useConfirmDialog } from './hooks/useConfirmDialog';
import { useArchiveLayout } from './hooks/useArchiveLayout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

import {
  fetchRootNodes, updateNode, setActiveNode, fetchNodePath
} from './api';

const GRID_SIZE = 32;

function App() {
  const {
    isSidebarOpen, setIsSidebarOpen, sidebarWidth, startSidebarResize,
    isRightSidebarOpen, setIsRightSidebarOpen, rightSidebarWidth, startRightSidebarResize
  } = useSidebarState();

  const [activeModal, setActiveModal] = useState(null);
  const openModal = (name) => setActiveModal(name);
  const closeModal = () => setActiveModal(null);

  const [dbReloadTrigger, setDbReloadTrigger] = useState(0);
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(() => {
    const saved = localStorage.getItem('fontis_spellcheck');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    if (spellcheckEnabled) {
      spellChecker.init();
    }
  }, [spellcheckEnabled]);

  const handleToggleSpellcheck = (enabled) => {
    setSpellcheckEnabled(enabled);
    localStorage.setItem('fontis_spellcheck', enabled.toString());
    if (enabled) {
      spellChecker.init();
    }
  };

  const isAdmin = true;

  const [isLoaded, setIsLoaded] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [renamingNodeId, setRenamingNodeId] = useState(null);

  const handleDatabaseChanged = () => {
    setActiveNodeId(null);
    localStorage.removeItem('fontis_activeNodeId');
    localStorage.removeItem('fontis_currentRecordIndex');
    spellChecker.reloadFromBackend();
    setDbReloadTrigger(c => c + 1);
  };

  const handleExit = async () => {
    try {
      await fetch('/api/system/exit', { method: 'POST' });
    } catch {
      window.close();
    }
  };

  const {
    treeData, setTreeData, handleToggleNode, handleAddNode, handleDeleteNode,
    handleRenameNode, handleMoveNode, updateActiveNodeData
  } = useTreeData(activeNodeId, setActiveNodeId);

  const activeNode = findNodeById(treeData, activeNodeId);
  const layoutFields = activeNode?.layoutFields || [];

  const {
    records, setRecords, recordsRef, currentRecordIndex, setCurrentRecordIndex,
    isLoading: isRecordsLoading, updateRecords, handlePrevRecord, handleNextRecord,
    handleNewRecord, handleJumpToRecord, handleDeleteRecord, targetRecordIndexRef
  } = useRecords(activeNodeId, isLoaded, layoutFields);

  const {
    selectedId, setSelectedId, isDeleteMode, isAdjustingLayout,
    newlyCreatedFieldIdRef, setNewlyCreatedFieldId, handleFieldUpdate, handleFieldBlur: handleFieldBlurBase,
    startDrag, startResize, duplicateField
  } = useArchiveLayout(activeNodeId, layoutFields, updateActiveNodeData);

  const { confirmDialog, closeConfirmDialog, showConfirm } = useConfirmDialog();

  // Persisted search state across sidebar toggles
  const [searchQueries, setSearchQueries] = useState(['']);
  const [searchFromYear, setSearchFromYear] = useState('');
  const [searchToYear, setSearchToYear] = useState('');
  const [searchMode, setSearchMode] = useState('classic');
  const [searchLowestLevelOnly, setSearchLowestLevelOnly] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => {
    if (activeNodeId && isLoaded) {
      localStorage.setItem('fontis_activeNodeId', activeNodeId);
      setActiveNode(activeNodeId);
    }
  }, [activeNodeId, isLoaded]);

  useEffect(() => {
    const init = async () => {
      const roots = await fetchRootNodes();
      const savedNodeId = localStorage.getItem('fontis_activeNodeId');
      const savedRecordIndex = localStorage.getItem('fontis_currentRecordIndex');

      let currentTree = await expandAll(roots || []);

      if (savedNodeId) {
        try {
          const path = await fetchNodePath(savedNodeId);
          if (path && path.length > 0) {
            currentTree = await expandPathToNode(savedNodeId, currentTree, path);
            setTreeData(currentTree);
            setActiveNodeId(savedNodeId);
            if (savedRecordIndex !== null) targetRecordIndexRef.current = parseInt(savedRecordIndex, 10);
            setIsLoaded(true);
            return;
          }
        } catch (error) {
          console.log('Fallback to root', error);
        }
      }

      setTreeData(currentTree);
      if (currentTree?.length > 0) setActiveNodeId(currentTree[0].id);
      setIsLoaded(true);
    };
    init();
  }, [dbReloadTrigger, setTreeData, setActiveNodeId, targetRecordIndexRef]);

  const handleSelectNode = (nodeId) => {
    if (nodeId !== activeNodeId) {
      setActiveNodeId(nodeId);
      setCurrentRecordIndex(0);
    }
  };

  const updateField = (fieldId, key, value) => {
    if (key === 'value') {
      setRecords(prev => {
        const newRecords = [...prev];
        newRecords[currentRecordIndex] = { ...newRecords[currentRecordIndex], [fieldId]: value };
        return newRecords;
      });
    } else {
      handleFieldUpdate(fieldId, key, value);
    }
  };

  const handleFieldBlur = async (fieldId, value, key, manualLayout = null) => {
    if (key === 'value') {
      try {
        let recordsToSave = recordsRef.current;
        if (fieldId && value !== undefined) {
          recordsToSave = [...recordsRef.current];
          recordsToSave[currentRecordIndex] = { ...recordsToSave[currentRecordIndex], [fieldId]: value };
          setRecords(recordsToSave);
        }
        await updateRecords(recordsToSave);
      } catch (error) {
        console.error('Save record failed', error);
      }
    } else {
      await handleFieldBlurBase(fieldId, value, key, manualLayout);
    }
  };

  const handleDeleteNodeWithConfirm = (nodeId) => {
    const node = findNodeById(treeData, nodeId);
    if (!node) return;

    const { subnodesCount, recordsCount } = getSubtreeStats(node);
    let message = '';
    if (subnodesCount > 0 && recordsCount > 0) {
      message = `Bestand "${node.label}" mit allen Unterbeständen (${subnodesCount}) und Datensätzen (${recordsCount}) löschen?`;
    } else if (subnodesCount > 0) {
      message = `Bestand "${node.label}" mit allen Unterbeständen (${subnodesCount}) löschen?`;
    } else if (recordsCount > 0) {
      message = `Bestand "${node.label}" und alle Datensätze (${recordsCount}) löschen?`;
    } else {
      message = `Leeren Bestand "${node.label}" löschen?`;
    }

    showConfirm({
      title: 'Bestand löschen',
      message,
      onConfirm: () => handleDeleteNode(nodeId)
    });
  };

  const handleDeleteRecordWithConfirm = (index) => {
    showConfirm({
      title: 'Datensatz löschen',
      message: 'Aktuellen Datensatz löschen?',
      onConfirm: () => handleDeleteRecord(index)
    });
  };

  const handleDoubleClick = async (e) => {
    if (!activeNodeId) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const width = 288;
    const height = 128;
    const clickX = e.clientX - rect.left + (container.scrollLeft || 0);
    const clickY = e.clientY - rect.top + (container.scrollTop || 0);
    const preferredX = Math.max(0, clickX - width / 2);
    const preferredY = Math.max(0, clickY - height / 2);
    const { x, y } = findFreePosition(preferredX, preferredY, width, height, layoutFields);

    const newField = { id: 'field_' + Date.now(), label: 'NEUES FELD', x, y, width, height, bgColor: 'bg-white' };
    const newLayout = [...layoutFields, newField];
    handleFieldUpdate(null, 'layoutFields', newLayout);
    setNewlyCreatedFieldId(newField.id);
    setSelectedId(newField.id);
    try {
      await updateNode(activeNodeId, { layoutFields: newLayout });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteField = async (fieldId) => {
    const field = layoutFields.find(f => f.id === fieldId);
    if (!field) return;
    const isFieldEmpty = records.every(r => !r[fieldId]?.toString().trim());
    const performDeletion = async () => {
      const newLayout = layoutFields.filter(f => f.id !== fieldId);
      handleFieldUpdate(null, 'layoutFields', newLayout);
      try {
        await updateNode(activeNodeId, { layoutFields: newLayout });
      } catch (error) {
        console.error(error);
      }
    };

    if (isFieldEmpty) {
      performDeletion();
    } else {
      showConfirm({
        title: 'Feld löschen',
        message: `Das Feld "${field.label}" enthält Daten. Fortfahren?`,
        onConfirm: performDeletion
      });
    }
  };

  const copyPreviousValue = (fieldId) => {
    if (currentRecordIndex > 0) {
      const prevValue = records[currentRecordIndex - 1][fieldId];
      updateField(fieldId, 'value', prevValue || '');
    }
  };

  const handleNavigateFromSearch = async (nodeId, recordIndex) => {
    if (!nodeId) return;
    const sid = String(nodeId);
    const targetIdx = typeof recordIndex === 'number' ? recordIndex : (parseInt(recordIndex, 10) || 0);

    if (String(activeNodeId) === sid) {
      handleJumpToRecord(targetIdx);
      return;
    }

    try {
      const path = await fetchNodePath(nodeId);
      if (path && path.length > 0) {
        const newTree = await expandPathToNode(nodeId, treeData, path);
        setTreeData(newTree);
      }
    } catch (error) {
      console.error('Failed to expand path during search navigation:', error);
    }

    targetRecordIndexRef.current = targetIdx;
    setActiveNodeId(sid);
  };

  const handleStartRenameNode = (nodeId) => {
    if (!nodeId) return;
    setIsSidebarOpen(true);
    setRenamingNodeId(nodeId);
  };

  useKeyboardShortcuts({
    activeNode,
    activeNodeId,
    currentRecordIndex,
    totalRecords: records.length,
    onOpenHelp: () => openModal('help'),
    onStartRenameNode: handleStartRenameNode,
    onNewRecord: handleNewRecord,
    onPrevRecord: handlePrevRecord,
    onNextRecord: handleNextRecord,
    onOpenJumpModal: () => openModal('jump'),
    onOpenSearch: () => setIsRightSidebarOpen(true),
    onToggleSidebar: () => setIsSidebarOpen(prev => !prev),
    onDeleteRecord: handleDeleteRecordWithConfirm
  });

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans text-slate-800 overflow-hidden">
      <MenuBar
        onOpenDatabase={() => openModal('database')}
        onOpenBackups={() => openModal('backups')}
        onExit={handleExit}
        onAddNode={() => handleAddNode(activeNodeId)}
        onRenameNode={() => handleStartRenameNode(activeNodeId)}
        onDeleteNode={() => activeNodeId && handleDeleteNodeWithConfirm(activeNodeId)}
        canRenameNode={!!activeNodeId}
        canDeleteNode={!!activeNodeId}
        onNewRecord={handleNewRecord}
        onPrevRecord={handlePrevRecord}
        onNextRecord={handleNextRecord}
        onDeleteRecord={() => handleDeleteRecordWithConfirm(currentRecordIndex)}
        onOpenJumpToRecord={() => openModal('jump')}
        totalRecords={records.length}
        canPrevRecord={currentRecordIndex > 0}
        canNextRecord={currentRecordIndex < records.length - 1}
        canDeleteRecord={records.length > 0}
        hasActiveNode={!!activeNode}
        isSidebarOpen={isSidebarOpen}
        isRightSidebarOpen={isRightSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onToggleSearch={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        onOpenFindbuch={() => openModal('findbuch')}
        onOpenImportExport={() => openModal('importExport')}
        spellcheckEnabled={spellcheckEnabled}
        onToggleSpellcheck={() => handleToggleSpellcheck(!spellcheckEnabled)}
        searchMode={searchMode}
        onToggleSearchMode={() => setSearchMode(prev => prev === 'hybrid' ? 'classic' : 'hybrid')}
        lowestLevelOnly={searchLowestLevelOnly}
        onToggleLowestLevelOnly={() => setSearchLowestLevelOnly(prev => !prev)}
        onOpenHelp={() => openModal('help')}
        onOpenAbout={() => openModal('about')}
        onToggleFullscreen={toggleAppFullscreen}
      />

      <div className="flex-1 flex flex-row w-full min-h-0 relative overflow-hidden">
        {isSidebarOpen && (
          <Sidebar
            width={sidebarWidth}
            treeData={treeData}
            activeNodeId={activeNodeId}
            onSelect={handleSelectNode}
            onAdd={handleAddNode}
            onDelete={handleDeleteNodeWithConfirm}
            onRename={handleRenameNode}
            onToggle={handleToggleNode}
            onMoveNode={handleMoveNode}
            onResizeStart={startSidebarResize}
            isAdmin={isAdmin}
            activeNodeRecordsCount={records.length}
            renamingNodeId={renamingNodeId}
            setRenamingNodeId={setRenamingNodeId}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 relative">
          <FormCanvas
            key={activeNodeId}
            activeNodeId={activeNodeId}
            containerRef={containerRef}
            activeNode={activeNode}
            layoutFields={layoutFields}
            records={records}
            currentRecordIndex={currentRecordIndex}
            selectedId={selectedId}
            newlyCreatedFieldId={newlyCreatedFieldIdRef}
            isDeleteMode={isDeleteMode}
            isLoading={isRecordsLoading}
            onBackgroundMouseDown={() => setSelectedId(null)}
            onBackgroundTouchStart={() => setSelectedId(null)}
            onBackgroundContextMenu={(e) => e.preventDefault()}
            onDoubleClick={isAdmin ? handleDoubleClick : undefined}
            onFieldMouseDown={setSelectedId}
            onFieldDragStart={isAdmin ? startDrag : undefined}
            onFieldResizeStart={isAdmin ? startResize : undefined}
            onFieldUpdate={updateField}
            onFieldDelete={isAdmin ? deleteField : undefined}
            onFieldDuplicate={isAdmin ? duplicateField : undefined}
            onFieldCopyPrevious={copyPreviousValue}
            onFieldBlur={handleFieldBlur}
            gridSize={GRID_SIZE}
            showGrid={isAdjustingLayout}
            isAdmin={isAdmin}
            searchQueries={searchQueries}
            isSearchOpen={isRightSidebarOpen}
            spellCheckEnabled={spellcheckEnabled}
          />
        </div>

        {isRightSidebarOpen && (
          <RightSidebar
            width={rightSidebarWidth}
            isOpen={isRightSidebarOpen}
            onResizeStart={startRightSidebarResize}
            onToggle={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            treeData={treeData}
            activeNodeId={activeNodeId}
            onNavigate={handleNavigateFromSearch}
            searchQueries={searchQueries}
            setSearchQueries={setSearchQueries}
            fromYear={searchFromYear}
            setFromYear={setSearchFromYear}
            toYear={searchToYear}
            setToYear={setSearchToYear}
            searchMode={searchMode}
            setSearchMode={setSearchMode}
            lowestLevelOnly={searchLowestLevelOnly}
            setLowestLevelOnly={setSearchLowestLevelOnly}
            searchResults={searchResults}
            setSearchResults={setSearchResults}
            hasSearched={hasSearched}
            setHasSearched={setHasSearched}
          />
        )}
      </div>

      <FloatingToolbar
        hasActiveNode={!!activeNode}
        currentRecordIndex={currentRecordIndex}
        totalRecords={records.length}
        canPrevRecord={currentRecordIndex > 0}
        canNextRecord={currentRecordIndex < records.length - 1}
        isSearchOpen={isRightSidebarOpen}
        onPrevRecord={handlePrevRecord}
        onNextRecord={handleNextRecord}
        onOpenJumpToRecord={() => openModal('jump')}
        onNewRecord={handleNewRecord}
        onToggleSearch={() => setIsRightSidebarOpen(prev => !prev)}
      />

      <BackupManager isOpen={activeModal === 'backups'} onClose={closeModal} />
      <ImportExportManager isOpen={activeModal === 'importExport'} onClose={closeModal} activeNodeId={activeNodeId} />
      <FindbuchManager isOpen={activeModal === 'findbuch'} onClose={closeModal} activeNodeId={activeNodeId} />
      <HelpModal isOpen={activeModal === 'help'} onClose={closeModal} />
      <AboutModal isOpen={activeModal === 'about'} onClose={closeModal} />
      <JumpToRecordModal
        isOpen={activeModal === 'jump'}
        onClose={closeModal}
        totalRecords={records.length}
        currentRecordIndex={currentRecordIndex}
        onJump={handleJumpToRecord}
      />
      <DatabaseModal
        isOpen={activeModal === 'database'}
        onClose={closeModal}
        onDatabaseChanged={handleDatabaseChanged}
      />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirmDialog}
        isDanger={confirmDialog.isDanger}
      />
    </div>
  );
}

export default App;

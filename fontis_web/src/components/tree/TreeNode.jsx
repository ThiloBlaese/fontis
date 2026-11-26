import React, { useState, useEffect } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Folder,
    FolderOpen,
    Database,
    Loader2
} from 'lucide-react';

const TreeNode = ({
    node,
    level,
    activeNodeId,
    onSelect,
    onAdd,
    onDelete,
    onRename,
    onRenameCancel,
    onToggle,
    onMoveNode,
    renamingNodeId,
    activeNodeRecordsCount,
    isEditMode
}) => {
    const isRenaming = renamingNodeId === node.id;
    const [editValue, setEditValue] = useState(node.label);
    const [isIndexing, setIsIndexing] = useState(false);
    const [dropPosition, setDropPosition] = useState(null); // 'top', 'middle', 'bottom'

    useEffect(() => {
        if (isRenaming) {
            setEditValue(node.label);
        }
    }, [isRenaming, node.label]);

    React.useEffect(() => {
        if (!node.isRoot) return;

        const checkStatus = async () => {
            try {
                const res = await fetch('/api/global-indexing-status');
                if (res.ok) {
                    const data = await res.json();
                    setIsIndexing(data.isIndexing);
                }
            } catch (e) {
                // console.error(e); 
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 2000);

        return () => clearInterval(interval);
    }, [node.isRoot]);

    const handleSave = () => {
        if (editValue.trim()) {
            onRename(node.id, editValue);
        } else {
            onRenameCancel();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setEditValue(node.label);
            onRenameCancel();
        }
    };

    // Drag and Drop Handlers
    const handleDragStart = (e) => {
        if (!isEditMode) return;
        e.dataTransfer.setData('text/plain', node.id);
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
    };

    const handleDragOver = (e) => {
        if (!isEditMode) return;
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
        e.stopPropagation();

        // Determine drop position relative to the element height
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        if (node.isRoot) {
            // Root can only accept 'inside'
            setDropPosition('middle');
        } else if (y < height * 0.25) {
            setDropPosition('top');
        } else if (y > height * 0.75) {
            setDropPosition('bottom');
        } else {
            setDropPosition('middle');
        }
    };

    const handleDragEnter = (e) => {
        if (!isEditMode) return;
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e) => {
        if (!isEditMode) return;
        setDropPosition(null);
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        if (!isEditMode) return;
        e.preventDefault();
        e.stopPropagation();
        
        const position = dropPosition;
        setDropPosition(null);
        
        const draggedNodeId = e.dataTransfer.getData('text/plain');
        if (draggedNodeId && draggedNodeId !== node.id) {
            // position is 'top', 'middle', or 'bottom'
            // Map to: 'before', 'after', 'inside'
            const mappedPos = position === 'top' ? 'before' : (position === 'bottom' ? 'after' : 'inside');
            onMoveNode(draggedNodeId, node.id, mappedPos);
        }
    };

    const isActive = activeNodeId === node.id;

    return (
        <div className="select-none relative">
            {/* Insert Indicator Top */}
            {dropPosition === 'top' && (
                <div 
                    className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-50" 
                    style={{ marginLeft: `${level * 16 + 8}px` }}
                >
                    <div className="absolute -left-1.5 -top-[3px] w-2 h-2 rounded-full border-2 border-blue-500 bg-white" />
                </div>
            )}

            <div
                onClick={() => onSelect(node.id)}
                draggable={isEditMode}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors
                    ${isActive ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100 text-slate-700'}
                    ${isRenaming ? 'bg-blue-50' : ''}
                    ${dropPosition === 'middle' ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                `}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
                {/* Toggle */}
                {(node.hasChildren || (node.children && node.children.length > 0)) ? (
                    <div
                        onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
                        className={`p-0.5 rounded ${isActive ? 'hover:bg-blue-200 text-blue-700' : 'hover:bg-slate-200 text-slate-400'}`}
                    >
                        {node.isLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <ChevronRight size={14} className={`transition-transform duration-200 ${node.isOpen ? 'rotate-90' : ''}`} />
                        )}
                    </div>
                ) : (
                    <div className="w-4.5 h-4.5" />
                )}

                {/* Icon */}
                <div className={`mr-1 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                    {node.isRoot ? <Database size={16} /> : (
                        (node.isOpen && node.children && node.children.length > 0) ? <FolderOpen size={16} /> : <Folder size={16} />
                    )}
                </div>

                {/* Label */}
                {isRenaming ? (
                    <div className="flex items-center flex-1 gap-1 min-w-0">
                        <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSave}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 px-1 py-0.5 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-between min-w-0">
                        <span className="truncate font-medium">{node.label}</span>
                    </div>
                )}

                {/* Root Indexing Status */}
                {node.isRoot && isIndexing && (
                    <div className="ml-2 flex items-center" title="Indexierung läuft...">
                        <Loader2 size={14} className="animate-spin text-blue-500" />
                    </div>
                )}
            </div>

            {/* Insert Indicator Bottom */}
            {dropPosition === 'bottom' && (
                <div 
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-50" 
                    style={{ marginLeft: `${level * 16 + 8}px` }}
                >
                    <div className="absolute -left-1.5 -top-[3px] w-2 h-2 rounded-full border-2 border-blue-500 bg-white" />
                </div>
            )}

            {/* Children with smooth height transition */}
            <div className={`grid transition-all duration-200 ease-in-out ${node.isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    {/* Render children if they exist, or an empty div to give the grid something to animate against if loading/empty but open */}
                    {node.children && node.children.length > 0 ? (
                        node.children.map(child => (
                            <TreeNode
                                key={child.id}
                                node={child}
                                level={level + 1}
                                activeNodeId={activeNodeId}
                                onSelect={onSelect}
                                onAdd={onAdd}
                                onDelete={onDelete}
                                onRename={onRename}
                                onRenameCancel={onRenameCancel}
                                onToggle={onToggle}
                                onMoveNode={onMoveNode}
                                renamingNodeId={renamingNodeId}
                                activeNodeRecordsCount={activeNodeRecordsCount}
                                isEditMode={isEditMode}
                            />
                        ))
                    ) : node.isOpen && node.isLoading ? (
                        <div className="py-2 pl-8 text-xs text-slate-400">Lade...</div>
                    ) : node.isOpen ? (
                        <div className="h-0" />
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default TreeNode;

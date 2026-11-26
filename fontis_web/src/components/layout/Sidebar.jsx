import React, { useState } from 'react';
import TreeNode from '../tree/TreeNode';

const Sidebar = ({
    width,
    treeData,
    activeNodeId,
    onSelect,
    onAdd,
    onDelete,
    onRename,
    onToggle,
    onMoveNode,
    onResizeStart,
    activeNodeRecordsCount,
    isAdmin,
    renamingNodeId: propRenamingNodeId,
    setRenamingNodeId: propSetRenamingNodeId
}) => {
    const [internalRenamingNodeId, setInternalRenamingNodeId] = useState(null);
    const renamingNodeId = propRenamingNodeId !== undefined ? propRenamingNodeId : internalRenamingNodeId;
    const setRenamingNodeId = propSetRenamingNodeId || setInternalRenamingNodeId;

    const handleRenameComplete = (id, newLabel) => {
        onRename(id, newLabel);
        setRenamingNodeId(null);
    };

    const handleRenameCancel = () => {
        setRenamingNodeId(null);
    };

    // A drop target for the root level
    const handleRootDrop = (e) => {
        if (!isAdmin) return;
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId) {
             onMoveNode(draggedId, 'root');
        }
    };

    const handleRootDragOver = (e) => {
        if (!isAdmin) return;
        e.preventDefault();
    };

    return (
        <div style={{ width }} className="flex-shrink-0 bg-white border-r border-slate-200 flex flex-col relative z-30 shadow-md">
            {/* Tree */}
            <div 
                className="flex-1 overflow-y-auto p-2"
                onDrop={handleRootDrop}
                onDragOver={handleRootDragOver}
            >
                {treeData.map(node => (
                    <TreeNode
                        key={node.id}
                        node={node}
                        level={0}
                        activeNodeId={activeNodeId}
                        onSelect={onSelect}
                        onAdd={onAdd}
                        onDelete={onDelete}
                        onRename={handleRenameComplete}
                        onRenameCancel={handleRenameCancel}
                        onToggle={onToggle}
                        onMoveNode={onMoveNode}
                        renamingNodeId={renamingNodeId}
                        activeNodeRecordsCount={activeNodeRecordsCount}
                        isEditMode={isAdmin}
                    />
                ))}
            </div>

            {/* Resize Handle */}
            <div
                className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors z-30 flex items-center justify-center"
                onMouseDown={onResizeStart}
            />
        </div>
    );
};

export default Sidebar;

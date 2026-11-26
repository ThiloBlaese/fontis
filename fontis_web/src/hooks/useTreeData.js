import { useState, useCallback } from 'react';
import { 
    fetchNodeChildren, 
    createNode as apiCreateNode, 
    updateNode as apiUpdateNode, 
    deleteNode as apiDeleteNode
} from '../api';

export const useTreeData = (activeNodeId, setActiveNodeId) => {
    const [treeData, setTreeData] = useState([]);

    const updateActiveNodeData = useCallback((updates) => {
        setTreeData(prev => {
            const updateInTree = (nodes) => nodes.map(node => {
                if (node.id === activeNodeId) return { ...node, ...updates };
                if (node.children) return { ...node, children: updateInTree(node.children) };
                return node;
            });
            return updateInTree(prev);
        });
    }, [activeNodeId]);

    const handleToggleNode = async (nodeId) => {
        const toggleRecursive = async (nodes) => {
            return await Promise.all(nodes.map(async node => {
                if (node.id === nodeId) {
                    const nextIsOpen = !node.isOpen;
                    let children = node.children;
                    if (nextIsOpen && (!children || children.length === 0)) {
                        try {
                            children = await fetchNodeChildren(nodeId);
                            // Also map isOpen: true for children if needed, but fetchNodeChildren already does that in api.js
                        } catch (err) {
                            console.error("Failed to fetch children", err);
                        }
                    }
                    return { ...node, isOpen: nextIsOpen, children };
                }
                if (node.children) {
                    return { ...node, children: await toggleRecursive(node.children) };
                }
                return node;
            }));
        };
        const newTree = await toggleRecursive(treeData);
        setTreeData(newTree);
    };

    const handleAddNode = async (selectedNodeId, label = "Neuer Bestand") => {
        let realParentId = null;
        let fieldsToInherit = [];

        if (selectedNodeId) {
            const { findParentId, findNodeById } = await import('../utils/treeUtils');
            realParentId = findParentId(treeData, selectedNodeId);
            const activeNode = findNodeById(treeData, selectedNodeId);
            if (activeNode && activeNode.layoutFields) {
                fieldsToInherit = activeNode.layoutFields;
            }
        }

        try {
            const newNode = await apiCreateNode(realParentId, label, fieldsToInherit);
            const addRecursive = (nodes) => nodes.map(node => {
                if (node.id === realParentId) {
                    return {
                        ...node,
                        isOpen: true,
                        hasChildren: true,
                        children: [...(node.children || []), { ...newNode, isOpen: false, children: [] }]
                    };
                }
                if (node.children) return { ...node, children: addRecursive(node.children) };
                return node;
            });

            if (!realParentId) {
                setTreeData([...treeData, { ...newNode, isOpen: false, children: [] }]);
            } else {
                setTreeData(addRecursive(treeData));
            }
            setActiveNodeId(newNode.id);
        } catch (err) {
            console.error("Failed to add node", err);
        }
    };

    const handleDeleteNode = async (nodeId) => {
        try {
            await apiDeleteNode(nodeId);
            const deleteRecursive = (nodes) => nodes.filter(node => {
                if (node.id === nodeId) return false;
                if (node.children) node.children = deleteRecursive(node.children);
                return true;
            });
            setTreeData(deleteRecursive([...treeData]));
            if (activeNodeId === nodeId) setActiveNodeId(null);
        } catch (err) {
            console.error("Failed to delete node", err);
        }
    };

    const handleRenameNode = async (nodeId, newLabel) => {
        try {
            await apiUpdateNode(nodeId, { label: newLabel });
            const renameRecursive = (nodes) => nodes.map(node => {
                if (node.id === nodeId) return { ...node, label: newLabel };
                if (node.children) return { ...node, children: renameRecursive(node.children) };
                return node;
            });
            setTreeData(renameRecursive(treeData));
        } catch (err) {
            console.error("Failed to rename node", err);
            alert(`Fehler beim Umbenennen: ${err.message}`);
        }
    };

    const handleMoveNode = async (nodeId, targetId, position) => {
        try {
            await apiUpdateNode(nodeId, { targetId, position });
            
            const { fetchRootNodes } = await import('../api');
            const roots = await fetchRootNodes();
            const updatedTree = await expandAll(roots);
            setTreeData(updatedTree);
            setActiveNodeId(nodeId);
            return true; 
        } catch (err) {
            console.error("Failed to move node", err);
            alert(`Fehler beim Verschieben: ${err.message}`);
            return false;
        }
    };

    return {
        treeData, setTreeData,
        handleToggleNode,
        handleAddNode,
        handleDeleteNode,
        handleRenameNode,
        handleMoveNode,
        updateActiveNodeData,
        expandAll,
        expandPathToNode
    };
};

export const expandAll = async (nodes) => {
    if (!Array.isArray(nodes)) return [];
    return await Promise.all(nodes.map(async node => {
        if (!node) return node;
        let children = node.children;
        if (node.hasChildren && (!children || children.length === 0)) {
            try {
                children = await fetchNodeChildren(node.id);
            } catch (err) {
                console.error("Failed to fetch children during expansion", err);
                children = [];
            }
        }
        return {
            ...node,
            isOpen: true,
            children: await expandAll(children || []),
            hasChildren: (children && children.length > 0) || node.hasChildren
        };
    }));
};

export const expandPathToNode = async (nodeId, currentTreeData, pathStack) => {
    if (!Array.isArray(currentTreeData)) return [];

    // Extract IDs as strings if pathStack contains objects or mixed types
    const ids = (pathStack || []).map(item => {
        const id = (typeof item === 'object' && item !== null) ? item.id : item;
        return id ? String(id) : null;
    }).filter(id => id !== null);

    const expandRecursive = async (nodes, stack) => {
        if (!Array.isArray(nodes)) return [];
        if (stack.length === 0) return nodes;

        const nextId = String(stack[0]);
        const remainingStack = stack.slice(1);

        return await Promise.all(nodes.map(async node => {
            if (!node || !node.id) return node;

            if (String(node.id) === nextId) {
                let children = node.children;
                if (!children || children.length === 0) {
                    try {
                        children = await fetchNodeChildren(node.id);
                    } catch (err) {
                        console.error("Failed to fetch children during expansion", err);
                        children = [];
                    }
                }

                return {
                    ...node,
                    isOpen: true,
                    children: await expandRecursive(children || [], remainingStack),
                    hasChildren: (children && children.length > 0) || node.hasChildren
                };
            }
            return node;
        }));
    };

    return await expandRecursive([...currentTreeData], ids);
};

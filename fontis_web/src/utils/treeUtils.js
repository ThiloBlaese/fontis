export const findNodeById = (nodes, id) => {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
        }
    }
    return null;
};

export const findParentId = (nodes, childId, currentParentId = null) => {
    for (const node of nodes) {
        if (node.id === childId) return currentParentId;
        if (node.children) {
            const found = findParentId(node.children, childId, node.id);
            if (found !== undefined) return found;
        }
    }
    return undefined;
};

export const getSubtreeStats = (node) => {
    if (!node) return { subnodesCount: 0, recordsCount: 0 };
    let subnodesCount = 0;
    let recordsCount = node.recordCount || 0;

    const traverse = (current) => {
        if (!current.children || current.children.length === 0) return;
        subnodesCount += current.children.length;
        current.children.forEach((child) => {
            recordsCount += child.recordCount || 0;
            traverse(child);
        });
    };

    traverse(node);
    return { subnodesCount, recordsCount };
};

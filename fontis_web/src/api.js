const apiFetch = async (url, options = {}) => {
    const response = await fetch(url, options);
    if (response.status === 403) {
        throw new Error('Aktion nicht zulässig.');
    }
    return response;
};

// --- Granular API ---

export const fetchNodePath = async (nodeId) => {
    try {
        const response = await apiFetch(`/api/nodes/${nodeId}/path`);
        if (!response.ok) throw new Error('Failed to fetch node path');
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return [];
    }
};

export const fetchRootNodes = async () => {
    try {
        const response = await apiFetch('/api/nodes/root');
        if (!response.ok) throw new Error('Failed to fetch root nodes');
        const data = await response.json();
        return data.map(n => ({ ...n, isOpen: true }));
    } catch (error) {
        console.error('API Error:', error);
        return [];
    }
};

export const fetchArchiveInfo = async () => {
    try {
        const response = await apiFetch('/api/archives/current');
        if (!response.ok) throw new Error('Failed to fetch archive info');
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
};

export const fetchNodeChildren = async (nodeId) => {
    try {
        const response = await apiFetch(`/api/nodes/${nodeId}/children`);
        if (!response.ok) throw new Error('Failed to fetch node children');
        const data = await response.json();
        return data.map(n => ({ ...n, isOpen: true }));
    } catch (error) {
        console.error('API Error:', error);
        return [];
    }
};

export const createNode = async (parentId, label, layoutFields = []) => {
    try {
        const response = await apiFetch('/api/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parent_id: parentId, label, layoutFields })
        });
        if (!response.ok) throw new Error('Failed to create node');
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const updateNode = async (nodeId, updates) => {
    // updates can contain: label, isOpen, layoutFields, parentId, sortOrder, targetId, position
    try {
        const response = await apiFetch(`/api/nodes/${nodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const errMsg = errBody.detail || `Failed to update node: ${response.statusText}`;
            throw new Error(errMsg);
        }
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const deleteNode = async (nodeId) => {
    try {
        const response = await apiFetch(`/api/nodes/${nodeId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`Failed to delete node: ${response.statusText}`);
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const fetchNodeRecords = async (nodeId) => {
    try {
        const response = await apiFetch(`/api/nodes/${nodeId}/records`);
        if (!response.ok) throw new Error('Failed to fetch records');
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return [];
    }
};

export const updateNodeRecords = async (nodeId, records) => {
    try {
        const response = await apiFetch(`/api/nodes/${nodeId}/records`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(records)
        });
        if (!response.ok) throw new Error(`Failed to update records: ${response.statusText}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const setActiveNode = async (nodeId) => {
    try {
        const response = await apiFetch('/api/state/active_node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ node_id: nodeId })
        });
        if (!response.ok) console.warn("Failed to sync active node", response.statusText);
    } catch (error) {
        console.warn("Failed to sync active node", error);
    }
};

// --- Backup Management API ---

export const fetchBackups = async () => {
    try {
        const response = await apiFetch('/api/backups');
        if (!response.ok) throw new Error('Failed to fetch backups');
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return [];
    }
};

export const createBackup = async () => {
    const response = await apiFetch('/api/backups', { method: 'POST' });
    if (!response.ok) throw new Error('Backup konnte nicht erstellt werden');
    return await response.json();
};

export const restoreBackup = async (filename) => {
    try {
        const response = await apiFetch(`/api/backups/${filename}/restore`, { method: 'POST' });
        if (!response.ok) throw new Error(`Failed to restore backup: ${response.statusText}`);
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// No fetch method for download, we'll just use the URL directly in an <a> tag.

// --- Legacy Monolithic Support (Removed) ---
// saveState and loadState have been removed to prevent data loss.
// Granular API (fetchRootNodes, etc.) is now the only way to interact with backend.

// --- Import & Export Endpoints ---

export const exportJson = async () => {
    try {
        const response = await apiFetch('/api/export/json');
        if (!response.ok) throw new Error('Failed to export data');
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const importJson = async (file, append = false, nodeId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('append', append);
    if (nodeId) {
        formData.append('node_id', nodeId);
    }
    try {
        const response = await apiFetch('/api/import/json', {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to import JSON');
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const exportCsv = async (nodeId = null) => {
    try {
        let url = '/api/export/csv';
        if (nodeId) {
            url += `?node_id=${nodeId}`;
        }
        const response = await apiFetch(url);
        if (!response.ok) {
            throw new Error('Failed to export CSV');
        }
        return await response.text();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const exportPdf = async () => {
    try {
        const response = await apiFetch('/api/export/pdf');
        if (!response.ok) {
            throw new Error('Failed to export PDF');
        }
        return await response.blob();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const importCsv = async (file, append = false, nodeId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('append', append);
    if (nodeId) {
        formData.append('node_id', nodeId);
    }
    try {
        const response = await apiFetch('/api/import/csv', {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || 'CSV Import failed');
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const exportEadXml = async (mapping) => {
    try {
        const response = await apiFetch('/api/export/ead', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(mapping),
        });
        if (!response.ok) {
            throw new Error('Failed to export as EAD/XML');
        }
        return await response.blob();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const importEadXml = async (file, mapping, append = false, nodeId = null) => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('mapping', JSON.stringify(mapping));
        formData.append('append', append);
        if (nodeId) {
            formData.append('node_id', nodeId);
        }

        const response = await apiFetch('/api/import/ead', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to import EAD/XML');
        }
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export const searchNodes = async (queries, fromYear, toYear, offset = 0, limit = 50, mode = 'classic', lowestLevelOnly = false, signal = null) => {
    let url = `/api/search?`;
    if (queries && queries.length > 0) {
        queries.forEach(q => {
            url += `q=${encodeURIComponent(q)}&`;
        });
    }
    if (fromYear) url += `from_year=${encodeURIComponent(fromYear)}&`;
    if (toYear) url += `to_year=${encodeURIComponent(toYear)}&`;
    url += `offset=${encodeURIComponent(offset)}&`;
    url += `limit=${encodeURIComponent(limit)}&`;
    url += `mode=${encodeURIComponent(mode)}&`;
    if (lowestLevelOnly) url += `lowest_level_only=true&`;
    if (url.endsWith('&')) url = url.slice(0, -1);

    try {
        const response = await apiFetch(url, signal ? { signal } : {});
        if (!response.ok) {
            throw new Error('Search failed');
        }
        return await response.json();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('API Error:', error);
        }
        throw error;
    }
};

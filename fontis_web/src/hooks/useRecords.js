import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchNodeRecords, updateNodeRecords as apiUpdateNodeRecords } from '../api';

export function incrementSignature(sig) {
    if (!sig || typeof sig !== 'string') return '';
    const match = sig.match(/(\d+)$/);
    if (!match) return '';
    
    const numStr = match[1];
    const index = match.index;
    const incrementedNum = parseInt(numStr, 10) + 1;
    const paddedNum = String(incrementedNum).padStart(numStr.length, '0');
    return sig.substring(0, index) + paddedNum;
}

export const useRecords = (activeNodeId, isLoaded, layoutFields = []) => {
    const [records, setRecords] = useState([{}]);
    const [currentRecordIndex, setCurrentRecordIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const recordsRef = useRef(records);
    const targetRecordIndexRef = useRef(null);

    useEffect(() => {
        recordsRef.current = records;
    }, [records]);

    const loadRecords = useCallback(async (nodeId) => {
        setIsLoading(true);
        try {
            const data = await fetchNodeRecords(nodeId);
            const initialRecords = data && data.length > 0 ? data : [{}];
            setRecords(initialRecords);

            if (targetRecordIndexRef.current !== null) {
                const idx = Math.min(targetRecordIndexRef.current, initialRecords.length - 1);
                setCurrentRecordIndex(idx >= 0 ? idx : 0);
                targetRecordIndexRef.current = null;
            } else {
                setCurrentRecordIndex(0);
            }
        } catch (err) {
            console.error("Failed to fetch records", err);
            setRecords([{}]);
            setCurrentRecordIndex(0);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeNodeId) {
            loadRecords(activeNodeId);
        } else {
            setRecords([{}]);
            setCurrentRecordIndex(0);
        }
    }, [activeNodeId, loadRecords]);

    useEffect(() => {
        if (isLoaded && activeNodeId) {
            localStorage.setItem('fontis_currentRecordIndex', currentRecordIndex);
        }
    }, [currentRecordIndex, isLoaded, activeNodeId]);

    const updateRecords = async (newRecords) => {
        try {
            const updated = await apiUpdateNodeRecords(activeNodeId, newRecords);
            if (updated && Array.isArray(updated)) {
                setRecords(updated);
                return updated;
            }
        } catch (err) {
            console.error("Failed to save records", err);
            throw err;
        }
    };

    const handlePrevRecord = () => {
        setCurrentRecordIndex(prev => Math.max(0, prev - 1));
    };

    const handleNextRecord = () => {
        setCurrentRecordIndex(prev => Math.min(records.length - 1, prev + 1));
    };

    const handleNewRecord = async () => {
        let newRecord = {};
        
        // Find if there is a "Signatur" field in the layout
        const signatureField = layoutFields.find(f => f && f.label && f.label.toUpperCase() === 'SIGNATUR');
        if (signatureField && records.length > 0) {
            const lastRecord = records[records.length - 1];
            const prevSignature = lastRecord[signatureField.id];
            if (prevSignature && typeof prevSignature === 'string') {
                const nextSignature = incrementSignature(prevSignature);
                if (nextSignature) {
                    newRecord = { [signatureField.id]: nextSignature };
                }
            }
        }
        
        const newRecords = [...records, newRecord];
        setRecords(newRecords);
        setCurrentRecordIndex(newRecords.length - 1);
        await updateRecords(newRecords);
    };

    const handleJumpToRecord = (index) => {
        const idx = Math.max(0, Math.min(records.length - 1, index));
        setCurrentRecordIndex(idx);
    };

    const handleDeleteRecord = async (index) => {
        if (records.length <= 1) {
            const newRecords = [{}];
            setRecords(newRecords);
            setCurrentRecordIndex(0);
            await updateRecords(newRecords);
            return;
        }

        const newRecords = records.filter((_, i) => i !== index);
        const newIndex = Math.min(index, newRecords.length - 1);
        setRecords(newRecords);
        setCurrentRecordIndex(newIndex);
        await updateRecords(newRecords);
    };

    return {
        records, setRecords, recordsRef,
        currentRecordIndex, setCurrentRecordIndex,
        isLoading,
        loadRecords,
        updateRecords,
        handlePrevRecord,
        handleNextRecord,
        handleNewRecord,
        handleJumpToRecord,
        handleDeleteRecord,
        targetRecordIndexRef
    };
};

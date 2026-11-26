import { useState, useRef } from 'react';
import { updateNode as apiUpdateNode } from '../api';
import {
    GRID_SIZE,
    DEFAULT_FIELD_WIDTH,
    DEFAULT_FIELD_HEIGHT,
    findFreePosition
} from '../utils/layoutUtils';

export const useArchiveLayout = (activeNodeId, layoutFields, updateActiveNodeData) => {
    const [selectedId, setSelectedId] = useState(null);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [isAdjustingLayout, setIsAdjustingLayout] = useState(false);
    const newlyCreatedFieldIdRef = useRef(null);

    const setNewlyCreatedFieldId = (id) => {
        newlyCreatedFieldIdRef.current = id;
    };

    const updateFieldState = (fieldId, key, value) => {
        if (key === 'layoutFields') {
            updateActiveNodeData({ layoutFields: value });
        } else {
            const newLayout = layoutFields.map(f => f.id === fieldId ? { ...f, [key]: value } : f);
            updateActiveNodeData({ layoutFields: newLayout });
        }
    };

    const saveLayout = async (manualLayout = null) => {
        try {
            const layoutToSave = manualLayout || layoutFields;
            await apiUpdateNode(activeNodeId, { layoutFields: layoutToSave });
        } catch (e) {
            console.error("Failed to save layout", e);
        }
    };

    const handleFieldUpdate = (fieldId, key, value) => {
        updateFieldState(fieldId, key, value);
    };

    const handleFieldBlur = async (fieldId, value, key, manualLayout = null) => {
        if (key === 'new-field-done') {
            newlyCreatedFieldIdRef.current = null;
            return;
        }
        await saveLayout(manualLayout);
    };

    const startDrag = (e, fieldId) => {
        const field = layoutFields.find(f => f.id === fieldId);
        if (!field) return;
        setIsAdjustingLayout(true);
        
        const isTouchEvent = e.touches && e.touches.length > 0;
        const startX = isTouchEvent ? e.touches[0].clientX : e.clientX;
        const startY = isTouchEvent ? e.touches[0].clientY : e.clientY;
        
        const initialX = field.x || 0;
        const initialY = field.y || 0;
        let currentX = initialX;
        let currentY = initialY;

        const onMove = (moveEvent) => {
            const isTouchMove = moveEvent.touches && moveEvent.touches.length > 0;
            if (isTouchMove && moveEvent.cancelable) {
                moveEvent.preventDefault(); // Prevent page scrolling during drag
            }
            const currentClientX = isTouchMove ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const currentClientY = isTouchMove ? moveEvent.touches[0].clientY : moveEvent.clientY;
            
            const dx = currentClientX - startX;
            const dy = currentClientY - startY;
            currentX = Math.max(0, initialX + dx);
            currentY = Math.max(0, initialY + dy);
            const newLayout = layoutFields.map(f => f.id === fieldId ? { ...f, x: currentX, y: currentY } : f);
            updateActiveNodeData({ layoutFields: newLayout });
        };

        const onEnd = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
            
            const snappedX = Math.max(0, Math.round(currentX / GRID_SIZE) * GRID_SIZE);
            const snappedY = Math.max(0, Math.round(currentY / GRID_SIZE) * GRID_SIZE);
            const newLayout = layoutFields.map(f => f.id === fieldId ? { ...f, x: snappedX, y: snappedY } : f);
            updateActiveNodeData({ layoutFields: newLayout });
            handleFieldBlur(fieldId, null, 'layout', newLayout);
            setIsAdjustingLayout(false);
        };
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    };

    const startResize = (e, fieldId) => {
        const field = layoutFields.find(f => f.id === fieldId);
        if (!field) return;
        setIsAdjustingLayout(true);
        
        const isTouchEvent = e.touches && e.touches.length > 0;
        const startX = isTouchEvent ? e.touches[0].clientX : e.clientX;
        const startY = isTouchEvent ? e.touches[0].clientY : e.clientY;
        
        const initialWidth = field.width || 288;
        const initialHeight = field.height || 128;
        let currentWidth = initialWidth;
        let currentHeight = initialHeight;

        const onMove = (moveEvent) => {
            const isTouchMove = moveEvent.touches && moveEvent.touches.length > 0;
            if (isTouchMove && moveEvent.cancelable) {
                moveEvent.preventDefault(); // Prevent page scrolling during resize
            }
            const currentClientX = isTouchMove ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const currentClientY = isTouchMove ? moveEvent.touches[0].clientY : moveEvent.clientY;
            
            const dx = currentClientX - startX;
            const dy = currentClientY - startY;
            currentWidth = Math.max(120, initialWidth + dx);
            currentHeight = Math.max(80, initialHeight + dy);
            const newLayout = layoutFields.map(f => f.id === fieldId ? { ...f, width: currentWidth, height: currentHeight } : f);
            updateActiveNodeData({ layoutFields: newLayout });
        };

        const onEnd = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
            
            const snappedWidth = Math.max(128, Math.round(currentWidth / GRID_SIZE) * GRID_SIZE);
            const snappedHeight = Math.max(64, Math.round(currentHeight / GRID_SIZE) * GRID_SIZE);
            const newLayout = layoutFields.map(f => f.id === fieldId ? { ...f, width: snappedWidth, height: snappedHeight } : f);
            updateActiveNodeData({ layoutFields: newLayout });
            handleFieldBlur(fieldId, null, 'layout', newLayout);
            setIsAdjustingLayout(false);
        };
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    };

    const duplicateField = async (fieldId) => {
        const field = layoutFields.find(f => f.id === fieldId);
        if (!field) return;
        const width = field.width || DEFAULT_FIELD_WIDTH;
        const height = field.height || DEFAULT_FIELD_HEIGHT;
        const pos = findFreePosition(
            (field.x || 0) + width + GRID_SIZE,
            field.y || 0,
            width,
            height,
            layoutFields
        );
        const newField = {
            ...field,
            id: 'field_' + Date.now(),
            x: pos.x,
            y: pos.y
        };
        const newLayout = [...layoutFields, newField];
        updateActiveNodeData({ layoutFields: newLayout });
        await apiUpdateNode(activeNodeId, { layoutFields: newLayout });
    };

    return {
        selectedId, setSelectedId,
        isDeleteMode, setIsDeleteMode,
        isAdjustingLayout,
        newlyCreatedFieldIdRef,
        setNewlyCreatedFieldId,
        handleFieldUpdate,
        handleFieldBlur,
        startDrag,
        startResize,
        duplicateField,
        saveLayout
    };
};

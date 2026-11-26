import { useState, useCallback } from 'react';

export const useConfirmDialog = () => {
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDanger: true
    });

    const closeConfirmDialog = useCallback(() => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }, []);

    const showConfirm = useCallback(({ title, message, onConfirm, isDanger = true }) => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            onConfirm: () => {
                onConfirm();
                closeConfirmDialog();
            },
            isDanger
        });
    }, [closeConfirmDialog]);

    return {
        confirmDialog,
        closeConfirmDialog,
        showConfirm
    };
};

import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Löschen", cancelText = "Abbrechen", isDanger = true }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-modal-backdrop">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-modal-content">
                <div className="px-6 py-5 flex items-start gap-4">
                    <div className={`p-2 rounded-full shrink-0 ${isDanger ? 'bg-[#CC823F]/10 text-[#CC823F]' : 'bg-[#66A8CB]/10 text-[#66A8CB]'}`}>
                        <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                        <h3 className="text-base font-semibold text-slate-800 mb-2">{title}</h3>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{message}</p>
                    </div>
                </div>
                <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={isDanger ? { backgroundColor: '#CC823F' } : { backgroundColor: '#66A8CB' }}
                        className={`px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-all hover:brightness-90`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;

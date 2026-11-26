import React, { useState, useEffect, useRef } from 'react';
import { Hash, X } from 'lucide-react';

const JumpToRecordModal = ({ isOpen, onClose, totalRecords = 1, currentRecordIndex = 0, onJump }) => {
  const [targetNumber, setTargetNumber] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTargetNumber((currentRecordIndex + 1).toString());
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, currentRecordIndex]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    let num = parseInt(targetNumber, 10);
    if (!isNaN(num)) {
      if (num < 1) num = 1;
      if (num > totalRecords) num = totalRecords;
      if (onJump) {
        onJump(num - 1);
      }
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xs overflow-hidden flex flex-col animate-modal-content">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-[#66A8CB]" />
            <h3 className="text-sm font-semibold text-slate-800">Zu Datensatz springen</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Datensatznummer (1 bis {totalRecords}):
            </label>
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={totalRecords}
              value={targetNumber}
              onChange={(e) => setTargetNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#66A8CB] focus:ring-2 focus:ring-[#66A8CB]/20 text-center font-semibold text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#66A8CB] hover:bg-[#5597BA] rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Springen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JumpToRecordModal;

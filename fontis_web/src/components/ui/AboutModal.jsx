import React from 'react';
import { X, Heart, Shield } from 'lucide-react';
import logoIcon from '../../assets/logo_icon.png';

const AboutModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-modal-content">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="Fontis Logo" className="w-8 h-8 object-contain" />
            <div>
              <h2 className="text-base font-semibold text-slate-800">Fontis Archiv</h2>
              <p className="text-xs text-slate-500">Freies Archivsystem</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-600">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Version:</span>
              <span className="font-mono text-slate-600">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Lizenz:</span>
              <span className="text-emerald-700 font-medium">MIT (Open Source)</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Datenhaltung:</span>
              <span className="text-slate-600">Lokal / SQLite</span>
            </div>
          </div>

          <p className="leading-relaxed">
            Fontis ist ein modernes, quelloffenes Archivfachinformationssystem für kleine und mittlere Archive, Vereine und Sammlungen.
          </p>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="flex items-center gap-2 text-slate-500">
              <Shield size={14} className="text-[#66A8CB]" />
              <span>Keine Cloud, keine Abos, keine externen Server.</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Heart size={14} className="text-rose-500" />
              <span>Frei zugänglich für die Archiv-Community.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} Thilo Hermanns</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;

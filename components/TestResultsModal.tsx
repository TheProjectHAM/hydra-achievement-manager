import React from 'react';
import { CloseIcon, SteamIcon, HydraIcon, CheckIcon } from './Icons';

interface TestResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    results: any | null;
}

const TestResultsModal: React.FC<TestResultsModalProps> = ({ isOpen, onClose, results }) => {
    if (!isOpen || !results) return null;

    const ResultItem = ({ title, data }: { title: string, data: any }) => (
        <div className="flex flex-col gap-1 py-2.5 border-b border-[var(--border-color)] last:border-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${data.success ? 'bg-emerald-500' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-main)] opacity-80">{title}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-mono text-[var(--text-muted)] opacity-50">{data.time}ms</span>
                    {data.success ? (
                        <CheckIcon className="text-sm text-emerald-500/80" />
                    ) : (
                        <CloseIcon className="text-sm text-rose-500/80" />
                    )}
                </div>
            </div>
            {!data.success && (
                <div className="mt-1 p-2 rounded bg-rose-500/5 border border-rose-500/10 font-mono text-[10px] text-rose-400/90 break-all leading-relaxed">
                    {data.message}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div
                className="w-full max-w-md bg-[var(--bg-color)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden border border-[var(--border-color)] animate-modal-in flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                    <h3 className="text-base font-bold text-[var(--text-main)]">
                        Connectivity Status
                    </h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-all"
                    >
                        <CloseIcon className="text-lg" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {/* Steam Section */}
                    <div className="mt-4 mb-6">
                        <div className="flex items-center gap-2 mb-2 opacity-40">
                            <SteamIcon className="text-xs" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Steam</span>
                        </div>
                        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] px-4">
                            <ResultItem title="Backend" data={results.steam.backend} />
                            <ResultItem title="Frontend" data={results.steam.frontend} />
                        </div>
                    </div>

                    {/* Hydra Section */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2 opacity-40">
                            <HydraIcon className="text-xs" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Hydra</span>
                        </div>
                        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] px-4">
                            <ResultItem title="Backend" data={results.hydra.backend} />
                            <ResultItem title="Frontend" data={results.hydra.frontend} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--hover-bg)] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-1.5 rounded-lg bg-[var(--text-main)] text-[var(--bg-color)] text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TestResultsModal;

import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { CloseIcon, CheckIcon, PowerIcon } from './Icons';

interface TimeFormatWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveAndRestart: () => void;
}

const TimeFormatWarningModal: React.FC<TimeFormatWarningModalProps> = ({ isOpen, onClose, onSaveAndRestart }) => {
    const { t } = useI18n();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div
                className="relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-modal-in"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-main)' }}>
                        {t('settings.language.timeFormatWarning.title')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="opacity-40 hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--text-main)' }}
                    >
                        <CloseIcon className="text-xl" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                    <p className="text-sm font-medium leading-relaxed opacity-70" style={{ color: 'var(--text-main)' }}>
                        {t('settings.language.timeFormatWarning.description')}
                    </p>
                </div>

                {/* Footer */}
                <div className="p-6 pt-2 flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 h-12 rounded-xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100 border border-current"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
                    >
                        <span>{t('settings.language.timeFormatWarning.cancel')}</span>
                    </button>

                    <button
                        onClick={onSaveAndRestart}
                        className="flex-1 h-12 rounded-xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl"
                        style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-color)' }}
                    >
                        <span>{t('settings.language.timeFormatWarning.saveAndRestart')}</span>
                    </button>
                </div>

                {/* Decorative Pattern */}
                <div
                    className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-[0.03] pointer-events-none"
                    style={{ backgroundColor: 'var(--text-main)' }}
                />
            </div>
        </div>
    );
};

export default TimeFormatWarningModal;

import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TimeFormatWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndRestart: () => void;
}

const TimeFormatWarningModal: React.FC<TimeFormatWarningModalProps> = ({ isOpen, onClose, onSaveAndRestart }) => {
  const { t } = useI18n();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('settings.language.timeFormatWarning.title')}
          </DialogTitle>
          <DialogDescription>
            {t('settings.language.timeFormatWarning.description')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button variant="outline" onClick={onClose}>
            {t('settings.language.timeFormatWarning.cancel')}
          </Button>
          <Button onClick={onSaveAndRestart}>
            {t('settings.language.timeFormatWarning.saveAndRestart')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimeFormatWarningModal;

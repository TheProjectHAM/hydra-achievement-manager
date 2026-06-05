import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckIcon, XIcon } from 'lucide-react';
import { SteamIcon, HydraIcon } from './Icons';

interface TestResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: any | null;
}

const TestResultsModal: React.FC<TestResultsModalProps> = ({ isOpen, onClose, results }) => {
  if (!results) return null;

  const ResultItem = ({ title, data }: { title: string; data: any }) => (
    <div className="flex flex-col gap-1 py-2.5 border-b border-border last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-1.5 h-1.5 rounded-full ${data.success ? 'bg-emerald-500' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground opacity-80">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-muted-foreground opacity-50">{data.time}ms</span>
          {data.success ? (
            <CheckIcon className="size-3.5 text-emerald-500/80" />
          ) : (
            <XIcon className="size-3.5 text-rose-500/80" />
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connectivity Status</DialogTitle>
          <DialogDescription>
            Test results for Steam and Hydra API connectivity.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 opacity-40">
              <SteamIcon className="text-xs" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Steam</span>
            </div>
            <div className="bg-card rounded-xl border px-4">
              <ResultItem title="Backend" data={results.steam.backend} />
              <ResultItem title="Frontend" data={results.steam.frontend} />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 opacity-40">
              <HydraIcon className="text-xs" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Hydra</span>
            </div>
            <div className="bg-card rounded-xl border px-4">
              <ResultItem title="Backend" data={results.hydra.backend} />
              <ResultItem title="Frontend" data={results.hydra.frontend} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="default" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TestResultsModal;

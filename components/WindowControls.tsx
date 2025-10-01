import React from 'react';
import { CloseIcon, MinimizeIcon, MaximizeIcon } from './Icons';

const WindowControls: React.FC = () => {
  const handleMinimize = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.minimize();
    }
  };
  const handleMaximize = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.maximize();
    }
  };
  const handleClose = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.close();
    }
  };

  return (
    <div className="flex items-center h-full">
      <button onClick={handleMinimize} className="h-full px-4 text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150">
        <MinimizeIcon className="text-xl" />
      </button>
      <button onClick={handleMaximize} className="h-full px-4 text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150">
        <MaximizeIcon className="text-sm" />
      </button>
      <button onClick={handleClose} className="h-full px-4 text-gray-600 dark:text-gray-400 hover:bg-red-600 hover:text-white transition-colors duration-150">
        <CloseIcon className="text-xl" />
      </button>
    </div>
  );
};

export default WindowControls;

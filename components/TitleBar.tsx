import React, { useState, useEffect } from 'react';
import WindowControls from './WindowControls';

// FIX: Add WebkitAppRegion to React's CSSProperties type to allow setting it in style prop for Electron.
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
  }
}

const TitleBar: React.FC = () => {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // In a real Electron app, you'd use ipcRenderer to get the platform from the main process.
    setIsMac(typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform));
  }, []);

  const macControls = (
    <div className="flex items-center space-x-2">
      {/* Mac controls for completeness, though image is Windows */}
    </div>
  );

  return (
    <div
      className="h-10 bg-gray-100 dark:bg-black text-gray-800 dark:text-gray-200 flex items-center justify-between pl-4 pr-0 text-sm select-none fixed top-0 left-0 right-0 z-50 border-b border-black/10 dark:border-white/10"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left */}
      <div className="flex items-center">
        {!isMac && 
            <span className="font-semibold text-black dark:text-white">Project HAM</span>
        }
        {isMac && macControls}
      </div>
      
      {/* Right */}
      <div className="h-full" style={{ WebkitAppRegion: 'no-drag' }}>
        {!isMac && <WindowControls />}
      </div>
    </div>
  );
};

export default TitleBar;
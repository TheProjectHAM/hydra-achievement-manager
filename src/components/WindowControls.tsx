import React, { useState, useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { CloseIcon, MinimizeIcon, MaximizeIcon, RestoreIcon } from "./Icons";

const appWindow = getCurrentWebviewWindow();

const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Listen for resize/maximize changes natively
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlisten.then((u) => u());
    };
  }, []);

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = async () => {
    try {
      if (isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (e) {
      console.error("Failed to toggle maximize:", e);
    }
  };

  const handleClose = () => {
    appWindow.close();
  };

  const btnClass =
    "h-full px-5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)] transition-all duration-300 flex items-center justify-center";

  return (
    <div
      className="flex items-center h-full"
      onMouseDown={(e) => e.stopPropagation()} // Prevent dragging when clicking buttons
    >
      <button
        onClick={handleMinimize}
        className={btnClass}
        aria-label="Minimize"
      >
        <MinimizeIcon className="text-base" />
      </button>
      <button
        onClick={handleMaximize}
        className={btnClass}
        aria-label={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
          <RestoreIcon className="text-sm" />
        ) : (
          <MaximizeIcon className="text-sm" />
        )}
      </button>
      <button
        onClick={handleClose}
        className={`${btnClass} hover:bg-red-500 hover:text-white transition-colors`}
        aria-label="Close"
      >
        <CloseIcon className="text-base" />
      </button>
    </div>
  );
};

export default WindowControls;

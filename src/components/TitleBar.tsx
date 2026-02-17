import React from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import WindowControls from "./WindowControls";

const appWindow = getCurrentWebviewWindow();

const TitleBar: React.FC = () => {
  const handleDoubleClick = async () => {
    try {
      const maximized = await appWindow.isMaximized();
      if (maximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (e) {
      console.error("Failed to toggle maximize:", e);
    }
  };

  return (
    <div
      className="h-10 flex items-center justify-between pl-4 pr-0 text-sm select-none border-b cursor-default w-full shrink-0"
      style={{
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--border-color)",
      }}
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
    >
      {/* Left section - Branding (pointer-events-none makes it transparent to drag region) */}
      <div className="flex items-center pointer-events-none">
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: "var(--text-main)" }}
        >
          Project HAM
        </span>
      </div>

      {/* Right section - Controls */}
      <div className="h-full flex items-center">
        <WindowControls />
      </div>
    </div>
  );
};

export default TitleBar;

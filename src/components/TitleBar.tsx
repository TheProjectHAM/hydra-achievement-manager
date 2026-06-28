import React from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import WindowControls from "./WindowControls";
import { useTheme } from "../contexts/ThemeContext";

const TitleBar: React.FC = () => {
  const { titleBarMode } = useTheme();

  const handleDoubleClick = async () => {
    try {
      const appWindow = getCurrentWebviewWindow();
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

  if (titleBarMode !== "custom") return null;

  return (
    <div
      className="h-10 flex items-center justify-between pl-4 pr-0 text-sm select-none border-b border-sidebar-border cursor-default w-full shrink-0 bg-sidebar-background"
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-center pointer-events-none">
        <span className="font-sans text-[0.95rem] font-semibold text-sidebar-primary">
          Project HAM
        </span>
      </div>

      <div className="h-full flex items-center">
        <WindowControls />
      </div>
    </div>
  );
};

export default TitleBar;

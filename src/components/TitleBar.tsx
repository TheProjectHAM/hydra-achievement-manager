import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import WindowControls from "./WindowControls";

interface DecorationInfo {
  decorated: boolean;
  sessionType: string | null;
  currentDesktop: string | null;
  platform: string;
}

const TitleBar: React.FC = () => {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    invoke<DecorationInfo>("get_window_decoration_info")
      .then((info) => {
        const desktop = (info.currentDesktop ?? "").toLowerCase();
        const shouldHide = desktop.includes("hyprland") || desktop.includes("niri");
        setHidden(shouldHide);
      })
      .catch(() => setHidden(false));
  }, []);

  const handleDoubleClick = async () => {
    try {
      const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
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

  if (hidden) return null;

  return (
    <div
      className="h-10 flex items-center justify-between pl-4 pr-0 text-sm select-none border-b border-sidebar-border cursor-default w-full shrink-0 bg-sidebar-background"
      
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
    >
      {/* Left section - Branding (pointer-events-none makes it transparent to drag region) */}
      <div className="flex items-center pointer-events-none">
        <span className="text-[11px] font-semibold text-sidebar-primary-foreground">
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

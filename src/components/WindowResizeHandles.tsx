import React from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { ResizeDirection } from "@tauri-apps/api/window";
import { useTheme } from "../contexts/ThemeContext";

const appWindow = getCurrentWebviewWindow();

const WindowResizeHandles: React.FC = () => {
  const { titleBarMode } = useTheme();

  const startResize = (direction: ResizeDirection) => (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    appWindow.startResizeDragging(direction).catch((error) => {
      console.error("Failed to start window resize:", error);
    });
  };

  if (titleBarMode === "native") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <div className="pointer-events-auto absolute left-2 right-2 top-0 h-1 cursor-n-resize" onMouseDown={startResize("North")} />
      <div className="pointer-events-auto absolute bottom-0 left-2 right-2 h-1 cursor-s-resize" onMouseDown={startResize("South")} />
      <div className="pointer-events-auto absolute bottom-2 left-0 top-2 w-1 cursor-w-resize" onMouseDown={startResize("West")} />
      <div className="pointer-events-auto absolute bottom-2 right-0 top-2 w-1 cursor-e-resize" onMouseDown={startResize("East")} />

      <div className="pointer-events-auto absolute left-0 top-0 h-3 w-3 cursor-nw-resize" onMouseDown={startResize("NorthWest")} />
      <div className="pointer-events-auto absolute right-0 top-0 h-3 w-3 cursor-ne-resize" onMouseDown={startResize("NorthEast")} />
      <div className="pointer-events-auto absolute bottom-0 left-0 h-3 w-3 cursor-sw-resize" onMouseDown={startResize("SouthWest")} />
      <div className="pointer-events-auto absolute bottom-0 right-0 h-3 w-3 cursor-se-resize" onMouseDown={startResize("SouthEast")} />
    </div>
  );
};

export default WindowResizeHandles;

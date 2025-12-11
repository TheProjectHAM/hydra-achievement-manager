const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close: () => ipcRenderer.invoke('close-window'),
  onMaximizeChange: (callback: (maximized: boolean) => void) => {
    ipcRenderer.on('maximize-change', (_event, maximized) => callback(maximized));
  },
  onAchievementsUpdate: (callback: (games: any[]) => void) => {
    ipcRenderer.on('achievements-update', (_event, games) => callback(games));
  },
  requestAchievements: () => ipcRenderer.send('request-achievements'),
  getGameName: (gameId: string) => ipcRenderer.invoke('get-game-name', gameId),
  getGameNames: (gameIds: string[]) => ipcRenderer.invoke('get-game-names', gameIds),
  searchSteamGames: (query: string) => ipcRenderer.invoke('search-steam-games', query),
  getGameAchievements: (gameId: string) => ipcRenderer.invoke('get-game-achievements', gameId),
  reloadAchievements: (gameId: string, basePath: string) => ipcRenderer.invoke('reload-achievements', gameId, basePath),
  unlockAchievements: (options: any) => ipcRenderer.invoke('unlock-achievements', options),
  exportAchievements: (gameId: string) => ipcRenderer.invoke('export-achievements', gameId),
  onExportProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('export-progress', (_event, progress) => callback(progress));
  },
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
});


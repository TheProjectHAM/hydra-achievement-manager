const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const { API_CONFIG } = require('./config');

// URL da API Hydra do arquivo de configuração
const HYDRA_API_URL = API_CONFIG.HYDRA_API_URL;

contextBridge.exposeInMainWorld('api', {
  getAchievements: async (appId, apiKey) => {
    try {
      const response = await fetch(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=${appId}`);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.game || !data.game.availableGameStats || !data.game.availableGameStats.achievements) {
        throw new Error('Could not get achievements. Please check the app_id and try again.');
      }
      
      const achievementsMap = new Map();
      
      data.game.availableGameStats.achievements.forEach(achievement => {
        if (!achievementsMap.has(achievement.name)) {
          achievementsMap.set(achievement.name, {
            apiname: achievement.name,
            displayName: achievement.displayName,
            description: achievement.description || '',
            icon: achievement.icon || ''
          });
        }
      });
      
      const achievements = Array.from(achievementsMap.values());
      
      const unlockedAchievementsInfo = await ipcRenderer.invoke('get-unlocked-achievements', appId);
      
      const achievementsWithUnlockedStatus = achievements.map(achievement => {
        const unlockedInfo = unlockedAchievementsInfo.find(a => a.id === achievement.apiname);
        return {
          ...achievement,
          unlocked: !!unlockedInfo,
          unlockTime: unlockedInfo ? unlockedInfo.unlockTime : null
        };
      });
      
      return { success: true, achievements: achievementsWithUnlockedStatus };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
  
  getHydraAchievements: async (appId, language = 'pt') => {
    try {
      const url = `${HYDRA_API_URL}?shop=steam&objectId=${appId}&language=${language}`;
      console.log('Chamando API Hydra URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Resposta da API Hydra:', data);
      
      if (Array.isArray(data) && data.length > 0) {
        console.log('Exemplo das conquistas recebidas:');
        for (let i = 0; i < Math.min(3, data.length); i++) {
          console.log(`Conquista ${i} - Estrutura completa:`, JSON.stringify(data[i], null, 2));
          console.log(`Campos disponíveis: ${Object.keys(data[i]).join(', ')}`);
        }
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No achievements found for this game.');
      }
      
      console.log('Número de conquistas recebidas:', data.length);
      
      const achievements = [];
      
      data.forEach((achievement, index) => {
        console.log(`Processando conquista #${index}:`, achievement);
        
        const achievementId = achievement.name || achievement.id || `unknown_achievement_${index}`;
        
        const displayName = achievement.title || 
                           achievement.displayName || 
                           achievement.name || 
                           `Conquista ${index + 1}`;
        
        const description = achievement.description || 
                           achievement.desc || 
                           '';
        
        const icon = achievement.image || 
                    achievement.icon || 
                    achievement.img || 
                    '';
        
        if (!achievementId) {
          console.log('Conquista sem ID detectada:', achievement);
        }
        
        achievements.push({
          apiname: achievementId,
          displayName: displayName,
          description: description,
          icon: icon
        });
      });
      
      console.log('Conquistas processadas:', achievements);
      
      const unlockedAchievementsInfo = await ipcRenderer.invoke('get-unlocked-achievements', appId);
      
      const achievementsWithUnlockedStatus = achievements.map(achievement => {
        const unlockedInfo = unlockedAchievementsInfo.find(a => a.id === achievement.apiname);
        return {
          ...achievement,
          unlocked: !!unlockedInfo,
          unlockTime: unlockedInfo ? unlockedInfo.unlockTime : null
        };
      });
      
      console.log('Conquistas finais com status:', achievementsWithUnlockedStatus.length);
      return { success: true, achievements: achievementsWithUnlockedStatus };
    } catch (error) {
      console.error('Erro ao buscar conquistas da API Hydra:', error);
      return { success: false, message: error.message };
    }
  },
  
  writeAchievements: (appId, achievements, targetDirectory, options = {}) => {
    console.log("Preload: escrevendo achievements no diretório:", targetDirectory);
    console.log("Formato:", options.format);
    return ipcRenderer.invoke('write-achievements', appId, achievements, targetDirectory, options);
  },

  saveApiKey: (apiKey) => {
    return ipcRenderer.invoke('save-api-key', apiKey);
  },
  
  getApiKey: () => {
    return ipcRenderer.invoke('get-api-key');
  },

  saveSteamId: (steamId) => {
    return ipcRenderer.invoke('save-config', 'steamId', steamId);
  },
  
  getSteamId: () => {
    return ipcRenderer.invoke('get-config', 'steamId');
  },
  
  getConfig: (key) => {
    return ipcRenderer.invoke('get-config', key);
  },
  
  saveConfig: (key, value) => {
    return ipcRenderer.invoke('save-config', key, value);
  },
  
  getCurrentTimestamp: () => {
    return Math.floor(Date.now() / 1000);
  },

  getGameFolders: async (outputPath) => {
    return await ipcRenderer.invoke('get-game-folders', outputPath);
  },

  // i18n related functions
  getTranslation: (key, params = {}) => {
    return ipcRenderer.invoke('get-translation', key, params);
  },
  
  getCurrentLanguage: () => {
    return ipcRenderer.invoke('get-current-language');
  },
  
  getAvailableLanguages: () => {
    return ipcRenderer.invoke('get-available-languages');
  },
  
  setLanguage: (langCode) => {
    return ipcRenderer.invoke('set-language', langCode);
  },

  getOutputDirectories: () => {
    return ipcRenderer.invoke('get-output-directories');
  },
  
  checkGameFiles: (appId, directories) => {
    return ipcRenderer.invoke('check-game-files', appId, directories);
  },
  
  selectDirectory: () => {
    return ipcRenderer.invoke('select-directory');
  },
  
  getUnlockedAchievementsFromDirectory: (appId, directoryPath) => {
    return ipcRenderer.invoke('get-unlocked-achievements-from-directory', appId, directoryPath);
  },

  minimizeWindow: () => ipcRenderer.invoke('minimizeWindow'),
  closeWindow: () => ipcRenderer.invoke('closeWindow'),
  onExportProgress: (callback) => {
    ipcRenderer.on('export-progress', (event, data) => callback(data));
  }
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close: () => ipcRenderer.invoke('close-window'),
  isMaximized: () => ipcRenderer.invoke('is-window-maximized'),
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-changed', (event, state) => callback(state));
  }
});

contextBridge.exposeInMainWorld('electron', {
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  minimizeWindow: () => ipcRenderer.invoke('minimizeWindow'),
  closeWindow: () => ipcRenderer.invoke('closeWindow'),
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url)
});
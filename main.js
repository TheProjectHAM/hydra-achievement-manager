const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const i18n = require('./i18n');
const { API_CONFIG } = require('./config');
const axios = require('axios');
const sharp = require('sharp');

const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
const store = new Store();

let mainWindow;

// Função para criar a janela principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false,
    resizable: true,
    minWidth: 800,
    minHeight: 600
  });

  mainWindow.loadFile('index.html');
  setupWindowStateListeners(mainWindow);

  // DevTools em modo de desenvolvimento
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    console.log('DevTools aberto em modo de desenvolvimento');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('save-api-key', async (event, apiKey) => {
  try {
    store.set('steamApiKey', apiKey);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-api-key', () => {
  return store.get('steamApiKey');
});

ipcMain.handle('save-config', async (event, key, value) => {
  try {
    console.log(`Salvando configuração: ${key} = `, value);
    
    // Tratar outputPaths de forma especial
    if (key === 'outputPaths') {
      // Garantir que o valor é um array
      if (!Array.isArray(value)) {
        value = [value];
      }
      
      // Salvar dentro do objeto config
      const config = store.get('config') || {};
      config.outputPaths = value;
      store.set('config', config);
      
      console.log('Caminhos salvos em config.outputPaths:', value);
    } else {
      // Verificar se estamos lidando com uma chave dentro de config
      if (key.includes('.')) {
        store.set(key, value);
      } else {
        // Para outras chaves, salvar diretamente
        store.set(key, value);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Erro ao salvar configuração ${key}:`, error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-config', (event, key) => {
  // Se não for especificada uma chave, retorna toda a configuração
  if (!key) {
    const config = store.get('config') || {};
    // Garantir que outputPaths exista
    if (!config.outputPaths) {
      // Definir diretórios padrão baseado no sistema operacional
      let defaultPath;
      if (process.platform === 'linux') {
        const homeDir = require('os').homedir();
        defaultPath = `${homeDir}/.wine/drive_c/users/Public/Documents/Steam/RUNE`;
      } else {
        defaultPath = 'C:/Users/Public/Documents/Steam/RUNE';
      }
      
      config.outputPaths = [config.outputPath || defaultPath];
      config.activeOutputPath = config.outputPath || defaultPath;
      store.set('config', config);
    }
    return config;
  }
  
  // Se for 'outputPaths' e não existir, inicializa com o outputPath atual
  if (key === 'outputPaths') {
    const paths = store.get('outputPaths');
    if (!paths) {
      let defaultPath;
      if (process.platform === 'linux') {
        const homeDir = require('os').homedir();
        defaultPath = `${homeDir}/.wine/drive_c/users/Public/Documents/Steam/RUNE`;
      } else {
        defaultPath = 'C:/Users/Public/Documents/Steam/RUNE';
      }
      
      const currentPath = store.get('outputPath') || defaultPath;
      store.set('outputPaths', [currentPath]);
      return [currentPath];
    }
    return paths;
  }
  
  return store.get(key);
});

ipcMain.handle('write-achievements', async (event, appId, achievements, targetDirectory, options = {}) => {
  try {
    const config = store.get('config') || {};
    
    // Definir diretórios padrão baseado no sistema operacional
    let defaultPath;
    if (process.platform === 'linux') {
      const homeDir = require('os').homedir();
      defaultPath = `${homeDir}/.wine/drive_c/users/Public/Documents/Steam/RUNE`;
    } else {
      defaultPath = 'C:/Users/Public/Documents/Steam/RUNE';
    }
    
    const outputPaths = config.outputPaths || [config.outputPath || defaultPath];
    const outputPath = targetDirectory || config.activeOutputPath || outputPaths[0];
    
    console.log('Diretório alvo para salvar:', outputPath);
    console.log('AppID:', appId);
    console.log('Formato:', options.format);

    const downloadImage = async (url, filename, convertToGrayscale = false) => {
      try {
        if (!url) {
          console.log('URL de imagem vazia, pulando...');
          return false;
        }
    
        if (!url.startsWith('http')) {
          console.log('URL inválida:', url);
          return false;
        }
    
        console.log('Baixando imagem de:', url);
        console.log('Salvando em:', filename);
    
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
    
        if (convertToGrayscale) {
          // Processar a imagem para escala de cinza usando sharp
          await sharp(buffer)
            .grayscale() // Converter para escala de cinza
            .toFile(filename);
        } else {
          // Salvar imagem original sem modificações
          fs.writeFileSync(filename, buffer);
        }
    
        console.log('Imagem salva com sucesso');
        return true;
      } catch (error) {
        console.error('Erro ao baixar/processar imagem:', error);
        return false;
      }
    };

    if (options.format === 'json') {
      // Se for formato JSON, usar o diretório selecionado diretamente
      const gameDir = options.format === 'ini' ? path.join(outputPath, appId) : outputPath;
      const imagesDir = path.join(gameDir, 'images');
      
      // Criar diretórios se não existirem
      if (!fs.existsSync(gameDir)) {
        fs.mkdirSync(gameDir, { recursive: true });
      }
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // Baixar imagens para cada conquista
      const totalImages = achievements.length * 2; // Cada conquista tem 2 imagens (colorida e cinza)
      let processedImages = 0;

      for (const achievement of achievements) {
        const safeName = achievement.name.replace(/[^a-zA-Z0-9]/g, '_');
        const iconPath = path.join(imagesDir, `${safeName}.jpg`);
        const grayPath = path.join(imagesDir, `${safeName}_gray.jpg`);

        // Baixar imagem colorida
        if (achievement.icon) {
          await downloadImage(achievement.icon, iconPath, false);
          processedImages++;
          // Enviar progresso para o frontend
          event.sender.send('export-progress', {
            current: processedImages,
            total: totalImages,
            filename: `${safeName}.jpg`
          });
        }

        // Baixar e converter para escala de cinza
        if (achievement.icongray) {
          await downloadImage(achievement.icongray, grayPath, true);
          processedImages++;
          // Enviar progresso para o frontend
          event.sender.send('export-progress', {
            current: processedImages,
            total: totalImages,
            filename: `${safeName}_gray.jpg`
          });
        } else if (achievement.icon) {
          // Se não tiver imagem em escala de cinza, usar a colorida e converter
          await downloadImage(achievement.icon, grayPath, true);
          processedImages++;
          // Enviar progresso para o frontend
          event.sender.send('export-progress', {
            current: processedImages,
            total: totalImages,
            filename: `${safeName}_gray.jpg`
          });
        }

        // Atualizar os caminhos das imagens no objeto achievement para serem relativos
        achievement.icon = `images/${safeName}.jpg`;
        achievement.icongray = `images/${safeName}_gray.jpg`;
      }

      // Salvar arquivo JSON com os caminhos relativos das imagens
      const jsonPath = path.join(gameDir, 'achievements.json');
      fs.writeFileSync(jsonPath, JSON.stringify(achievements, null, 2));

      return { 
        success: true, 
        message: 'Arquivo achievements.json e imagens foram gerados com sucesso!' 
      };
    } else {
      // INI format - existing code
      let achievementsPath;
      if (outputPath.includes('OnlineFix')) {
        achievementsPath = path.join(outputPath, appId, 'Stats', 'achievements.ini');
      } else {
        achievementsPath = path.join(outputPath, appId, 'achievements.ini');
      }
      
      console.log('Caminho completo do arquivo:', achievementsPath);
      
      // Criar diretório se não existir
      const dir = path.dirname(achievementsPath);
      if (!fs.existsSync(dir)) {
        console.log('Criando diretório:', dir);
        try {
          fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
          console.log('Diretório criado com sucesso');
        } catch (mkdirError) {
          console.error('Erro ao criar diretório:', mkdirError);
          throw new Error(`Não foi possível criar o diretório: ${mkdirError.message}`);
        }
      }
      
      // Verificar se consegue escrever no diretório
      try {
        fs.accessSync(dir, fs.constants.W_OK);
        console.log('Diretório tem permissão de escrita');
      } catch (accessError) {
        console.error('Erro de permissão no diretório:', accessError);
        throw new Error(`Sem permissão para escrever no diretório: ${accessError.message}`);
      }
      
      // Mapa para armazenar conquistas e garantir que não haja duplicatas
      const achievementsMap = new Map();

      // Processar as conquistas selecionadas, garantindo unicidade por ID
      for (const achievement of achievements) {
        // Verificar se o achievement tem um ID válido
        if (!achievement.id || typeof achievement.id !== 'string') {
          console.warn('Achievement com ID inválido ignorado:', achievement);
          continue;
        }
        
        // Verificar se o unlockTime é válido
        if (!achievement.unlockTime || isNaN(achievement.unlockTime)) {
          console.warn(`Achievement ${achievement.id} com unlockTime inválido, usando timestamp atual`);
          achievement.unlockTime = Math.floor(Date.now() / 1000);
        }
        
        // Adicionar ao mapa (substitui se já existir com o mesmo ID)
        achievementsMap.set(achievement.id, achievement);
      }

      // Escrever arquivo de conquistas no formato INI - sem duplicatas
      let iniContent = '';
      for (const achievement of achievementsMap.values()) {
        iniContent += `[${achievement.id}]\n`;
        iniContent += `Achieved=1\n`;
        iniContent += `UnlockTime=${achievement.unlockTime}\n\n`;
      }
      
      console.log(`Gerando arquivo INI com ${achievementsMap.size} conquistas únicas`);

      console.log('Escrevendo arquivo:', achievementsPath);
      fs.writeFileSync(achievementsPath, iniContent);
      
      return { success: true, message: 'Arquivo achievements.ini foi gerado com sucesso!' };
    }
  } catch (error) {
    console.error('Erro ao salvar arquivo:', error);
    return { success: false, message: error.message };
  }
});

// Handler para obter todos os diretórios de saída configurados
ipcMain.handle('get-output-directories', async (event) => {
  try {
    console.log('Obtendo diretórios de configuração no processo principal...');
    
    let defaultDirectories;
    
    // Detectar sistema operacional e definir diretórios apropriados
    if (process.platform === 'linux') {
      // Diretórios para Linux usando Wine
      const homeDir = require('os').homedir();
      const winePrefix = `${homeDir}/.wine/drive_c`;
      
      defaultDirectories = [
        `${winePrefix}/users/Public/Documents/Steam/RUNE`,
        `${winePrefix}/users/Public/Documents/Steam/CODEX`,
        `${winePrefix}/ProgramData/Steam/RLD!`,
        `${winePrefix}/users/Public/Documents/OnlineFix`,
        `${winePrefix}/users/Public/Documents/Steam`
      ];
    } else {
      // Diretórios padrão para Windows
      defaultDirectories = [
        'C:/Users/Public/Documents/Steam/RUNE',
        'C:/Users/Public/Documents/Steam/CODEX',
        'C:/ProgramData/Steam/RLD!',
        'C:/Users/Public/Documents/OnlineFix',
        'C:/Users/Public/Documents/Steam'
      ];
    }
    
    // Salvar no store para futura referência
    store.set('config.outputPaths', defaultDirectories);
    
    // Se não houver um diretório ativo, definir o primeiro como ativo
    const activeOutputPath = store.get('config.activeOutputPath');
    if (!activeOutputPath || !defaultDirectories.includes(activeOutputPath)) {
      store.set('config.activeOutputPath', defaultDirectories[0]);
    }
    
    console.log(`Diretórios padrão para ${process.platform} retornados:`, defaultDirectories);
    return { success: true, directories: defaultDirectories };
  } catch (error) {
    console.error('Erro ao obter diretórios:', error);
    return { success: false, message: error.message };
  }
});

// Handler para verificar em quais diretórios o jogo já existe
ipcMain.handle('check-game-files', async (event, appId, directories) => {
  try {
    if (!appId) {
      return { success: false, message: 'ID do aplicativo não fornecido' };
    }
    
    if (!directories || !Array.isArray(directories) || directories.length === 0) {
      return { success: true, existingDirectories: [] };
    }
    
    const existingDirectories = [];
    
    for (const directory of directories) {
      // Caminho padrão
      const gamePath = path.join(directory, appId);
      const achievementsPath = path.join(gamePath, 'achievements.ini');
      
      // Caminho específico para OnlineFix (AppID/Stats/achievements.ini)
      const onlineFixPath = path.join(directory, appId, 'Stats', 'achievements.ini');
      
      // Verificar ambos os caminhos
      if (fs.existsSync(achievementsPath) || (directory.includes('OnlineFix') && fs.existsSync(onlineFixPath))) {
        existingDirectories.push(directory);
      }
    }
    
    return { success: true, existingDirectories };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-game-folders', async (event, outputPath) => {
  try {
    if (!fs.existsSync(outputPath)) {
      return { success: false, message: 'Diretório não encontrado.' };
    }

    const folders = fs.readdirSync(outputPath);
    const gamesMap = new Map(); // Usar um Map para garantir a unicidade

    for (const folder of folders) {
      // Ignorar pastas duplicadas ou inválidas
      if (!folder || gamesMap.has(folder)) continue;
      
      // Verificar o caminho de achievements.ini com base no diretório
      let achievementsPath;
      if (outputPath.includes('OnlineFix')) {
        // Caminho específico para OnlineFix
        achievementsPath = path.join(outputPath, folder, 'Stats', 'achievements.ini');
      } else {
        // Caminho padrão
        achievementsPath = path.join(outputPath, folder, 'achievements.ini');
      }
      
      if (fs.existsSync(achievementsPath)) {
        // Ler o conteúdo do arquivo INI para contar as conquistas
        try {
          const content = fs.readFileSync(achievementsPath, 'utf8');
          const achievementMatches = (content.match(/\[.*?\]/g) || []).filter(match => !!match.trim());
          
          // Identificar conquistas únicas
          const uniqueAchievementIds = new Set();
          for (const match of achievementMatches) {
            const id = match.replace(/[\[\]]/g, ''); // Remove colchetes
            if (id.trim()) {
              uniqueAchievementIds.add(id);
            }
          }
          
          gamesMap.set(folder, {
            id: folder,
            unlockedAchievements: uniqueAchievementIds.size // Usar o número de conquistas únicas
          });
        } catch (error) {
          console.error(`Erro ao ler o arquivo de conquistas para o jogo ${folder}:`, error);
          // Se houver erro na leitura do arquivo, ainda adiciona o jogo, mas com 0 conquistas
          gamesMap.set(folder, {
            id: folder,
            unlockedAchievements: 0
          });
        }
      }
    }

    // Converter o Map para um array de jogos
    const games = Array.from(gamesMap.values());

    return { success: true, games };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Window control handlers
ipcMain.handle('minimize-window', () => {
  mainWindow.minimize();
});

let isMaximizeInProgress = false;

ipcMain.handle('maximize-window', () => {
  if (isMaximizeInProgress) return;
  
  isMaximizeInProgress = true;
  console.log('Maximize window handler called');
  
  try {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  } finally {
    // Adicionar um pequeno atraso antes de permitir nova ação
    setTimeout(() => {
      isMaximizeInProgress = false;
    }, 300);
  }
});

ipcMain.handle('close-window', () => {
  mainWindow.close();
});

ipcMain.handle('is-window-maximized', () => {
  const isMaximized = mainWindow.isMaximized();
  console.log('Checking window maximized state:', isMaximized);
  return isMaximized;
});

// i18n handlers
ipcMain.handle('get-translation', async (event, key, params = {}) => {
  try {
    return i18n.getTranslation(key, params);
  } catch (error) {
    console.error(`Erro ao buscar tradução para "${key}":`, error);
    return key; // Retornar a chave como fallback em caso de erro
  }
});

ipcMain.handle('get-current-language', () => {
  return i18n.getCurrentLanguage();
});

ipcMain.handle('get-available-languages', () => {
  return i18n.getAvailableLanguages();
});

ipcMain.handle('set-language', async (event, langCode) => {
  try {
    const success = i18n.setLanguage(langCode);
    if (success) {
      store.set('language', langCode);
      return { success: true };
    }
    return { success: false, message: 'Idioma não disponível' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-unlocked-achievements', async (event, appId) => {
  try {
    const config = store.get('config') || {};
    
    // Definir diretórios padrão baseado no sistema operacional
    let defaultPath;
    if (process.platform === 'linux') {
      const homeDir = require('os').homedir();
      defaultPath = `${homeDir}/.wine/drive_c/users/Public/Documents/Steam/RUNE`;
    } else {
      defaultPath = 'C:/Users/Public/Documents/Steam/RUNE';
    }
    
    const outputPaths = config.outputPaths || [config.outputPath || defaultPath];
    const activeOutputPath = config.activeOutputPath || outputPaths[0];
    
    // Determinar o caminho correto com base no diretório ativo
    let achievementsPath;
    if (activeOutputPath.includes('OnlineFix')) {
      // Caminho específico para OnlineFix (AppID/Stats/achievements.ini)
      achievementsPath = path.join(activeOutputPath, appId, 'Stats', 'achievements.ini');
    } else {
      // Caminho padrão para outros diretórios
      achievementsPath = path.join(activeOutputPath, appId, 'achievements.ini');
    }
    
    // Se o arquivo não existe, retorna um array vazio
    if (!fs.existsSync(achievementsPath)) {
      return [];
    }
    
    // Ler o conteúdo do arquivo INI
    const content = fs.readFileSync(achievementsPath, 'utf8');
    
    // Parsear o arquivo INI para extrair as conquistas
    const achievementsMap = new Map(); // Usar um Map para evitar duplicatas
    const sections = content.split(/\n\s*\n/); // Dividir por linhas em branco para cada seção
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      const lines = section.split('\n');
      const idMatch = lines[0].match(/\[(.*?)\]/);
      
      if (idMatch) {
        const id = idMatch[1];
        const unlockTimeMatch = lines.find(line => line.includes('UnlockTime='))?.match(/UnlockTime=(\d+)/);
        const unlockTime = unlockTimeMatch ? parseInt(unlockTimeMatch[1]) : null;
        
        // Adicionar ao mapa (substitui se já existir com o mesmo ID)
        achievementsMap.set(id, {
          id,
          unlockTime
        });
      }
    }
    
    // Converter o Map para um array
    return Array.from(achievementsMap.values());
  } catch (error) {
    console.error('Erro ao ler o arquivo de conquistas:', error);
    return [];
  }
});

// Nova função para obter conquistas de um diretório específico
ipcMain.handle('get-unlocked-achievements-from-directory', async (event, appId, directoryPath) => {
  try {
    if (!directoryPath) {
      return { success: false, message: 'Caminho do diretório não fornecido' };
    }

    // Determinar o caminho correto com base no diretório fornecido
    let achievementsPath;
    if (directoryPath.includes('OnlineFix')) {
      // Caminho específico para OnlineFix (AppID/Stats/achievements.ini)
      achievementsPath = path.join(directoryPath, appId, 'Stats', 'achievements.ini');
    } else {
      // Caminho padrão para outros diretórios
      achievementsPath = path.join(directoryPath, appId, 'achievements.ini');
    }
    
    console.log(`Verificando arquivo de conquistas em: ${achievementsPath}`);
    
    // Se o arquivo não existe, retorna um array vazio
    if (!fs.existsSync(achievementsPath)) {
      return { success: true, achievements: [] };
    }
    
    // Ler o conteúdo do arquivo INI
    const content = fs.readFileSync(achievementsPath, 'utf8');
    
    // Parsear o arquivo INI para extrair as conquistas
    const achievementsMap = new Map(); // Usar um Map para evitar duplicatas
    const sections = content.split(/\n\s*\n/); // Dividir por linhas em branco para cada seção
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      const lines = section.split('\n');
      const idMatch = lines[0].match(/\[(.*?)\]/);
      
      if (idMatch) {
        const id = idMatch[1];
        const unlockTimeMatch = lines.find(line => line.includes('UnlockTime='))?.match(/UnlockTime=(\d+)/);
        const unlockTime = unlockTimeMatch ? parseInt(unlockTimeMatch[1]) : null;
        
        // Adicionar ao mapa (substitui se já existir com o mesmo ID)
        achievementsMap.set(id, {
          id,
          unlockTime
        });
      }
    }
    
    // Converter o Map para um array
    return { success: true, achievements: Array.from(achievementsMap.values()) };
  } catch (error) {
    console.error('Erro ao ler o arquivo de conquistas do diretório:', error);
    return { success: false, message: error.message };
  }
});

// Handler para selecionar um diretório
ipcMain.handle('select-directory', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    return { success: true, filePath: result.filePaths[0] };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Handler unificado para informações de atualização
ipcMain.handle('get-update-info', async () => {
  try {
    // Buscar dados de atualização do arquivo updates.json
    const response = await axios.get('https://raw.githubusercontent.com/Levynsk/hydra-achievement-manager/refs/heads/main/updates.json');
    const updateData = response.data;
    
    if (!updateData || !updateData.updates || !Array.isArray(updateData.updates)) {
      throw new Error('Formato de dados de atualização inválido');
    }
    
    // Obter a atualização mais recente (última no array)
    const latestUpdate = updateData.updates[updateData.updates.length - 1];
    
    if (!latestUpdate || !latestUpdate.version) {
      throw new Error('Nenhuma informação de versão válida encontrada');
    }
    
    const currentVersion = app.getVersion();
    
    return {
      success: true,
      currentVersion: currentVersion,
      remoteVersion: latestUpdate.version,
      downloadUrl: 'https://github.com/Levynsk/hydra-achievement-manager/releases/latest',
      changelog: latestUpdate.changelog || 'Nenhum changelog disponível',
      allUpdates: updateData.updates
    };
  } catch (error) {
    console.error('Erro ao obter informações de atualização:', error);
    return {
      success: false,
      error: error.message || 'Falha ao obter informações de atualização',
      currentVersion: app.getVersion()
    };
  }
});

ipcMain.handle('open-external-link', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Erro ao abrir link externo:', error);
    return { success: false, message: error.message };
  }
});

// Funções para controle da janela
ipcMain.handle('minimizeWindow', (event) => {
  BrowserWindow.fromWebContents(event.sender).minimize();
});

ipcMain.handle('closeWindow', (event) => {
  BrowserWindow.fromWebContents(event.sender).close();
});

// Adicionar listener para mudanças no estado da janela
function setupWindowStateListeners(window) {
  window.on('maximize', () => {
    console.log('Window maximized event fired');
    window.webContents.send('window-state-changed', { isMaximized: true });
  });
  
  window.on('unmaximize', () => {
    console.log('Window unmaximized event fired');
    window.webContents.send('window-state-changed', { isMaximized: false });
  });
}
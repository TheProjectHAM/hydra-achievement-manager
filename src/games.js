import { t } from './translations.js';
import { showError } from './settings.js';
import { fetchAchievements } from './achievements.js';
import { setCurrentGame } from './ui.js';

const gamesList = document.getElementById('gamesList');
const gamesSection = document.getElementById('gamesSection');

// Variável para controlar se já está carregando jogos
let isLoadingGames = false;

// Função para limpar a lista de jogos
export function clearGamesList() {
  if (gamesList) {
    gamesList.innerHTML = '';
    console.log('Lista de jogos limpa');
  }
}

// Função para verificar se um jogo existe em um determinado diretório
async function checkGameExistsInDirectory(gameId, directoryPath) {
  try {
    const result = await window.api.getGameFolders(directoryPath);
    if (!result.success) return false;
    
    // Verificar se o jogo existe na lista de jogos retornada
    return result.games.some(game => game.id === gameId);
  } catch (error) {
    console.error(`Erro ao verificar jogo ${gameId} no diretório ${directoryPath}:`, error);
    return false;
  }
}

export async function displayGameInfo(appId) {
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
    const data = await response.json();
    
    if (data[appId]?.success) {
      const gameData = data[appId].data;
      
      // Set game info in titlebar
      setCurrentGame({
        id: appId,
        name: gameData.name,
        image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`
      });

      const config = await window.api.getConfig();
      const outputPaths = config.outputPaths || [config.outputPath];
      const activeOutputPath = config.activeOutputPath || outputPaths[0];
      const result = await window.api.getGameFolders(activeOutputPath);
      
      const totalAchievements = gameData.achievements?.total || 0;
      
      let unlockedAchievements = 0;
      if (result.success) {
        const game = result.games.find(g => g.id === appId);
        if (game) {
          unlockedAchievements = game.unlockedAchievements;
        }
      }
      
      const appIdContainer = document.querySelector('.app-id-info');
      if (appIdContainer) {
        appIdContainer.innerHTML = `
          <p>${await t('achievements.appIdInfo')}</p>
          <div class="game-info-container">
            <img src="https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg" alt="${gameData.name}" class="game-header">
            <div class="game-details">
              <h3>${gameData.name}</h3>
              <div>
                <span>${unlockedAchievements}/${totalAchievements} ${await t('games.achievements')}</span>
                <span class="achievement-percentage">${(totalAchievements > 0 ? (unlockedAchievements / totalAchievements) * 100 : 0).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        `;
      }

      const appIdInput = document.getElementById('appId');
      if (appIdInput) {
        appIdInput.value = appId;
        await fetchAchievements();
      }
    }
  } catch (error) {
    console.error('Erro ao buscar informações do jogo:', error);
  }
}

export async function fetchGames() {
  const gamesList = document.getElementById('gamesList');
  if (!gamesList) return;
  
  // Evitar múltiplas chamadas simultâneas
  if (isLoadingGames) {
    console.log('Já está carregando jogos, solicitação ignorada');
    return;
  }
  
  // Definir estado de carregamento
  isLoadingGames = true;
  
  // Limpe a lista de jogos antes de carregar novamente
  clearGamesList();
  
  gamesList.innerHTML = `<div class="loading-content"><div class="loader"></div><p>${await t('games.loading')}</p></div>`;

  try {
    const config = await window.api.getConfig();
    const outputPaths = config.outputPaths || [config.outputPath];
    const activeOutputPath = config.activeOutputPath || outputPaths[0];

    if (!outputPaths.length) {
      throw new Error('O caminho de saída não está configurado.');
    }

    // Use um Map para garantir unicidade por ID do jogo
    const gamesMap = new Map();
    
    // Buscar jogos de todos os diretórios configurados
    for (const outputPath of outputPaths) {
      const result = await window.api.getGameFolders(outputPath);
      
      if (!result.success) {
        console.error(`Erro ao buscar jogos do diretório: ${outputPath}`);
        continue;
      }
      
      // Processar os jogos encontrados neste diretório
      for (const game of result.games) {
        // Verificar se o jogo tem um ID válido
        if (!game.id || typeof game.id !== 'string') {
          console.warn('Jogo com ID inválido ignorado:', game);
          continue;
        }
        
        // Se o jogo já existe no Map, apenas atualize se este for o diretório ativo
        if (gamesMap.has(game.id) && outputPath !== activeOutputPath) {
          console.log(`Jogo ${game.id} já existe no Map, mantendo versão do diretório ativo`);
          continue;
        }
        
        try {
          const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.id}`);
          const data = await response.json();
          
          let totalAchievements = 0;
          let gameName = game.id; // Fallback para o ID se não conseguir obter o nome
          
          if (data[game.id]?.success) {
            const gameData = data[game.id].data;
            totalAchievements = gameData.achievements?.total || 0;
            gameName = gameData.name || game.id;
          }
          
          // Se não conseguiu obter o total da Steam, tenta obter da API Hydra
          if (totalAchievements === 0) {
            try {
              const currentLang = await window.api.getCurrentLanguage();
              const langCode = currentLang.split('-')[0] || 'pt';
              const hydraResult = await window.api.getHydraAchievements(game.id, langCode);
              
              if (hydraResult.success && hydraResult.achievements) {
                totalAchievements = hydraResult.achievements.length;
              }
            } catch (hydraError) {
              console.warn(`Erro ao buscar conquistas da API Hydra para o jogo ${game.id}:`, hydraError);
            }
          }

          // Adicionar ou atualizar o jogo no Map
          gamesMap.set(game.id, {
            id: game.id,
            name: gameName,
            image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.id}/header.jpg`,
            achievements: {
              unlocked: game.unlockedAchievements || 0,
              total: totalAchievements,
            },
            sourcePath: outputPath
          });
        } catch (error) {
          console.error(`Erro ao buscar detalhes do jogo ${game.id}:`, error);
          // Mesmo com erro, adicionar o jogo com informações básicas
          gamesMap.set(game.id, {
            id: game.id,
            name: game.id,
            image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.id}/header.jpg`,
            achievements: {
              unlocked: game.unlockedAchievements || 0,
              total: 0,
            },
            sourcePath: outputPath
          });
        }
      }
    }
    
    console.log(`Processados ${gamesMap.size} jogos únicos de ${outputPaths.length} diretórios`);

    // Converter o Map em um array para exibição
    const games = Array.from(gamesMap.values());
    
    // Limpe o indicador de carregamento
    gamesList.innerHTML = '';
    
    if (games.length === 0) {
      gamesList.innerHTML = `<p class="no-games">${await t('games.noGames')}</p>`;
      return;
    }
    
    const selectText = await t('games.select');
    const achievementsText = await t('games.achievements');
    
    // Usando Promise.all para processar todos os jogos de forma assíncrona
    await Promise.all(games.map(async (game) => {
      const progress = game.achievements.total > 0 ? (game.achievements.unlocked / game.achievements.total) * 100 : 0;
      const isPlatinum = progress === 100 && game.achievements.total > 0;
      const gameCard = document.createElement('div');
      gameCard.className = 'game-card';
      gameCard.dataset.id = game.id;
      
      // Adiciona a classe 'platinum' se o jogo estiver 100% completo e tiver conquistas
      if (isPlatinum) {
        gameCard.classList.add('platinum');
      }
      
      // Texto da porcentagem com indicação de platina
      const percentageText = isPlatinum 
        ? `<span class="progress-percentage">${await t('achievements.platinum')} ✓</span>` 
        : `<span class="progress-percentage">${progress.toFixed(1)}%</span>`;
      
      // Obter os diretórios configurados
      const config = await window.api.getConfig();
      const outputPaths = config.outputPaths || [config.outputPath];
      const activeOutputPath = config.activeOutputPath || outputPaths[0];
      
      // Criar os botões de diretório
      let directoryButtons = '';
      if (outputPaths.length > 0) {
        directoryButtons = '<div class="game-directory-buttons">';
        
        // Primeiro, coletar todos os diretórios onde o jogo existe
        const gameDirectories = [];
        for (const path of outputPaths) {
          const gameExistsInDir = await checkGameExistsInDirectory(game.id, path);
          if (gameExistsInDir) {
            gameDirectories.push(path);
          }
        }
        
        // Loop para criar os botões apenas para diretórios onde o jogo existe
        for (let i = 0; i < gameDirectories.length; i++) {
          const path = gameDirectories[i];
          
          // Extrair o nome da última pasta do caminho
          const pathParts = path.split(/[\\\/]/);
          const dirName = pathParts[pathParts.length - 1];
          
          // Lógica para marcar como ativo:
          // 1. Se há apenas um diretório, marcar como ativo
          // 2. Se o diretório é o activeOutputPath, marcar como ativo
          // 3. Se o activeOutputPath não está na lista, marcar o primeiro como ativo
          let isActive = false;
          if (gameDirectories.length === 1) {
            isActive = true;
          } else if (path === activeOutputPath) {
            isActive = true;
          } else if (!gameDirectories.includes(activeOutputPath) && i === 0) {
            isActive = true;
          }
          
          directoryButtons += `
            <button class="game-directory-btn ${isActive ? 'active' : ''}" 
                    data-path="${path}" 
                    title="${path}">
              ${dirName}
            </button>`;
        }
        directoryButtons += '</div>';
      }
      
      gameCard.innerHTML = `
        <button class="game-select-btn" title="${selectText}">
          <i class="fas fa-plus"></i>
        </button>
        <img src="${game.image}" alt="${game.name}" onerror="this.src='assets/game-placeholder.jpg'">
        <div class="game-info">
        ${directoryButtons}
          <div class="game-title" title="${game.name}">${game.name}</div>
          <div class="game-achievements">
            <span><i class="fas fa-trophy"></i> ${game.achievements.unlocked}/${game.achievements.total} ${achievementsText}</span>
            ${percentageText}
          </div>
          <div class="progress-container">
            <div class="progress-bar" style="width: ${progress}%;">
              <div class="progress-bar-inner"></div>
            </div>
          </div>
        </div>
      `;

      // Evento de clique no botão de seleção
      gameCard.querySelector('.game-select-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Previne que o clique chegue ao card
        selectGame(game.id);
      });

      // Evento de clique no card inteiro
      gameCard.addEventListener('click', () => {
        selectGame(game.id);
      });
      
      // Adicionar eventos para os botões de diretório, se existirem
      const directoryButtonElements = gameCard.querySelectorAll('.game-directory-btn');
      directoryButtonElements.forEach(button => {
        button.addEventListener('click', async (e) => {
          e.stopPropagation(); // Previne que o clique chegue ao card
          const path = button.getAttribute('data-path');
          if (path) {
            // Atualizar o diretório ativo na configuração
            await window.api.saveConfig('activeOutputPath', path);
            
            // Atualizar visualmente os botões
            directoryButtonElements.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Atualizar apenas este jogo específico em vez de recarregar todos os jogos
            await updateGameCard(game.id, path);
          }
        });
      });

      gamesList.appendChild(gameCard);
    }));
  } catch (error) {
    const errorTemplate = await t('games.error', { message: error.message });
    gamesList.innerHTML = `<p class="error-message">${errorTemplate}</p>`;
  } finally {
    // Resetar o estado de carregamento quando terminar, independentemente do resultado
    isLoadingGames = false;
  }
}

// Função para selecionar um jogo e navegar para a tela de conquistas
async function selectGame(gameId) {
  try {
    // Get game info first
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${gameId}`);
    const data = await response.json();
    
    if (data[gameId]?.success) {
      const gameData = data[gameId].data;
      setCurrentGame({
        id: gameId,
        name: gameData.name,
        image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${gameId}/header.jpg`
      });
    }

    // Update button visuals
    const buttons = document.querySelectorAll('.game-select-btn');
    buttons.forEach(btn => {
      if (btn.closest('.game-card').dataset.id === gameId) {
        btn.classList.add('selected');
        btn.innerHTML = '<i class="fas fa-check"></i>';
      } else {
        btn.classList.remove('selected');
        btn.innerHTML = '<i class="fas fa-plus"></i>';
      }
    });
    
    // Navigate to achievements
    const appIdInput = document.getElementById('appId');
    if (appIdInput) {
      appIdInput.value = gameId;
      
      const achievementsLink = document.querySelector('.sidebar-nav a[href="#achievements"]');
      if (achievementsLink) {
        achievementsLink.click();
      }
      
      fetchAchievements();
    }
  } catch (error) {
    console.error('Error fetching game info:', error);
  }
}

// Função para atualizar apenas um card de jogo específico
async function updateGameCard(gameId, newPath) {
  try {
    // Buscar informações do jogo no novo diretório
    const result = await window.api.getGameFolders(newPath);
    if (!result.success) {
      console.error(`Erro ao buscar jogo ${gameId} no diretório: ${newPath}`);
      return;
    }
    
    // Encontrar o jogo nos resultados
    const gameData = result.games.find(game => game.id === gameId);
    if (!gameData) {
      console.error(`Jogo ${gameId} não encontrado no diretório: ${newPath}`);
      return;
    }
    
    // Buscar detalhes do jogo na API da Steam
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${gameId}`);
    const data = await response.json();
    
    if (!data[gameId]?.success) {
      console.error(`Erro ao buscar detalhes do jogo ${gameId} na API da Steam`);
      return;
    }
    
    const steamGameData = data[gameId].data;
    const totalAchievements = steamGameData.achievements?.total || 0;
    
    // Encontrar o card do jogo no DOM
    const gameCard = document.querySelector(`.game-card[data-id="${gameId}"]`);
    if (!gameCard) {
      console.error(`Card do jogo ${gameId} não encontrado no DOM`);
      return;
    }
    
    // Atualizar os dados de conquistas no card
    const progress = totalAchievements > 0 ? (gameData.unlockedAchievements / totalAchievements) * 100 : 0;
    const isPlatinum = progress === 100 && totalAchievements > 0;
    
    // Obter textos traduzidos
    const achievementsText = await t('games.achievements');
    const selectText = await t('games.select');
    
    // Texto da porcentagem com indicação de platina
    const percentageText = isPlatinum 
      ? `<span class="progress-percentage">${await t('achievements.platinum')} ✓</span>` 
      : `<span class="progress-percentage">${progress.toFixed(1)}%</span>`;
    
    // Atualizar a classe platinum se necessário
    if (isPlatinum) {
      gameCard.classList.add('platinum');
    } else {
      gameCard.classList.remove('platinum');
    }
    
    // Obter os diretórios configurados para criar os botões de diretório
    const config = await window.api.getConfig();
    const outputPaths = config.outputPaths || [config.outputPath];
    // Usar o novo caminho como diretório ativo em vez do padrão da configuração
    const activeOutputPath = newPath;
    
    // Criar os botões de diretório
    let directoryButtons = '';
    if (outputPaths.length > 0) {
      directoryButtons = '<div class="game-directory-buttons">';
      
      // Primeiro, coletar todos os diretórios onde o jogo existe
      const gameDirectories = [];
      for (const path of outputPaths) {
        const gameExistsInDir = await checkGameExistsInDirectory(gameId, path);
        if (gameExistsInDir) {
          gameDirectories.push(path);
        }
      }
      
      // Loop para criar os botões apenas para diretórios onde o jogo existe
      for (let i = 0; i < gameDirectories.length; i++) {
        const path = gameDirectories[i];
        
        // Extrair o nome da última pasta do caminho
        const pathParts = path.split(/[\\\/]/);
        const dirName = pathParts[pathParts.length - 1];
        
        // Lógica para marcar como ativo:
        // 1. Se há apenas um diretório, marcar como ativo
        // 2. Se o diretório é o activeOutputPath (newPath), marcar como ativo
        // 3. Se o activeOutputPath não está na lista, marcar o primeiro como ativo
        let isActive = false;
        if (gameDirectories.length === 1) {
          isActive = true;
        } else if (path === activeOutputPath) {
          isActive = true;
        } else if (!gameDirectories.includes(activeOutputPath) && i === 0) {
          isActive = true;
        }
        
        directoryButtons += `
          <button class="game-directory-btn ${isActive ? 'active' : ''}" 
                  data-path="${path}" 
                  title="${path}">
            ${dirName}
          </button>`;
      }
      directoryButtons += '</div>';
    }
    
    // Atualizar o conteúdo HTML do card
    gameCard.innerHTML = `
      <button class="game-select-btn" title="${selectText}">
        <i class="fas fa-plus"></i>
      </button>
      <img src="${steamGameData.header_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${gameId}/header.jpg`}" alt="${steamGameData.name}" onerror="this.src='assets/game-placeholder.jpg'">
      <div class="game-info">
        ${directoryButtons}
        <div class="game-title" title="${steamGameData.name}">${steamGameData.name}</div>
        <div class="game-achievements">
          <span><i class="fas fa-trophy"></i> ${gameData.unlockedAchievements}/${totalAchievements} ${achievementsText}</span>
          ${percentageText}
        </div>
        <div class="progress-container">
          <div class="progress-bar" style="width: ${progress}%;">
            <div class="progress-bar-inner"></div>
          </div>
        </div>
      </div>
    `;
    
    // Readicionar os event listeners
    // Evento de clique no botão de seleção
    gameCard.querySelector('.game-select-btn').addEventListener('click', (e) => {
      e.stopPropagation(); // Previne que o clique chegue ao card
      selectGame(gameId);
    });

    // Evento de clique no card inteiro
    gameCard.addEventListener('click', () => {
      selectGame(gameId);
    });
    
    // Adicionar eventos para os botões de diretório, se existirem
    const directoryButtonElements = gameCard.querySelectorAll('.game-directory-btn');
    directoryButtonElements.forEach(button => {
      button.addEventListener('click', async (e) => {
        e.stopPropagation(); // Previne que o clique chegue ao card
        const path = button.getAttribute('data-path');
        if (path) {
          // Atualizar o diretório ativo na configuração
          await window.api.saveConfig('activeOutputPath', path);
          
          // Atualizar visualmente os botões
          directoryButtonElements.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          
          // Atualizar apenas este jogo específico
          await updateGameCard(gameId, path);
        }
      });
    });
    
    console.log(`Card do jogo ${gameId} atualizado com sucesso para o diretório: ${newPath}`);
  } catch (error) {
    console.error(`Erro ao atualizar card do jogo ${gameId}:`, error);
  }
}

// Expor a função globalmente para os botões
window.displayGameInfo = displayGameInfo;
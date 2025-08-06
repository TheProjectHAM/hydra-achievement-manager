import {
  achievements as achievementsImport,
  selectedAchievements,
  userAchievements as userAchievementsImport,
  achievementsList,
  achievementsCard,
  loadingCard,
  errorCard,
  searchAchievementsInput,
  timestampTypeSelect,
  customTimestampInput,
  generateFileBtn,
  appIdInput,
  directoryModal,
  directoryList,
  cancelSaveBtn,
  confirmSaveBtn,
  loadDirectoryModal,
  loadDirectoryList,
  cancelLoadBtn,
  confirmLoadBtn
} from './constants.js';
import { t } from './translations.js';
import { showError, showSuccess } from './settings.js';
import { setCurrentGame } from './ui.js';

// Inicializar variável global para armazenar diretórios existentes
window.existingDirs = [];

// Variáveis locais que serão modificadas
let achievements = [];
let userAchievements = [];
let currentAppId = '';
let outputDirectories = [];
let selectedDirectoryPath = null; // Nova variável local para armazenar o diretório selecionado
let loadedDirectoryPath = null; // Nova variável para armazenar o diretório de onde as conquistas foram carregadas
let isSelectAll = false; // Add this variable to track toggle state
let selectedFormat = 'ini'; // Add this new variable at the top with the other state variables

export async function fetchAchievements() {
  const appId = appIdInput.value.trim();
  if (!appId) {
    await showError(await t('error.appIdRequired'));
    return;
  }

  currentAppId = appId;

  // Get game info from Steam API
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
    const data = await response.json();
    
    if (data[appId]?.success) {
      const gameData = data[appId].data;
      setCurrentGame({
        id: appId,
        name: gameData.name,
        image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`
      });
    }
  } catch (error) {
    console.error('Error fetching game info:', error);
  }

  // Limpar seleções anteriores ao mudar de jogo
  selectedAchievements.clear();
  
  // Primeiro, verificar se existem diretórios com arquivos de conquistas para este jogo
  await fetchOutputDirectories();
  await checkExistingGameFiles(appId);
  
  if (window.existingDirs && window.existingDirs.length > 0) {
    if (window.existingDirs.length === 1) {
      // Se houver apenas um diretório, usar diretamente
      loadedDirectoryPath = window.existingDirs[0];
      await fetchAchievementsFromDirectory();
    } else {
      // Se houver mais de um diretório, abrir modal para seleção
      await openLoadDirectoryModal();
    }
  } else {
    // Não existem arquivos de conquistas, prosseguir com a busca normal
    await fetchAchievementsFromAPI();
  }
}

// Nova função para abrir o modal de seleção de diretório ao carregar conquistas
async function openLoadDirectoryModal() {
  loadDirectoryModal.classList.remove('hidden');
  loadedDirectoryPath = null; // Resetar o diretório selecionado
  
  // Atualizar o título e a mensagem com as traduções
  const modalTitle = loadDirectoryModal.querySelector('.modal-header h3');
  if (modalTitle) {
    modalTitle.innerHTML = `<i class="fas fa-folder-open"></i> ${await t('loadModal.title')}`;
  }
  
  const modalMessage = loadDirectoryModal.querySelector('.modal-body > p');
  if (modalMessage) {
    modalMessage.textContent = await t('loadModal.message');
  }
  
  // Atualizar textos dos botões
  if (cancelLoadBtn) {
    cancelLoadBtn.textContent = await t('loadModal.cancel');
  }
  
  if (confirmLoadBtn) {
    confirmLoadBtn.textContent = await t('loadModal.load');
  }
  
  // Renderizar lista de diretórios disponíveis
  await renderLoadDirectoryList();
  
  // Configurar eventos
  cancelLoadBtn.onclick = () => {
    closeLoadDirectoryModal();
  };
  
  confirmLoadBtn.onclick = async () => {
    if (loadedDirectoryPath) {
      closeLoadDirectoryModal();
      await fetchAchievementsFromDirectory();
    }
  };
  
  // Fechar o modal ao clicar no X
  loadDirectoryModal.querySelector('.close-modal').onclick = () => {
    closeLoadDirectoryModal();
  };
}

// Função para renderizar a lista de diretórios disponíveis no modal de carregamento
async function renderLoadDirectoryList() {
  loadDirectoryList.innerHTML = '';
  
  // Adicionar cada diretório onde existem arquivos
  window.existingDirs.forEach(dir => {
    const directoryOption = document.createElement('div');
    directoryOption.className = 'directory-option';
    directoryOption.innerHTML = `
      <div class="directory-option-name">
        <i class="fas fa-folder"></i> ${dir}
      </div>
    `;
    directoryOption.addEventListener('click', () => {
      selectLoadDirectory(directoryOption, dir);
    });
    loadDirectoryList.appendChild(directoryOption);
  });
  
  // Selecionar primeiro diretório por padrão
  if (window.existingDirs.length > 0) {
    const firstOption = loadDirectoryList.querySelector('.directory-option:first-child');
    selectLoadDirectory(firstOption, window.existingDirs[0]);
  }
}

// Função para selecionar um diretório de carregamento
function selectLoadDirectory(directoryOption, directoryPath) {
  // Remover seleção anterior
  loadDirectoryList.querySelectorAll('.directory-option').forEach(option => {
    option.classList.remove('selected');
  });
  
  // Marcar como selecionado
  directoryOption.classList.add('selected');
  loadedDirectoryPath = directoryPath;
  
  // Habilitar botão de confirmar (sempre habilitado agora que não há opção nula)
  if (confirmLoadBtn) {
    confirmLoadBtn.disabled = false;
  }
}

// Função para fechar o modal de carregamento
function closeLoadDirectoryModal() {
  loadDirectoryModal.classList.add('hidden');
}

// Função para buscar conquistas do diretório selecionado
async function fetchAchievementsFromDirectory() {
  loadingCard.classList.remove('hidden');
  errorCard.classList.add('hidden');
  achievementsCard.classList.add('hidden');
  
  try {
    // Obter a fonte da API configurada
    const apiSource = await window.api.getConfig('apiSource') || 'hydra';
    
    let achievementsResult;
    
    if (apiSource === 'hydra') {
      // Usar API Hydra (não requer apiKey)
      const currentLang = await window.api.getCurrentLanguage();
      // Extrair o código de idioma principal (pt-BR -> pt)
      const langCode = currentLang.split('-')[0] || 'pt';
      
      achievementsResult = await window.api.getHydraAchievements(currentAppId, langCode);
    } else {
      // Usar API Steam (requer apiKey)
      const apiKey = await window.api.getApiKey();
      if (!apiKey) {
        throw new Error('API key não encontrada. Por favor, configure sua chave da API Steam nas configurações.');
      }
      
      achievementsResult = await window.api.getAchievements(currentAppId, apiKey);
    }
    
    if (!achievementsResult.success) {
      throw new Error(achievementsResult.message);
    }
    
    achievements = achievementsResult.achievements;
    
    // Buscar as conquistas salvas no diretório
    const result = await window.api.getUnlockedAchievementsFromDirectory(currentAppId, loadedDirectoryPath);
    if (result.success) {
      const unlockedAchievements = result.achievements;
      
      // Marcar conquistas como desbloqueadas
      achievements = achievements.map(achievement => {
        const unlocked = unlockedAchievements.find(a => a.id === achievement.apiname);
        return {
          ...achievement,
          unlocked: !!unlocked,
          unlockTime: unlocked ? unlocked.unlockTime : null
        };
      });
    }
    
    await renderAchievements();
    
    loadingCard.classList.add('hidden');
    achievementsCard.classList.remove('hidden');
  } catch (error) {
    loadingCard.classList.add('hidden');
    errorCard.classList.remove('hidden');
    await showError(error.message);
  }
}

// Nova função para buscar conquistas da API (separada da função principal)
async function fetchAchievementsFromAPI() {
  loadingCard.classList.remove('hidden');
  errorCard.classList.add('hidden');
  achievementsCard.classList.add('hidden');

  try {
    // Limpar o array de conquistas antes de receber novos dados
    achievements = [];
    userAchievements = [];
    
    // Obter a fonte da API configurada
    const apiSource = await window.api.getConfig('apiSource') || 'hydra';
    
    let achievementsResult;
    
    if (apiSource === 'hydra') {
      // Usar API Hydra (não requer apiKey)
      const currentLang = await window.api.getCurrentLanguage();
      // Extrair o código de idioma principal (pt-BR -> pt)
      const langCode = currentLang.split('-')[0] || 'pt';
      
      achievementsResult = await window.api.getHydraAchievements(currentAppId, langCode);
    } else {
      // Usar API Steam (requer apiKey)
      const apiKey = await window.api.getApiKey();
      if (!apiKey) {
        throw new Error('API key não encontrada. Por favor, configure sua chave da API Steam nas configurações.');
      }
      
      achievementsResult = await window.api.getAchievements(currentAppId, apiKey);
    }
    
    if (!achievementsResult.success) {
      throw new Error(achievementsResult.message);
    }
    
    achievements = achievementsResult.achievements;
    await renderAchievements();
    
    loadingCard.classList.add('hidden');
    achievementsCard.classList.remove('hidden');
  } catch (error) {
    loadingCard.classList.add('hidden');
    errorCard.classList.remove('hidden');
    await showError(error.message);
  }
}

export async function renderAchievements() {
  achievementsList.innerHTML = '';
  
  // Limpar seleções anteriores antes de renderizar novas conquistas
  selectedAchievements.clear();
  
  if (achievements.length === 0) {
    achievementsList.innerHTML = `<p class="no-achievements">${await t('achievements.noAchievements')}</p>`;
    return;
  }
  
  const selectText = await t('achievements.select');
  const alreadyUnlockedText = await t('achievements.alreadyUnlocked');
  const unlockedAtText = await t('achievements.unlockedAt');
  
  // Usar um Map para garantir que cada conquista seja única por apiname
  const uniqueAchievements = new Map();
  
  // Adicionar cada conquista ao Map, sobrescrevendo duplicatas
  achievements.forEach(achievement => {
    // Verificar se a conquista tem um apiname válido e não está vazia
    if (achievement.apiname && typeof achievement.apiname === 'string' && achievement.apiname.trim()) {
      // Se já existe uma conquista com o mesmo apiname, manter a que tem mais informações
      const existingAchievement = uniqueAchievements.get(achievement.apiname);
      if (!existingAchievement || 
          (achievement.displayName && !existingAchievement.displayName) ||
          (achievement.description && !existingAchievement.description)) {
        uniqueAchievements.set(achievement.apiname, achievement);
      }
    }
  });
  
  console.log(`Renderizando ${uniqueAchievements.size} conquistas únicas de ${achievements.length} conquistas totais`);
  
  // Renderizar apenas as conquistas únicas
  for (const achievement of uniqueAchievements.values()) {
    const achievementItem = document.createElement('div');
    achievementItem.className = 'achievement-item';
    achievementItem.dataset.id = achievement.apiname;
    
    if (achievement.unlocked) {
      achievementItem.classList.add('achieved');
    }
    
    const iconUrl = achievement.icon || 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/0/achievements_placeholder.jpg';
    
    const unlockTimeFormatted = achievement.unlockTime 
      ? new Date(achievement.unlockTime * 1000).toLocaleString() 
      : '';
    
    achievementItem.innerHTML = `
      <input type="checkbox" class="achievement-checkbox" id="achievement-${achievement.apiname}" ${achievement.unlocked ? 'checked' : ''}>
      <div class="achievement-content">
        <div class="achievement-header">
          <img src="${iconUrl}" alt="${achievement.displayName}" class="achievement-icon">
          <div class="achievement-info">
            <div class="achievement-name">${achievement.displayName}</div>
            <div class="achievement-description">${achievement.description || await t('achievements.noDescription')}</div>
          </div>
        </div>
        <div class="achievement-time">
          <i class="far fa-clock"></i>
          <input type="datetime-local" id="timestamp-${achievement.apiname}" class="timestamp-input" ${achievement.unlockTime ? `value="${formatDateForInput(achievement.unlockTime)}"` : ''}>
        </div>
      </div>
    `;
    
    achievementsList.appendChild(achievementItem);
    
    // Adicionar evento ao checkbox
    const checkbox = achievementItem.querySelector('.achievement-checkbox');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedAchievements.add(achievement.apiname);
        achievementItem.classList.add('achieved');
      } else {
        selectedAchievements.delete(achievement.apiname);
        achievementItem.classList.remove('achieved');
      }
      updateToggleButtonState();
      updateGenerateButtonState();
    });
    
    // Se a conquista já estiver desbloqueada, adicionar à seleção
    if (achievement.unlocked) {
      selectedAchievements.add(achievement.apiname);
    }
  }
  
  updateGenerateButtonState();
  setupAchievementCardListeners();
}

function formatDateForInput(timestamp) {
  const date = new Date(timestamp * 1000);
  // Ajustar para o fuso horário local
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localDate.toISOString().slice(0, 16);
}

export async function updateToggleButtonState() {
  const toggleBtn = document.getElementById('toggleSelection');
  const checkboxes = document.querySelectorAll('.achievement-checkbox');
  const totalCheckboxes = checkboxes.length;
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

  if (checkedCount > 0) {
    toggleBtn.classList.add('active');
    toggleBtn.innerHTML = `<i class="fa-solid fa-check-square"></i> ${await t('achievements.toggleSelect.deselect')}`;
    isSelectAll = true;
  } else {
    toggleBtn.classList.remove('active');
    toggleBtn.innerHTML = `<i class="fa-solid fa-square"></i> ${await t('achievements.toggleSelect.select')}`;
    isSelectAll = false;
  }
}

export async function toggleSelectAll() {
  const toggleBtn = document.getElementById('toggleSelection');
  const checkboxes = document.querySelectorAll('.achievement-checkbox');
  const someChecked = Array.from(checkboxes).some(cb => cb.checked);

  // If all or some achievements are checked, uncheck all
  if (someChecked) {
    toggleBtn.classList.remove('active');
    toggleBtn.innerHTML = `<i class="fa-solid fa-square"></i> ${await t('achievements.toggleSelect.select')}`;
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      const achievementItem = checkbox.closest('.achievement-item');
      const achievementId = achievementItem.dataset.id;
      selectedAchievements.delete(achievementId);
      achievementItem.classList.remove('achieved');
    });
  } else {
    // If none are checked, check all
    toggleBtn.classList.add('active');
    toggleBtn.innerHTML = `<i class="fa-solid fa-check-square"></i> ${await t('achievements.toggleSelect.deselect')}`;
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      const achievementItem = checkbox.closest('.achievement-item');
      const achievementId = achievementItem.dataset.id;
      selectedAchievements.add(achievementId);
      achievementItem.classList.add('achieved');
    });
  }
  
  updateGenerateButtonState();
}

export async function handleTimestampTypeChange() {
  const timestampType = timestampTypeSelect.value;
  const icons = {
    current: '<i class="fa-regular fa-clock"></i>',
    custom: '<i class="fa-regular fa-calendar"></i>',
    random: '<i class="fa-solid fa-shuffle"></i>'
  };

  // Get translated texts
  const currentText = await t('achievements.timestampCurrent');
  const customText = await t('achievements.timestampCustom');
  const randomText = await t('achievements.timestampRandom');
  
  // Update select content while preserving options
  timestampTypeSelect.innerHTML = `
    <option value="current">${icons.current} ${currentText}</option>
    <option value="custom">${icons.custom} ${customText}</option>
    <option value="random">${icons.random} ${randomText}</option>
  `;
  timestampTypeSelect.value = timestampType; // Restore selected value

  if (timestampType === 'custom') {
    customTimestampInput.classList.remove('hidden');
    customTimestampInput.disabled = false;
    // Set current datetime as default value if empty
    if (!customTimestampInput.value) {
      const now = new Date();
      const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
      customTimestampInput.value = localDate.toISOString().slice(0, 16);
    }
  } else {
    customTimestampInput.classList.add('hidden');
    customTimestampInput.disabled = true;
  }
}

export async function generateAchievementsFile() {
  try {
    const appId = appIdInput.value.trim();
    if (!appId) {
      await showError(await t('errors.invalidAppId'));
      return;
    }

    currentAppId = appId;
    
    // Abrir diretamente o modal - a busca de diretórios e verificação de arquivos
    // já é feita dentro do openDirectoryModal
    await openDirectoryModal();
  } catch (error) {
    await showError(error.message);
  }
}

// Função para buscar diretórios de saída salvos nas configurações
async function fetchOutputDirectories() {
  try {
    console.log('Buscando diretórios de saída...');
    const result = await window.api.getOutputDirectories();
    console.log('Resultado da busca de diretórios:', result);
    
    if (result.success) {
      outputDirectories = result.directories || [];
      console.log('Diretórios encontrados:', outputDirectories);
    } else {
      console.error('Erro ao buscar diretórios:', result.message);
      outputDirectories = [];
    }
    return outputDirectories;
  } catch (error) {
    console.error('Erro ao buscar diretórios de saída:', error);
    return [];
  }
}

// Função para verificar em quais diretórios o jogo já existe
async function checkExistingGameFiles(appId) {
  // Criar array local para armazenar os diretórios com arquivos existentes
  let existingDirs = [];
  
  if (outputDirectories.length === 0) {
    return;
  }
  
  try {
    const result = await window.api.checkGameFiles(appId, outputDirectories);
    if (result.success) {
      existingDirs = result.existingDirectories || [];
      
      // Atualizar a referência para existingDirectories no escopo global do módulo
      // Isso evita tentar atribuir diretamente à variável importada
      window.existingDirs = existingDirs;
    }
  } catch (error) {
    console.error('Erro ao verificar arquivos existentes:', error);
  }
}

// Abrir o modal de seleção de diretório
async function openDirectoryModal() {
  // Limpar seleção de diretório anterior
  selectedDirectoryPath = null;
  
  // Buscar diretórios novamente sempre que o modal for aberto
  console.log('Abrindo modal de seleção de diretório...');
  await fetchOutputDirectories();
  console.log('Diretórios carregados para o modal:', outputDirectories);
  
  // Verificar em quais diretórios o jogo já existe
  await checkExistingGameFiles(currentAppId);
  console.log('Diretórios onde o jogo existe:', window.existingDirs);
  
  // Forçar a leitura fresca da lista de diretórios do store
  // antes de renderizar a lista no modal
  await forcedDirectoryUpdate();
  
  // Atualizar o título e a mensagem com as traduções
  const modalTitle = directoryModal.querySelector('.modal-header h3');
  if (modalTitle) {
    modalTitle.innerHTML = `<i class="fas fa-folder-open"></i> ${await t('directories.selectTitle')}`;
  }
  
  const modalMessage = directoryModal.querySelector('.modal-body > p');
  if (modalMessage) {
    modalMessage.textContent = await t('directories.selectMessage');
  }
  
  // Atualizar textos dos botões
  if (cancelSaveBtn) {
    cancelSaveBtn.textContent = await t('directories.cancel');
  }
  
  if (confirmSaveBtn) {
    confirmSaveBtn.textContent = await t('directories.save');
  }
  
  await renderDirectoryList();
  directoryModal.classList.remove('hidden');
  
  // Adicionar eventos aos botões do modal
  cancelSaveBtn.addEventListener('click', closeDirectoryModal);
  confirmSaveBtn.addEventListener('click', saveAchievementsToSelectedDirectory);
  
  // Adicionar evento para fechar o modal ao clicar no X
  const closeButtons = directoryModal.querySelectorAll('.close-modal');
  closeButtons.forEach(btn => btn.addEventListener('click', closeDirectoryModal));

  // Add event listener for format selection
  const formatButtons = directoryModal.querySelectorAll('.format-button');
  formatButtons.forEach(button => {
    button.addEventListener('click', handleFormatChange);
  });

  // Reset format selection to default
  selectedFormat = 'ini';
  const defaultFormatButton = directoryModal.querySelector('.format-button[data-format="ini"]');
  if (defaultFormatButton) {
    defaultFormatButton.classList.add('active');
  }
}

// Função para forçar uma atualização da lista de diretórios
async function forcedDirectoryUpdate() {
  try {
    console.log('Forçando atualização da lista de diretórios...');
    // Buscar diretamente da configuração mais recente
    const config = await window.api.getConfig();
    console.log('Configuração obtida:', config);
    
    if (config && config.outputPaths && Array.isArray(config.outputPaths)) {
      outputDirectories = config.outputPaths;
      console.log('Diretórios atualizados forçadamente:', outputDirectories);
    } else {
      console.warn('Não foi possível encontrar outputPaths na configuração');
    }
  } catch (error) {
    console.error('Erro ao forçar atualização dos diretórios:', error);
  }
}

// Fechar o modal de seleção de diretório
function closeDirectoryModal(preserveSelection = false) {
  directoryModal.classList.add('hidden');
  
  // Remover os eventos para evitar múltiplos listeners
  cancelSaveBtn.removeEventListener('click', closeDirectoryModal);
  confirmSaveBtn.removeEventListener('click', saveAchievementsToSelectedDirectory);
  
  const closeButtons = directoryModal.querySelectorAll('.close-modal');
  closeButtons.forEach(btn => btn.removeEventListener('click', closeDirectoryModal));
  
  // Limpar a seleção de diretório apenas se não for para preservá-la
  if (!preserveSelection) {
    selectedDirectoryPath = null;
  }
}

// Renderizar lista de diretórios no modal
async function renderDirectoryList() {
  directoryList.innerHTML = '';
  
  // Adicionar botão para selecionar diretório personalizado
  const customDirButton = document.createElement('div');
  customDirButton.className = 'directory-option custom-dir-button';
  customDirButton.innerHTML = `
    <div class="directory-option-name">
      <i class="fas fa-plus-circle"></i>
      <span>${await t('directories.selectCustom')}</span>
    </div>
  `;
  
  customDirButton.addEventListener('click', async () => {
    const result = await window.api.selectDirectory();
    if (result.success && !result.canceled) {
      selectedDirectoryPath = result.filePath;
      
      // Remover seleção anterior
      const selectedOptions = directoryList.querySelectorAll('.directory-option.selected');
      selectedOptions.forEach(opt => opt.classList.remove('selected'));
      
      // Adicionar novo diretório à lista e selecioná-lo
      const newDirOption = document.createElement('div');
      newDirOption.className = 'directory-option selected';
      newDirOption.dataset.path = result.filePath;
      newDirOption.innerHTML = `
        <div class="directory-option-name">
          <i class="fas fa-folder"></i>
          <span title="${result.filePath}">${result.filePath}</span>
        </div>
      `;
      
      directoryList.insertBefore(newDirOption, customDirButton.nextSibling);
      confirmSaveBtn.disabled = false;
    }
  });
  
  directoryList.appendChild(customDirButton);
  
  if (outputDirectories.length === 0) {
    return;
  }
  
  // Obter antecipadamente a mensagem de tooltip para evitar await em função não-assíncrona
  const existingFilesMessage = await t('directories.existingFiles');
  
  // Criar um elemento para cada diretório
  outputDirectories.forEach((dir, index) => {
    const existingDirs = window.existingDirs || [];
    const isExisting = existingDirs.includes(dir);
    const directoryOption = document.createElement('div');
    directoryOption.className = 'directory-option';
    directoryOption.dataset.index = index;
    directoryOption.dataset.path = dir;
    
    const icon = isExisting ? 'fa-folder-open' : 'fa-folder';
    const tooltip = isExisting ? existingFilesMessage : '';
    
    directoryOption.innerHTML = `
      <div class="directory-option-name">
        <i class="fas ${icon}"></i>
        <span title="${dir}">${dir}</span>
      </div>
      ${isExisting ? '<i class="fas fa-check" style="color: var(--accent-success);"></i>' : ''}
    `;
    
    directoryOption.addEventListener('click', () => {
      selectDirectory(directoryOption);
    });
    
    directoryList.appendChild(directoryOption);
  });
  
  // Desabilitar botão de confirmar até que um diretório seja selecionado
  confirmSaveBtn.disabled = true;
}

// Selecionar um diretório da lista
function selectDirectory(directoryOption) {
  // Remover seleção anterior
  const selectedOptions = directoryList.querySelectorAll('.directory-option.selected');
  selectedOptions.forEach(opt => opt.classList.remove('selected'));
  
  // Selecionar o novo diretório
  directoryOption.classList.add('selected');
  
  // Salvar o diretório selecionado
  selectedDirectoryPath = directoryOption.dataset.path;
  console.log('Diretório selecionado:', selectedDirectoryPath);
  
  // Habilitar botão de confirmar
  confirmSaveBtn.disabled = false;
}

// Função para lidar com a mudança de formato
function handleFormatChange(event) {
  const buttons = directoryModal.querySelectorAll('.format-button');
  buttons.forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');
  selectedFormat = event.currentTarget.dataset.format;
}

// Salvar as conquistas no diretório selecionado
async function saveAchievementsToSelectedDirectory() {
  try {
    const appId = currentAppId;
    if (!appId) {
      throw new Error('ID do aplicativo não encontrado.');
    }
    
    if (!selectedDirectoryPath) {
      throw new Error('Nenhum diretório selecionado.');
    }
    
    // Se não houver conquistas selecionadas, criamos um array vazio para limpar o arquivo
    const achievementsData = [];
    
    // Só processar conquistas se houver alguma selecionada
    if (selectedAchievements.size > 0) {
      for (const achievementId of selectedAchievements) {
        const achievement = achievements.find(a => a.apiname === achievementId);
        if (!achievement) continue;

        const timestampInput = document.getElementById(`timestamp-${achievementId}`);
        let unlockTime;

        if (timestampInput && timestampInput.value) {
          unlockTime = Math.floor(new Date(timestampInput.value).getTime() / 1000);
        } else {
          const timestampType = timestampTypeSelect.value;
          switch (timestampType) {
            case 'custom':
              if (customTimestampInput.value) {
                unlockTime = Math.floor(new Date(customTimestampInput.value).getTime() / 1000);
              } else {
                unlockTime = Math.floor(Date.now() / 1000);
              }
              break;
            case 'random':
              const now = Math.floor(Date.now() / 1000);
              const oneYearAgo = now - (365 * 24 * 60 * 60);
              unlockTime = Math.floor(Math.random() * (now - oneYearAgo) + oneYearAgo);
              break;
            default:
              const currentDate = new Date();
              unlockTime = Math.floor(currentDate.getTime() / 1000);
          }
        }

        if (selectedFormat === 'ini') {
          achievementsData.push({
            id: achievementId,
            unlockTime
          });
        } else {
          // Format for JSON export
          achievementsData.push({
            name: achievementId,
            displayName: achievement.displayName,
            description: achievement.description || '',
            hidden: achievement.hidden || 0,
            icon: achievement.icon,
            icongray: achievement.icongray || achievement.icon,
            unlockTime
          });
        }
      }
    }
    
    // Guardar o diretório selecionado antes de fechar o modal
    const dirToSave = selectedDirectoryPath;
    
    // Fechar o modal antes de salvar para melhorar a experiência do usuário
    closeDirectoryModal(true);
    
    // Call the API with format information
    const result = await window.api.writeAchievements(appId, achievementsData, dirToSave, {
      format: selectedFormat,
      achievements: achievements // Pass full achievements data for image downloading
    });
    
    if (result.success) {
      const successMessage = document.getElementById('successMessage');
      const successModal = document.getElementById('successModal');
      if (successMessage && successModal) {
        // Get the appropriate file extension based on format
        const fileType = selectedFormat === 'ini' ? 'achievements.ini' : 'achievements.json';
        // Use the translation with parameters
        successMessage.textContent = await t('success.fileGenerated', { 
          fileType,
          path: dirToSave
        });
        successModal.classList.remove('hidden');
      }
    } else {
      throw new Error(result.message || await t('errors.writeError'));
    }
  } catch (error) {
    await showError(error.message);
  }
}

export function updateGenerateButtonState() {
  // Remover a desabilitação do botão baseada na quantidade de conquistas selecionadas
  // O botão deve estar sempre habilitado para permitir a geração do INI
  generateFileBtn.disabled = false;
  generateFileBtn.classList.remove('btn-disabled');
}

export function filterAchievements() {
  const searchTerm = searchAchievementsInput.value.toLowerCase();
  const achievementItems = document.querySelectorAll('.achievement-item');

  achievementItems.forEach(item => {
    const achievementName = item.querySelector('.achievement-name').textContent.toLowerCase();
    if (achievementName.includes(searchTerm)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

export function setupAchievementCardListeners() {
  const expandButtons = document.querySelectorAll('.expand-card-btn');
  expandButtons.forEach(button => {
    button.addEventListener('click', () => {
      const card = button.closest('.achievement-item');
      const options = card.querySelector('.custom-timestamp-options');
      options.classList.toggle('hidden');
    });
  });

  const enableCustomTimestampCheckboxes = document.querySelectorAll('.enable-custom-timestamp');
  enableCustomTimestampCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const input = e.target.closest('.custom-timestamp-options').querySelector('.custom-timestamp-input');
      input.disabled = !e.target.checked;
      input.classList.toggle('hidden', !e.target.checked);
    });
  });

  // Adicionar evento de clique nos ícones de relógio
  const clockIcons = document.querySelectorAll('.achievement-time .far.fa-clock');
  clockIcons.forEach(icon => {
    icon.style.cursor = 'pointer';
    icon.title = 'Clique para limpar o timestamp';
    icon.addEventListener('click', (e) => {
      const timeInput = e.target.closest('.achievement-time').querySelector('input[type="datetime-local"]');
      if (timeInput) {
        timeInput.value = '';
      }
    });
  });
}

// New export function
export async function exportAllAchievements() {
  try {
    const appId = appIdInput.value.trim();
    if (!appId) {
      await showError(await t('errors.appIdRequired'));
      return;
    }

    // Show progress modal
    const progressModal = document.getElementById('progressModal');
    const progressBar = document.getElementById('exportProgress');
    const progressMessage = document.getElementById('progressMessage');
    progressModal.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressMessage.textContent = await t('achievements.selectingDirectory');

    // Open directory selection dialog
    const result = await window.api.selectDirectory();
    if (!result.success || result.canceled) {
      progressModal.classList.add('hidden');
      return;
    }

    const exportDir = result.filePath;
    progressBar.style.width = '30%';
    progressMessage.textContent = await t('achievements.preparingExport');

    // Format all achievements for export with proper required fields
    const formattedAchievements = achievements.map(achievement => ({
      name: achievement.apiname || achievement.name || achievement.id,  // Ensure we have a name property
      displayName: achievement.displayName || achievement.name || '',
      description: achievement.description || '',
      hidden: achievement.hidden || 0,
      icon: achievement.icon || '',
      icongray: achievement.icongray || achievement.icon || '',
    }));

    progressBar.style.width = '50%';
    progressMessage.textContent = await t('achievements.exporting');

    // Configurar listener para atualizações de progresso
    window.api.onExportProgress(async (data) => {
      const progress = (data.current / data.total) * 100;
      progressBar.style.width = `${progress}%`;
      progressMessage.textContent = await t('achievements.downloadingImage', {
        filename: data.filename,
        current: data.current,
        total: data.total
      });
    });

    // Write achievements and download images
    const result2 = await window.api.writeAchievements(appId, formattedAchievements, exportDir, {
      format: 'json',
      achievements: formattedAchievements
    });

    if (result2.success) {
      progressBar.style.width = '100%';
      progressMessage.textContent = await t('success.exportComplete');
      
      // Add fade-out class before hiding
      progressModal.classList.add('fade-out');
      
      // Hide progress modal after animation completes
      setTimeout(async () => {
        progressModal.classList.remove('fade-out');
        progressModal.classList.add('hidden');
        await showSuccess(await t('success.exportComplete'));
      }, 1000);
    } else {
      throw new Error(result2.message || await t('errors.exportError'));
    }
  } catch (error) {
    const progressModal = document.getElementById('progressModal');
    progressModal.classList.add('hidden');
    await showError(error.message);
  }
}

// Update the event listeners setup
export function setupEventListeners() {
  exportDataBtn.addEventListener('click', exportAllAchievements);
  generateFileBtn.addEventListener('click', generateAchievementsFile);
}
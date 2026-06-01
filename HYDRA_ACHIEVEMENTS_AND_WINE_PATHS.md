# Hydra Launcher - Sistema de Conquistas e Gerenciamento de Wine Paths

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Ciclo de Detecção de Conquistas](#2-ciclo-de-detecção-de-conquistas)
3. [Sistema de Watcher de Conquistas](#3-sistema-de-watcher-de-conquistas)
4. [Localização de Arquivos de Conquista por Cracker](#4-localização-de-arquivos-de-conquista-por-cracker)
5. [Parsing dos Arquivos de Conquista](#5-parsing-dos-arquivos-de-conquista)
6. [Merge e Sincronização de Conquistas](#6-merge-e-sincronização-de-conquistas)
7. [Persistência via LevelDB](#7-persistência-via-leveldb)
8. [Notificações de Conquista](#8-notificações-de-conquista)
9. [Gerenciamento de Wine/Proton Paths](#9-gerenciamento-de-wineproton-paths)
10. [Fluxo de Lançamento de Jogo com Wine](#10-fluxo-de-lançamento-de-jogo-com-wine)
11. [Detecção de Conquistas no Linux (Wine)](#11-detecção-de-conquistas-no-linux-wine)
12. [Process Watcher e Wine Prefix Map](#12-process-watcher-e-wine-prefix-map)
13. [Diagrama de Fluxo Completo](#13-diagrama-de-fluxo-completo)

---

## 1. Visão Geral da Arquitetura

O sistema de conquistas do Hydra é composto por 5 módulos principais no diretório `src/main/services/achievements/`:

| Arquivo | Responsabilidade |
|---|---|
| `achievement-watcher-manager.ts` | Orquestrador central - gerencia o ciclo de polling, pré-busca e coordena a detecção |
| `find-achivement-files.ts` | Localização física dos arquivos de conquista no disco (Windows e Wine) |
| `parse-achievement-file.ts` | Parsing de cada formato de arquivo específico de cada cracker |
| `merge-achievements.ts` | Merge das conquistas locais com dados remotos, persistência e notificações |
| `get-game-achievement-data.ts` | Busca metadados das conquistas (nomes, ícones, descrições) via API Hydra |

**Fluxo resumido:**
```
Main Loop (2s) → AchievementWatcherManager.watchAchievements()
  → findAchievementFiles() / findAllAchievementFiles()
    → compareFile() [detecta mudanças via mtimeMs ou diff de diretório]
      → parseAchievementFile() [converte formato do cracker para UnlockedAchievement[]]
        → mergeAchievements() [deduplica, persiste, notifica, sincroniza com API]
```

---

## 2. Ciclo de Detecção de Conquistas

O ciclo principal é iniciado em `src/main/services/main-loop.ts:31-34`:

```typescript
wrapInLoop(
  () => AchievementWatcherManager.watchAchievements(),
  INTERVALS.achievementWatcher  // 2000ms (2 segundos)
);
```

A cada **2 segundos**, o `watchAchievements()` é chamado. Ele delega para a função correta baseada na plataforma:

```typescript
public static watchAchievements() {
  if (!this.hasFinishedPreSearch) return;  // Aguarda a pré-busca inicial
  if (process.platform === "win32") {
    return watchAchievementsWindows();
  }
  return watchAchievementsWithWine();  // Linux/macOS
}
```

### Pré-busca (Pre-Search)

Antes do polling contínuo começar, é executada uma pré-busca em `preSearchAchievements()` (chamada na inicialização do app). Ela:

1. Coleta todos os jogos não-deletados do LevelDB
2. Para cada jogo, encontra todos os arquivos de conquista
3. Faz o parse e merge inicial
4. Envia uma notificação combinada se houver conquistas novas
5. Marca `_hasFinishedPreSearch = true` para liberar o polling contínuo

---

## 3. Sistema de Watcher de Conquistas

### `watchAchievementsWindows()` (`achievement-watcher-manager.ts:29-67`)

No Windows, usa uma abordagem de **scan global**:

1. Chama `findAllAchievementFiles()` que escaneia **todos os diretórios de crackers** de uma vez
2. Retorna um `Map<string, AchievementFile[]>` mapeando `objectId` → arquivos encontrados
3. Para cada jogo, busca os arquivos por `objectId` (incluindo IDs alternativos)
4. Também busca no diretório do executável e no path do Steam (se habilitado)
5. Compara cada arquivo com o estado anterior via `compareFile()`

### `watchAchievementsWithWine()` (`achievement-watcher-manager.ts:69-103`)

No Linux, usa uma abordagem **por jogo**:

1. Filtra jogos que possuem um Wine Prefix efetivo (via `Wine.getEffectivePrefixPath()`)
2. Para cada jogo, chama `findAchievementFiles(game)` que busca nos paths do Wine prefix
3. Também busca no path do Steam se habilitado
4. Compara cada arquivo com o estado anterior

### Detecção de Mudanças (`compareFile()`)

Existem dois mecanismos de detecção:

**Para arquivos normais (todos os crackers exceto FLT):**
- Usa `fs.statSync(filePath).mtimeMs` (timestamp de modificação)
- Armazena o timestamp anterior em `fileStats: Map<string, number>`
- Se o timestamp mudou → arquivo foi modificado → faz parse e merge

**Para FLT (pasta de stats):**
- Usa `fs.readdirSync(filePath)` para listar arquivos na pasta
- Armazena o conjunto anterior em `fltFiles: Map<string, Set<string>>`
- Compara com `Set.difference()` para detectar novos arquivos

---

## 4. Localização de Arquivos de Conquista por Cracker

### Paths base (variáveis de sistema)

Antes de listar os paths, é importante entender as variáveis de sistema resolvidas em `find-achivement-files.ts:10-61`:

| Variável | Windows | Linux (Wine) |
|---|---|---|
| `appData` | `%APPDATA%` (via `SystemPath.getPath("appData")`) | `<winePrefix>/drive_c/users/<user>/AppData/Roaming` |
| `documents` | `%DOCUMENTS%` (via `SystemPath.getPath("documents")`) | `<winePrefix>/drive_c/users/<user>/Documents` |
| `publicDocuments` | `C:\Users\Public\Documents` | `<winePrefix>/drive_c/users/Public/Documents` |
| `localAppData` | `%LOCALAPPDATA%` | `<winePrefix>/drive_c/users/<user>/AppData/Local` |
| `programData` | `C:\ProgramData` | `<winePrefix>/drive_c/ProgramData` |

Onde `<user>` é extraído de `SystemPath.getPath("home").split("/").pop()`.

### Tabela completa de paths por cracker

#### CODEX
```
<publicDocuments>/Steam/CODEX/<objectId>/achievements.ini
<appData>/Steam/CODEX/<objectId>/achievements.ini
```
**Formato:** INI | **Parser:** `processDefault` (chave `Achieved == "1"`, `UnlockTime`)

#### RUNE
```
<publicDocuments>/Steam/RUNE/<objectId>/achievements.ini
```
**Formato:** INI | **Parser:** `processDefault`

#### OnlineFix
```
<publicDocuments>/OnlineFix/<objectId>/Stats/Achievements.ini
<publicDocuments>/OnlineFix/<objectId>/Achievements.ini
```
**Formato:** INI | **Parser:** `processOnlineFix` (chaves `achieved == "true"` ou `Achieved == "true"`)

#### Goldberg
```
<appData>/Goldberg SteamEmu Saves/<objectId>/achievements.json
<appData>/GSE Saves/<objectId>/achievements.json
```
**Formato:** JSON | **Parser:** `processGoldberg` (chave `earned: true`, `earned_time`)

#### RLD!
```
<programData>/RLD!/<objectId>/achievements.ini
<programData>/Steam/Player/<objectId>/stats/achievements.ini
<programData>/Steam/RLD!/<objectId>/stats/achievements.ini
<programData>/Steam/dodi/<objectId>/stats/achievements.ini
```
**Formato:** INI | **Parser:** `processRld` (decodifica `State` e `Time` de hex para uint32 little-endian)

#### EMPRESS
```
<appData>/EMPRESS/remote/<objectId>/achievements.json
<publicDocuments>/EMPRESS/remote/<objectId>/<objectId>/achievements.json
```
**Formato:** JSON | **Parser:** `processGoldberg` (mesmo formato do Goldberg)

#### SKIDROW
```
<documents>/SKIDROW/<objectId>/SteamEmu/UserStats/achiev.ini
<documents>/Player/<objectId>/SteamEmu/UserStats/achiev.ini
<localAppData>/SKIDROW/<objectId>/SteamEmu/UserStats/achiev.ini
```
**Formato:** INI | **Parser:** `processSkidrow` (seção `[Achievements]`, formato `1@<unlockTime>@<nome>`)

#### CreamAPI
```
<appData>/CreamAPI/<objectId>/stats/CreamAPI.Achievements.cfg
```
**Formato:** INI | **Parser:** `processCreamAPI` (chave `achieved == "true"`, `unlocktime`)

#### SmartSteamEmu
```
<appData>/SmartSteamEmu/<objectId>/User/Achievements.ini
```
**Formato:** INI | **Parser:** `processDefault`

#### RLE
```
<appData>/RLE/<objectId>/achievements.ini
<appData>/RLE/<objectId>/Achievements.ini
```
**Formato:** INI | **Parser:** `processDefault`

#### Razor1911
```
<appData>/.1911/<objectId>/achievement
```
**Formato:** Texto plano (linhas: `<nome> <unlocked(0|1)> <unlockTime>`) | **Parser:** `processRazor1911`

#### user_stats (diretório do executável)
```
<executablePath>/../SteamData/user_stats.ini
```
**Formato:** INI | **Parser:** `processUserStats` (seção `[ACHIEVEMENTS]`, formato `"<nome>" = "{unlocked = true, time = <timestamp>}"`)

#### 3DM (diretório do executável)
```
<executablePath>/../3DMGAME/Player/stats/achievements.ini
```
**Formato:** INI | **Parser:** `process3DM` (seções `[State]` e `[Time]`, valores em hex)

#### FLT
```
<appData>/FLT/stats/  (COMENTADO NO CÓDIGO - não é buscado automaticamente)
```
**Formato:** Diretório com arquivos (cada arquivo = uma conquista) | **Parser:** `readdirSync` (nome do arquivo = nome da conquista)

#### Steam (cache do cliente)
```
<steamPath>/userdata/<steamUserId>/config/librarycache/<objectId>.json
```
**Formato:** JSON (array) | **Parser:** `processSteamCacheAchievement` (busca por `vecHighlight`, chave `bAchieved`)

### Busca no Diretório do Executável (`findAchievementFileInExecutableDirectory`)

Sempre busca dois paths relativos ao executivo do jogo:

```
<effectiveWinePrefix>/<executablePath>/../SteamData/user_stats.ini     [tipo: userstats]
<effectiveWinePrefix>/<executablePath>/../3DMGAME/Player/stats/achievements.ini  [tipo: 3dm]
```

### IDs Alternativos (`getAlternativeObjectIds`)

Para certos jogos, o `objectId` pode ter aliases. Exemplo implementado:

```typescript
// Dishonored
if (objectId === "205100") return ["205100", "217980", "31292"];
```

Isso permite que arquivos de conquista salvos com IDs diferentes sejam encontrados.

---

## 5. Parsing dos Arquivos de Conquista

O parser central (`parse-achievement-file.ts`) recebe um `filePath` e um `type: Cracker`, e retorna `UnlockedAchievement[]`.

### Tipos de parser

| Parser | Crackers | Formato |
|---|---|---|
| `processDefault` | CODEX, RUNE, RLE, SmartSteamEmu | INI: `Achieved == "1"`, `UnlockTime` em segundos |
| `processOnlineFix` | OnlineFix | INI: `achieved == "true"` ou `Achieved == "true"`, `timestamp` ou `TimeUnlocked` |
| `processGoldberg` | Goldberg, EMPRESS | JSON: `earned: true`, `earned_time` em segundos (suporta array e objeto) |
| `processRld` | RLD! | INI: `State` e `Time` em hexadecimal, decodificado como uint32 LE |
| `processSkidrow` | SKIDROW | INI: seção `[Achievements]`, formato `1@<time>@<name>` |
| `processCreamAPI` | CreamAPI | INI: `achieved == "true"`, `unlocktime` |
| `processUserStats` | user_stats | INI: seção `[ACHIEVEMENTS]`, formato `"{unlocked = true, time = <ts>}"` |
| `process3DM` | 3DM | INI: seções `[State]` (valor `0101` = desbloqueado) e `[Time]` (hex) |
| `processRazor1911` | Razor1911 | Texto plano: `<name> <0|1> <unlockTime>` separado por espaços |
| `processSteamCacheAchievement` | Steam | JSON array: `bAchieved`, `strID`, `rtUnlocked` |

### Parsing INI customizado

O parser INI (`iniParse`) é implementado manualmente (não usa biblioteca externa):
- Remove BOM (0xFEFF) se presente
- Ignora linhas começando com `###`
- Seções: `[NomeSeção]`
- Chaves: `chave=valor`

### Parsing JSON

Usa `JSON.parse()` nativo. Para Goldberg/EMPRESS, suporta tanto formato de array quanto de objeto.

---

## 6. Merge e Sincronização de Conquistas

O `mergeAchievements()` (`merge-achievements.ts:56-226`) é o coração do sistema:

### Fluxo do merge

1. **Busca dados locais** do LevelDB (`gameAchievementsSublevel`)
2. **Busca metadados** da API Hydra se não existirem cacheados (`getGameAchievementData()`)
3. **Deduplica** conquistas novas (normaliza nomes para uppercase, usa `Map` para sobrescrever duplicatas)
4. **Filtra** conquistas que já existem localmente (comparação case-insensitive por nome)
5. **Concatena** novas conquistas com as existentes
6. **Notifica** o usuário se houver novas conquistas (respeitando preferências)
7. **Sincroniza com API** remota se o jogo tiver `remoteId`
8. **Persiste** no LevelDB

### Critério de conquista rara

```typescript
const isRareAchievement = (points: number) => {
  const rawPercentage = (50 - Math.sqrt(points)) * 2;
  return rawPercentage < 10;
};
```

### Critério de platina

Uma conquista é marcada como "platina" se:
- É a última da lista ordenada por `unlockTime`
- E o total de desbloqueadas + novas == total de conquistas do jogo

### Sincronização com API

```
PUT /profile/games/achievements
Body: { id: game.remoteId, achievements: mergedLocalAchievements }
```

- Se a resposta contém dados atualizados, salva os achievements do response
- Se a API retorna 304 (Not Modified), usa cache local
- Se o usuário não tem subscription, loga mas não falha
- Marca `alreadySyncedGames` para evitar re-sincronizações desnecessárias

---

## 7. Persistência via LevelDB

### Sublevel: `gameAchievements`

```typescript
// level/sublevels/game-achievements.ts
export const gameAchievementsSublevel = db.sublevel<string, GameAchievement>(
  "gameAchievements",
  { valueEncoding: "json" }
);
```

### Chave

```typescript
levelKeys.game(shop, objectId)  // formato: "steam:205100"
```

### Estrutura `GameAchievement`

```typescript
interface GameAchievement {
  achievements: SteamAchievement[];      // Metadados (nomes, ícones, etc.)
  unlockedAchievements: UnlockedAchievement[];  // Conquistas desbloqueadas localmente
  updatedAt: number | undefined;         // Timestamp da última atualização da API
  language: string | undefined;          // Idioma dos metadados
}
```

### Estrutura `UnlockedAchievement`

```typescript
interface UnlockedAchievement {
  name: string;       // Nome interno da conquista (uppercase)
  unlockTime: number; // Timestamp Unix em milissegundos
}
```

---

## 8. Notificações de Conquista

O sistema suporta dois tipos de notificação:

### Notificação Custom (Windows/Linux)

Usa uma janela Electron dedicada (`WindowManager.notificationWindow`):

```typescript
WindowManager.notificationWindow?.webContents.send(
  "on-achievement-unlocked",
  position,          // "top-left" | "top-right" | etc.
  achievementsInfo   // AchievementNotificationInfo[]
);
```

Habilitada quando:
- `achievementCustomNotificationsEnabled !== false`
- `process.platform !== "darwin"`
- `WindowManager.notificationWindow` existe

### Notificação do Sistema Operacional (fallback)

```typescript
publishNewAchievementNotification({
  achievements: achievementsInfo,
  unlockedAchievementCount,
  totalAchievementCount,
  gameTitle,
  gameIcon,
});
```

### Som de conquista

O som é tocado pelo renderer ao receber o evento. O path do som:

```typescript
const achievementSoundPath = app.isPackaged
  ? path.join(process.resourcesPath, "achievement.wav")
  : path.join(__dirname, "..", "..", "resources", "achievement.wav");
```

Volume padrão: `0.15` (15%)

---

## 9. Gerenciamento de Wine/Proton Paths

### Classe `Wine` (`src/main/services/wine.ts`)

Responsável por resolver o **Wine Prefix** (equivalente ao `$WINEPREFIX`).

#### Path padrão do prefix

```
<userData>/wine-prefixes/<objectId>
```

Onde `<userData>` é o diretório de dados do Electron (tipicamente `~/.config/hydralauncher/` no Linux).

#### Path legado (migração)

```
<userData>/wine-prefix
```

Se existir e não houver prefix específico para o jogo, usa este como fallback.

#### `getEffectivePrefixPath(winePrefixPath?, objectId?)`

Lógica de resolução (prioridade):

1. Se `winePrefixPath` foi fornecido explicitamente → usa ele
2. Se `objectId` foi fornecido → retorna `<userData>/wine-prefixes/<objectId>`
3. Se existe o path legado → retorna o legado
4. Senão → `null`

#### Validação de Prefix (`validatePrefix`)

Verifica se o diretório contém os arquivos essenciais de um Wine prefix:

| Arquivo/Tipo | Obrigatório |
|---|---|
| `system.reg` | Arquivo |
| `user.reg` | Arquivo |
| `userdef.reg` | Arquivo |
| `dosdevices` | Diretório |
| `drive_c` | Diretório |

### Classe `Umu` (`src/main/services/umu.ts`)

Responsável por gerenciar o **UMU** (compatibility layer para rodar Windows games via Proton no Linux).

#### Detecção de versões do Proton instaladas

Busca em 3 locations:

1. **Steam Common:**
   ```
   ~/.steam/steam/steamapps/common/Proton*
   ```

2. **Compatibility Tools (user):**
   ```
   ~/.steam/steam/compatibilitytools.d/*
   ```

3. **Compatibility Tools (system):**
   ```
   /usr/share/steam/compatibilitytools.d/*
   ```

Cada diretório é validado verificando a existência de:
- `proton` (arquivo executável)
- `toolmanifest.vdf`

#### Validação de path do Proton

```typescript
const isValidProtonDirectory = (directoryPath: string) => {
  const protonFilePath = path.join(directoryPath, "proton");
  const toolManifestPath = path.join(directoryPath, "toolmanifest.vdf");
  return fs.existsSync(protonFilePath) && fs.existsSync(toolManifestPath);
};
```

#### Resolução do Proton Path para lançamento

```typescript
// launch-game.ts:118-138
const resolveProtonPathForLaunch = async (gameProtonPath?) => {
  // 1. Path específico do jogo (se válido)
  if (gameProtonPath && Umu.isValidProtonPath(gameProtonPath)) return gameProtonPath;
  // 2. Path padrão das preferências do usuário
  const defaultProtonPath = userPreferences?.defaultProtonPath;
  if (defaultProtonPath && Umu.isValidProtonPath(defaultProtonPath)) return defaultProtonPath;
  // 3. null (deixa o UMU decidir)
  return null;
};
```

---

## 10. Fluxo de Lançamento de Jogo com Wine

O fluxo completo está em `launch-game.ts:188-287`:

```
launchGame(options)
  ├── parseExecutablePath(executablePath)
  ├── Salva executablePath e launchOptions no LevelDB
  ├── Cria janela do launcher do jogo
  ├── [Windows] Executa preflight de redistributíveis
  ├── Aguarda 2 segundos
  └── [Linux]
      ├── Se é .exe:
      │   ├── resolveProtonPathForLaunch(game.protonPath)
      │   ├── Wine.getEffectivePrefixPath(game.winePrefixPath, objectId)
      │   ├── cleanupStaleCompatibilityProcesses(objectId, winePrefixPath)
      │   ├── Tenta Umu.launchExecutable() com:
      │   │   ├── WINEPREFIX = winePrefixPath
      │   │   ├── PROTONPATH = protonPath
      │   │   ├── GAMEID = "umu-<objectId>"
      │   │   ├── PROTON_LOG = "1"
      │   │   ├── MANGOHUD = "1" (se habilitado)
      │   │   └── gamemoderun (wrapper, se habilitado)
      │   ├── Se falhar → fallback para launchWithWine()
      │   │   └── Usa "wine" diretamente como base command
      │   └── Se falhar → fallback para launchNatively()
      └── Se não é .exe → launchNatively()
```

### Variáveis de ambiente do UMU

| Variável | Valor | Quando |
|---|---|---|
| `GAMEID` | `umu-<objectId>` | Sempre com gameId |
| `WINEPREFIX` | Path do prefix | Sempre com winePrefixPath |
| `PROTONPATH` | Path do Proton | Sempre com protonPath |
| `PROTON_LOG` | `"1"` | Sempre |
| `MANGOHUD` | `"1"` | Se `useMangohud` |
| `STEAM_COMPAT_DATA_PATH` | Path do prefix | Usado pelo process watcher para identificar processos Wine |

### Detecção de processos Wine/Proton stale

Antes de lançar um jogo, o Hydra limpa processos Wine/Proton residuais:

```typescript
// launch-game.ts:140-182
const cleanupStaleCompatibilityProcesses = async (objectId, winePrefixPath) => {
  // Só para jogos com prefix padrão
  // Lista processos do sistema via NativeAddon.listProcesses()
  // Filtra por STEAM_COMPAT_DATA_PATH == winePrefixPath
  // E por exe/nome contendo "wine" ou ".exe" ou "wineserver"
  // Mata com SIGKILL
};
```

---

## 11. Detecção de Conquistas no Linux (Wine)

### Diferença fundamental: paths com prefix

No Windows, os paths são resolvidos diretamente do sistema (ex: `%APPDATA%`).

No Linux, **todos os paths são prefixados** com o Wine prefix path efetivo:

```typescript
// find-achivement-files.ts:253-281
export const findAchievementFiles = (game: Game) => {
  const effectiveWinePrefixPath =
    Wine.getEffectivePrefixPath(game.winePrefixPath, game.objectId) ?? "";

  for (const cracker of crackers) {
    for (const { folderPath, fileLocation } of getPathFromCracker(cracker)) {
      for (const objectId of getAlternativeObjectIds(game.objectId)) {
        const filePath = path.join(
          effectiveWinePrefixPath,  // ← PREFIX DO WINE
          folderPath,
          ...mapFileLocationWithObjectId(fileLocation, objectId)
        );
        if (fs.existsSync(filePath)) {
          achievementFiles.push({ type: cracker, filePath });
        }
      }
    }
  }
  // ...
};
```

### Exemplo concreto

Para um jogo com:
- `objectId = "205100"`
- Wine prefix padrão (`~/.config/hydralauncher/wine-prefixes/205100`)
- Cracker Goldberg

O path final seria:
```
~/.config/hydralauncher/wine-prefixes/205100/drive_c/users/<user>/AppData/Roaming/Goldberg SteamEmu Saves/205100/achievements.json
```

### Limitação: FLT no Linux

O path do FLT está **comentado** no código:
```typescript
if (cracker === Cracker.flt) {
  return [
    // {
    //   folderPath: path.join(appData, "FLT"),
    //   fileLocation: ["stats"],
    // },
  ];
}
```

Isso significa que conquistas FLT não são detectadas automaticamente (nem no Windows nem no Linux).

---

## 12. Process Watcher e Wine Prefix Map

O `process-watcher.ts` detecta jogos em execução e, no Linux, mapeia processos Wine para seus prefixes.

### `getSystemProcessMap()`

```typescript
const { processMap, winePrefixMap, linuxProcesses } =
  await NativeAddon.getSystemProcessMap();
```

O addon nativo (Rust) retorna:
- `processMap`: Mapa de nome do executável → set de paths completos
- `winePrefixMap`: Mapa de path do executável → path do Wine prefix (via `STEAM_COMPAT_DATA_PATH`)
- `linuxProcesses`: Lista de processos Linux com `name`, `cwd`, `exe`, `steamCompatDataPath`

### `hasLinuxCompatibilityProcessMatch()`

Para detectar se um jogo Windows está rodando via Wine no Linux:

1. Verifica se o executável termina com `.exe`
2. Compara `cwd` do processo com o diretório do executável
3. Se o processo tem `STEAM_COMPAT_DATA_PATH`, verifica se corresponde ao prefix esperado
4. Verifica se o nome do processo bate com o executável
5. Ou se o processo está rodando sob Wine (`process.exe.includes("wine")`)

### Auto-detecção de Wine Prefix

Quando um jogo é detectado rodando via Wine, o process watcher atualiza o `winePrefixPath` do jogo:

```typescript
// process-watcher.ts:132-134
if (process.platform === "linux" && winePrefixMap.has(path)) {
  updatedGame.winePrefixPath = winePrefixMap.get(path)!;
}
```

---

## 13. Diagrama de Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYDRA MAIN LOOP (a cada 2s)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              AchievementWatcherManager                     │    │
│  │                                                            │    │
│  │  ┌─────────────┐    ┌─────────────────────────────────┐  │    │
│  │  │ Pre-Search   │───▶│ watchAchievements()             │  │    │
│  │  │ (inicial)    │    │   ├── Windows: scan global       │  │    │
│  │  └─────────────┘    │   └── Linux: por jogo             │  │    │
│  │                      └──────────┬──────────────────────┘  │    │
│  └──────────────────────────────────┼──────────────────────────┘    │
│                                     │                               │
│                                     ▼                               │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              findAchievementFiles(game)                    │    │
│  │                                                            │    │
│  │  ┌─────────────────────────────────────────────────────┐  │    │
│  │  │ Para cada Cracker (12 tipos):                        │  │    │
│  │  │   CODEX, RUNE, OnlineFix, Goldberg, user_stats,      │  │    │
│  │  │   RLD!, EMPRESS, SKIDROW, CreamAPI, SmartSteamEmu,   │  │    │
│  │  │   3DM, FLT, RLE, Razor1911, Steam                    │  │    │
│  │  │                                                       │  │    │
│  │  │ Linux: path = winePrefix + folderPath + fileLocation  │  │    │
│  │  │ Windows: path = folderPath + fileLocation             │  │    │
│  │  └─────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────┬──────────────────────────┘    │
│                                     │                               │
│                                     ▼                               │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              compareFile(game, file)                       │    │
│  │                                                            │    │
│  │  Arquivo normal: fs.statSync().mtimeMs vs anterior         │    │
│  │  FLT (pasta): readdirSync() diff com Set anterior          │    │
│  └──────────────────────────────────┬──────────────────────────┘    │
│                                     │                               │
│                                     ▼                               │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              parseAchievementFile(path, type)              │    │
│  │                                                            │    │
│  │  INP: iniParse() ou jsonParse()                           │    │
│  │  OUT: UnlockedAchievement[]                                │    │
│  └──────────────────────────────────┬──────────────────────────┘    │
│                                     │                               │
│                                     ▼                               │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              mergeAchievements(game, achievements)         │    │
│  │                                                            │    │
│  │  1. Deduplica (case-insensitive)                           │    │
│  │  2. Salva no LevelDB                                       │    │
│  │  3. Envia notificação (custom ou OS)                       │    │
│  │  4. Sincroniza com API Hydra (PUT /profile/games/          │    │
│  │     achievements)                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    LANÇAMENTO DE JOGO (Linux)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  executablePath (.exe?)                                           │
│       │                                                           │
│       ▼                                                           │
│  resolveProtonPathForLaunch()                                     │
│  ├── game.protonPath (se válido)                                  │
│  ├── userPreferences.defaultProtonPath (se válido)                │
│  └── null                                                         │
│       │                                                           │
│       ▼                                                           │
│  Wine.getEffectivePrefixPath(game.winePrefixPath, objectId)       │
│  ├── winePrefixPath explícito                                     │
│  ├── <userData>/wine-prefixes/<objectId>                          │
│  ├── <userData>/wine-prefix (legado)                              │
│  └── null                                                         │
│       │                                                           │
│       ▼                                                           │
│  cleanupStaleCompatibilityProcesses()                             │
│       │                                                           │
│       ▼                                                           │
│  Umu.launchExecutable() ──falha──▶ launchWithWine() ──falha──▶   │
│  │                                                                │
│  ├── GAMEID=umu-<id>                                             │
│  ├── WINEPREFIX=<prefix>                                         │
│  ├── PROTONPATH=<proton>                                         │
│  ├── PROTON_LOG=1                                                │
│  └── MANGOHUD=1 (opcional)                                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resumo dos Paths Chave no Linux

| Conceito | Path |
|---|---|
| **Wine Prefix (padrão)** | `~/.config/hydralauncher/wine-prefixes/<objectId>/` |
| **Wine Prefix (legado)** | `~/.config/hydralauncher/wine-prefix/` |
| **Dentro do prefix: AppData** | `<prefix>/drive_c/users/<user>/AppData/Roaming/` |
| **Dentro do prefix: LocalAppData** | `<prefix>/drive_c/users/<user>/AppData/Local/` |
| **Dentro do prefix: Documents** | `<prefix>/drive_c/users/<user>/Documents/` |
| **Dentro do prefix: PublicDocs** | `<prefix>/drive_c/users/Public/Documents/` |
| **Dentro do prefix: ProgramData** | `<prefix>/drive_c/ProgramData/` |
| **Proton (Steam Common)** | `~/.steam/steam/steamapps/common/Proton*` |
| **Proton (compat tools user)** | `~/.steam/steam/compatibilitytools.d/*` |
| **Proton (compat tools system)** | `/usr/share/steam/compatibilitytools.d/*` |
| **Steam Userdata (achievements)** | `~/.steam/steam/userdata/<userId>/config/librarycache/<objectId>.json` |
| **UMU Binary (packaged)** | `<resourcesPath>/umu-run` |
| **UMU Binary (dev)** | `binaries/umu/umu-run` |
| **UMU Log** | `<userData>/logs/umu.log` |
| **Achievement Sound** | `<resourcesPath>/achievement.wav` |

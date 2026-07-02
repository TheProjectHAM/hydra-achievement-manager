import React, { useState, useEffect, useRef } from "react";
import {
  LanguageIcon,
  PaletteIcon,
  SteamIcon,
  GameIcon,
  UpdateIcon,
  InfoIcon,
  CloseIcon,
  FolderIcon,
  BugIcon,
  ExportIcon,
} from "./Icons";
import LocaleSettings from "./settings/LanguageSettings";
import AboutSettings from "./settings/AboutSettings";
import AppearanceSettings from "./settings/AppearanceSettings";
import UpdateSettings from "./settings/UpdateSettings";
import ApiSettings from "./settings/ApiSettings";
import ConnectionsSettings from "./settings/ConnectionsSettings";
import MonitoredSettings from "./settings/MonitoredSettings";
import DebugSettings from "./settings/DebugSettings";
import BackupSettings from "./settings/BackupSettings";
import {
  DateFormat,
  TimeFormat,
  SidebarGameScale,
  ApiSource,
  GamesViewMode,
  SteamAchievementSource,
  TitleBarMode,
} from "../types";
import { useTheme, Theme } from "../contexts/ThemeContext";
import { useI18n, Language } from "../contexts/I18nContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SubTabId =
  | "language"
  | "appearance"
  | "api"
  | "connections"
  | "monitored"
  | "backup"
  | "updates"
  | "about"
  | "debug";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotifyToast: (toast: { title: string; message: string; durationMs?: number; type?: string }) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onNotifyToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>("language");
  const { t, language, setLanguage } = useI18n();

  const {
    theme,
    setTheme,
    dateFormat,
    setDateFormat,
    timeFormat,
    setTimeFormat,
    sidebarGameScale,
    setSidebarGameScale,
    sidebarMarquee,
    setSidebarMarquee,
    hideHiddenAchievements,
    setHideHiddenAchievements,
    sidebarWidth,
    gamesViewMode,
    setGamesViewMode,
    titleBarMode,
    setTitleBarMode,
  } = useTheme();

  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);
  const [selectedDateFormat, setSelectedDateFormat] =
    useState<DateFormat>(dateFormat);
  const [selectedTimeFormat, setSelectedTimeFormat] =
    useState<TimeFormat>(timeFormat);
  const [selectedSidebarGameScale, setSelectedSidebarGameScale] =
    useState<SidebarGameScale>(sidebarGameScale);
  const [selectedSidebarMarquee, setSelectedSidebarMarquee] =
    useState<boolean>(sidebarMarquee);
  const [selectedGamesViewMode, setSelectedGamesViewMode] =
    useState<GamesViewMode>(gamesViewMode);
  const [selectedTitleBarMode, setSelectedTitleBarMode] =
    useState<TitleBarMode>(titleBarMode);
  const [selectedHideHiddenAchievements, setSelectedHideHiddenAchievements] =
    useState<boolean>(hideHiddenAchievements);
  const [selectedApi, setSelectedApi] = useState<ApiSource>("hydra");
  const [steamApiKey, setSteamApiKey] = useState<string>("");
  const [steamIntegrationEnabled, setSteamIntegrationEnabled] =
    useState<boolean>(false);
  const [steamAchievementSource, setSteamAchievementSource] =
    useState<SteamAchievementSource>("steamworks");
  const [hideSteamGamesWithoutAchievements, setHideSteamGamesWithoutAchievements] =
    useState<boolean>(true);
  const [forceFrontendFetch, setForceFrontendFetch] = useState<boolean>(false);

  const [savedSettings, setSavedSettings] = useState({
    language: language,
    theme: theme,
    dateFormat: dateFormat,
    timeFormat: timeFormat,
    sidebarGameScale: sidebarGameScale,
    sidebarMarquee: sidebarMarquee,
    hideHiddenAchievements: hideHiddenAchievements,
    gamesViewMode: gamesViewMode,
    titleBarMode: titleBarMode,
    selectedApi: "hydra" as ApiSource,
    steamApiKey: "",
    steamIntegrationEnabled: false,
    steamAchievementSource: "steamworks" as SteamAchievementSource,
    hideSteamGamesWithoutAchievements: true,
    forceFrontendFetch: false,
  });
  const [isDirty, setIsDirty] = useState(false);
  const didLoadSettingsRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    didLoadSettingsRef.current = false;

    const loadSettings = async () => {
      try {
        if ((window as any).electronAPI) {
          const loadedSettings = await (
            window as any
          ).electronAPI.loadSettings();
          if (loadedSettings) {
            if (loadedSettings.selectedApi)
              setSelectedApi(loadedSettings.selectedApi);
            if (loadedSettings.steamApiKey)
              setSteamApiKey(loadedSettings.steamApiKey);
            if (loadedSettings.steamIntegrationEnabled !== undefined)
              setSteamIntegrationEnabled(
                loadedSettings.steamIntegrationEnabled,
              );
            if (loadedSettings.steamAchievementSource)
              setSteamAchievementSource(
                loadedSettings.steamAchievementSource === "api"
                  ? "steamapi"
                  : loadedSettings.steamAchievementSource,
              );
            if (loadedSettings.hideSteamGamesWithoutAchievements !== undefined)
              setHideSteamGamesWithoutAchievements(
                loadedSettings.hideSteamGamesWithoutAchievements,
              );
            if (loadedSettings.gamesViewMode)
              setSelectedGamesViewMode(loadedSettings.gamesViewMode);
            if (loadedSettings.titleBarMode)
              setSelectedTitleBarMode(loadedSettings.titleBarMode);
            if (loadedSettings.hideHiddenAchievements !== undefined) {
              setSelectedHideHiddenAchievements(
                loadedSettings.hideHiddenAchievements,
              );
            }
            if (loadedSettings.forceFrontendFetch !== undefined)
              setForceFrontendFetch(loadedSettings.forceFrontendFetch);

            setSavedSettings({
              language: loadedSettings.language || language,
              theme: loadedSettings.theme || theme,
              dateFormat: loadedSettings.dateFormat || dateFormat,
              timeFormat: loadedSettings.timeFormat || timeFormat,
              sidebarGameScale:
                loadedSettings.sidebarGameScale || sidebarGameScale,
              sidebarMarquee: loadedSettings.sidebarMarquee || sidebarMarquee,
              hideHiddenAchievements:
                loadedSettings.hideHiddenAchievements ?? hideHiddenAchievements,
              gamesViewMode: loadedSettings.gamesViewMode || gamesViewMode,
              titleBarMode: loadedSettings.titleBarMode || titleBarMode,
              selectedApi: loadedSettings.selectedApi || "hydra",
              steamApiKey: loadedSettings.steamApiKey || "",
              steamIntegrationEnabled:
                loadedSettings.steamIntegrationEnabled || false,
              steamAchievementSource:
                loadedSettings.steamAchievementSource === "api"
                  ? "steamapi"
                  : loadedSettings.steamAchievementSource || "steamworks",
              hideSteamGamesWithoutAchievements:
                loadedSettings.hideSteamGamesWithoutAchievements ?? true,
              forceFrontendFetch: loadedSettings.forceFrontendFetch || false,
            });
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        didLoadSettingsRef.current = true;
      }
    };

    loadSettings();
    return () => {
      didLoadSettingsRef.current = false;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => setSelectedLanguage(language), [language]);
  useEffect(() => setSelectedTheme(theme), [theme]);
  useEffect(() => setSelectedDateFormat(dateFormat), [dateFormat]);
  useEffect(() => setSelectedTimeFormat(timeFormat), [timeFormat]);
  useEffect(
    () => setSelectedSidebarGameScale(sidebarGameScale),
    [sidebarGameScale],
  );
  useEffect(() => setSelectedSidebarMarquee(sidebarMarquee), [sidebarMarquee]);
  useEffect(
    () => setSelectedHideHiddenAchievements(hideHiddenAchievements),
    [hideHiddenAchievements],
  );
  useEffect(() => setSelectedGamesViewMode(gamesViewMode), [gamesViewMode]);
  useEffect(() => setSelectedTitleBarMode(titleBarMode), [titleBarMode]);

  useEffect(() => {
    const currentSettings = {
      language: selectedLanguage,
      theme: selectedTheme,
      dateFormat: selectedDateFormat,
      timeFormat: selectedTimeFormat,
      sidebarGameScale: selectedSidebarGameScale,
      sidebarMarquee: selectedSidebarMarquee,
      hideHiddenAchievements: selectedHideHiddenAchievements,
      gamesViewMode: selectedGamesViewMode,
      titleBarMode: selectedTitleBarMode,
      selectedApi: selectedApi,
      steamApiKey: steamApiKey,
      steamIntegrationEnabled: steamIntegrationEnabled,
      steamAchievementSource: steamAchievementSource,
      hideSteamGamesWithoutAchievements: hideSteamGamesWithoutAchievements,
      forceFrontendFetch: forceFrontendFetch,
    };
    if (JSON.stringify(currentSettings) !== JSON.stringify(savedSettings)) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  }, [
    selectedLanguage,
    selectedTheme,
    selectedDateFormat,
    selectedTimeFormat,
    selectedSidebarGameScale,
    selectedSidebarMarquee,
    selectedGamesViewMode,
    selectedTitleBarMode,
    selectedHideHiddenAchievements,
    selectedApi,
    steamApiKey,
    steamIntegrationEnabled,
    steamAchievementSource,
    hideSteamGamesWithoutAchievements,
    forceFrontendFetch,
    savedSettings,
  ]);

  const handleSaveChanges = async (overrides: any = {}) => {
    const finalLanguage = overrides.language || selectedLanguage;
    const finalTheme = overrides.theme || selectedTheme;
    const finalDateFormat = overrides.dateFormat || selectedDateFormat;
    const finalTimeFormat = overrides.timeFormat || selectedTimeFormat;
    const finalSidebarGameScale =
      overrides.sidebarGameScale || selectedSidebarGameScale;
    const finalSidebarMarquee =
      overrides.sidebarMarquee !== undefined
        ? overrides.sidebarMarquee
        : selectedSidebarMarquee;
    const finalGamesViewMode = overrides.gamesViewMode || selectedGamesViewMode;
    const finalTitleBarMode = overrides.titleBarMode || selectedTitleBarMode;
    const finalHideHiddenAchievements =
      overrides.hideHiddenAchievements !== undefined
        ? overrides.hideHiddenAchievements
        : selectedHideHiddenAchievements;
    const finalApi = overrides.selectedApi || selectedApi;
    const finalSteamApiKey =
      overrides.steamApiKey !== undefined ? overrides.steamApiKey : steamApiKey;
    const finalSteamIntegrationEnabled =
      overrides.steamIntegrationEnabled !== undefined
        ? overrides.steamIntegrationEnabled
        : steamIntegrationEnabled;
    const finalSteamAchievementSource =
      overrides.steamAchievementSource || steamAchievementSource;
    const finalHideSteamGamesWithoutAchievements =
      overrides.hideSteamGamesWithoutAchievements !== undefined
        ? overrides.hideSteamGamesWithoutAchievements
        : hideSteamGamesWithoutAchievements;
    const finalForceFrontendFetch =
      overrides.forceFrontendFetch !== undefined
        ? overrides.forceFrontendFetch
        : forceFrontendFetch;

    if (language !== finalLanguage) setLanguage(finalLanguage);
    if (theme !== finalTheme) setTheme(finalTheme);
    if (dateFormat !== finalDateFormat) setDateFormat(finalDateFormat);
    if (timeFormat !== finalTimeFormat) setTimeFormat(finalTimeFormat);
    if (sidebarGameScale !== finalSidebarGameScale)
      setSidebarGameScale(finalSidebarGameScale);
    if (sidebarMarquee !== finalSidebarMarquee)
      setSidebarMarquee(finalSidebarMarquee);
    if (hideHiddenAchievements !== finalHideHiddenAchievements) {
      setHideHiddenAchievements(finalHideHiddenAchievements);
    }
    if (gamesViewMode !== finalGamesViewMode)
      setGamesViewMode(finalGamesViewMode);
    if (titleBarMode !== finalTitleBarMode)
      setTitleBarMode(finalTitleBarMode);
    if (hideSteamGamesWithoutAchievements !== finalHideSteamGamesWithoutAchievements) {
      setHideSteamGamesWithoutAchievements(finalHideSteamGamesWithoutAchievements);
    }

    const currentSettings = {
      language: finalLanguage,
      theme: finalTheme,
      dateFormat: finalDateFormat,
      timeFormat: finalTimeFormat,
      sidebarGameScale: finalSidebarGameScale,
      sidebarMarquee: finalSidebarMarquee,
      hideHiddenAchievements: finalHideHiddenAchievements,
      sidebarWidth: sidebarWidth,
      gamesViewMode: finalGamesViewMode,
      titleBarMode: finalTitleBarMode,
      selectedApi: finalApi,
      steamApiKey: finalSteamApiKey,
      steamIntegrationEnabled: finalSteamIntegrationEnabled,
      steamAchievementSource: finalSteamAchievementSource,
      hideSteamGamesWithoutAchievements:
        finalHideSteamGamesWithoutAchievements,
      forceFrontendFetch: finalForceFrontendFetch,
    };

    try {
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.saveSettings(currentSettings);
      }
      setSavedSettings({
        language: finalLanguage,
        theme: finalTheme,
        dateFormat: finalDateFormat,
        timeFormat: finalTimeFormat,
        sidebarGameScale: finalSidebarGameScale,
        sidebarMarquee: finalSidebarMarquee,
        hideHiddenAchievements: finalHideHiddenAchievements,
        gamesViewMode: finalGamesViewMode,
        titleBarMode: finalTitleBarMode,
        selectedApi: finalApi,
        steamApiKey: finalSteamApiKey,
        steamIntegrationEnabled: finalSteamIntegrationEnabled,
        steamAchievementSource: finalSteamAchievementSource,
        hideSteamGamesWithoutAchievements:
          finalHideSteamGamesWithoutAchievements,
        forceFrontendFetch: finalForceFrontendFetch,
      });
      window.dispatchEvent(new Event("settings-saved"));
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  useEffect(() => {
    if (!isOpen || !didLoadSettingsRef.current || !isDirty) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      handleSaveChanges();
    }, 650);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    isOpen,
    isDirty,
    selectedLanguage,
    selectedTheme,
    selectedDateFormat,
    selectedTimeFormat,
    selectedSidebarGameScale,
    selectedSidebarMarquee,
    selectedGamesViewMode,
    selectedTitleBarMode,
    selectedHideHiddenAchievements,
    selectedApi,
    steamApiKey,
    steamIntegrationEnabled,
    steamAchievementSource,
    hideSteamGamesWithoutAchievements,
    forceFrontendFetch,
  ]);

  const handleClose = async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (isDirty && didLoadSettingsRef.current) {
      await handleSaveChanges();
    }

    onClose();
  };

  const [debugClickCount, setDebugClickCount] = useState(0);
  const [showDebugTab, setShowDebugTab] = useState(
    process.env.NODE_ENV === "development",
  );
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "g") {
        setDebugClickCount((prev) => prev + 1);
      } else {
        setDebugClickCount(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (debugClickCount >= 3) {
      setShowDebugTab(true);
      setDebugClickCount(0);
    }
  }, [debugClickCount]);

  const tabs = [
    {
      id: "language",
      icon: <LanguageIcon />,
      label: t("settings.language.tab"),
    },
    {
      id: "appearance",
      icon: <PaletteIcon />,
      label: t("settings.appearance.tab"),
    },
    { id: "api", icon: <SteamIcon />, label: t("settings.api.tab") },
    {
      id: "connections",
      icon: <GameIcon />,
      label: t("settings.connections.tab"),
    },
    {
      id: "monitored",
      icon: <FolderIcon />,
      label: t("settings.monitored.tab"),
    },
    { id: "backup", icon: <ExportIcon />, label: t("settings.backup.tab") },
    { id: "updates", icon: <UpdateIcon />, label: t("settings.updates.tab") },
    { id: "about", icon: <InfoIcon />, label: t("settings.about.tab") },
  ];

  if (showDebugTab) {
    tabs.push({ id: "debug", icon: <BugIcon />, label: "Debug" });
  }


  const renderContent = () => {
    switch (activeSubTab) {
      case "language":
        return (
          <LocaleSettings
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            selectedDateFormat={selectedDateFormat}
            setSelectedDateFormat={setSelectedDateFormat}
            selectedTimeFormat={selectedTimeFormat}
            setSelectedTimeFormat={setSelectedTimeFormat}
            onSave={handleSaveChanges}
          />
        );
      case "appearance":
        return (
          <AppearanceSettings
            selectedTheme={selectedTheme}
            setSelectedTheme={setSelectedTheme}
            selectedGameScale={selectedSidebarGameScale}
            setSelectedGameScale={setSelectedSidebarGameScale}
            selectedMarquee={selectedSidebarMarquee}
            setSelectedMarquee={setSelectedSidebarMarquee}
            selectedHideHiddenAchievements={selectedHideHiddenAchievements}
            setSelectedHideHiddenAchievements={setSelectedHideHiddenAchievements}
            selectedGamesViewMode={selectedGamesViewMode}
            setSelectedGamesViewMode={setSelectedGamesViewMode}
            selectedTitleBarMode={selectedTitleBarMode}
            setSelectedTitleBarMode={setSelectedTitleBarMode}
            selectedApi={selectedApi}
          />
        );
      case "api":
        return (
          <ApiSettings
            selectedApi={selectedApi}
            setSelectedApi={setSelectedApi}
            steamApiKey={steamApiKey}
            setSteamApiKey={setSteamApiKey}
            steamIntegrationEnabled={steamIntegrationEnabled}
            setSteamIntegrationEnabled={setSteamIntegrationEnabled}
            hideSteamGamesWithoutAchievements={hideSteamGamesWithoutAchievements}
            setHideSteamGamesWithoutAchievements={setHideSteamGamesWithoutAchievements}
            onNotifyToast={onNotifyToast}
          />
        );
      case "connections":
        return (
          <ConnectionsSettings
            steamIntegrationEnabled={steamIntegrationEnabled}
            setSteamIntegrationEnabled={setSteamIntegrationEnabled}
            steamAchievementSource={steamAchievementSource}
            setSteamAchievementSource={(source) => {
              setSteamAchievementSource(source);
              handleSaveChanges({ steamAchievementSource: source });
            }}
            hideSteamGamesWithoutAchievements={hideSteamGamesWithoutAchievements}
            setHideSteamGamesWithoutAchievements={setHideSteamGamesWithoutAchievements}
          />
        );
      case "monitored":
        return (
          <MonitoredSettings
            selectedApi={selectedApi}
            steamIntegrationEnabled={steamIntegrationEnabled}
            setSteamIntegrationEnabled={setSteamIntegrationEnabled}
          />
        );
      case "backup":
        return <BackupSettings />;
      case "updates":
        return <UpdateSettings />;
      case "about":
        return <AboutSettings />;
      case "debug":
        return showDebugTab ? (
          <DebugSettings
            forceFrontendFetch={forceFrontendFetch}
            setForceFrontendFetch={setForceFrontendFetch}
          />
        ) : null;
      default:
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) void handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(86vw,1280px)] h-[min(84vh,900px)] max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] overflow-visible p-0 gap-0 sm:max-w-none"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void handleClose()}
          className="absolute right-3 top-3 z-50 h-9 w-9 rounded-md bg-transparent text-muted-foreground shadow-none transition-colors hover:bg-transparent hover:text-foreground"
          title={t("common.close")}
        >
          <CloseIcon className="text-xl" />
        </Button>

        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Application preferences</DialogDescription>
        </DialogHeader>

        <div className="flex h-full w-full overflow-hidden rounded-lg bg-background">
          <aside className="flex w-72 shrink-0 flex-col bg-sidebar-background">
            <nav className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const isActive = activeSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSubTab(tab.id as SubTabId)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.95rem] transition-colors ${
                        isActive
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      }` }
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center text-lg opacity-80">
                        {tab.icon}
                      </span>
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </aside>

          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
              {renderContent()}
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;

import React, { useState, useEffect } from "react";
import {
  LanguageIcon,
  PaletteIcon,
  SteamIcon,
  GameIcon,
  UpdateIcon,
  InfoIcon,
  SaveIcon,
  CheckIcon,
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
  const [selectedHideHiddenAchievements, setSelectedHideHiddenAchievements] =
    useState<boolean>(hideHiddenAchievements);
  const [selectedApi, setSelectedApi] = useState<ApiSource>("hydra");
  const [steamApiKey, setSteamApiKey] = useState<string>("");
  const [steamIntegrationEnabled, setSteamIntegrationEnabled] =
    useState<boolean>(false);
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
    selectedApi: "hydra" as ApiSource,
    steamApiKey: "",
    steamIntegrationEnabled: false,
    hideSteamGamesWithoutAchievements: true,
    forceFrontendFetch: false,
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

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
            if (loadedSettings.hideSteamGamesWithoutAchievements !== undefined)
              setHideSteamGamesWithoutAchievements(
                loadedSettings.hideSteamGamesWithoutAchievements,
              );
            if (loadedSettings.gamesViewMode)
              setSelectedGamesViewMode(loadedSettings.gamesViewMode);
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
              selectedApi: loadedSettings.selectedApi || "hydra",
              steamApiKey: loadedSettings.steamApiKey || "",
              steamIntegrationEnabled:
                loadedSettings.steamIntegrationEnabled || false,
              hideSteamGamesWithoutAchievements:
                loadedSettings.hideSteamGamesWithoutAchievements ?? true,
              forceFrontendFetch: loadedSettings.forceFrontendFetch || false,
            });
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
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
      selectedApi: selectedApi,
      steamApiKey: steamApiKey,
      steamIntegrationEnabled: steamIntegrationEnabled,
      hideSteamGamesWithoutAchievements: hideSteamGamesWithoutAchievements,
      forceFrontendFetch: forceFrontendFetch,
    };
    if (JSON.stringify(currentSettings) !== JSON.stringify(savedSettings)) {
      setIsDirty(true);
      setIsSaved(false);
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
    selectedHideHiddenAchievements,
    selectedApi,
    steamApiKey,
    steamIntegrationEnabled,
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
      selectedApi: finalApi,
      steamApiKey: finalSteamApiKey,
      steamIntegrationEnabled: finalSteamIntegrationEnabled,
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
        selectedApi: finalApi,
        steamApiKey: finalSteamApiKey,
        steamIntegrationEnabled: finalSteamIntegrationEnabled,
        hideSteamGamesWithoutAchievements:
          finalHideSteamGamesWithoutAchievements,
        forceFrontendFetch: finalForceFrontendFetch,
      });
      setIsSaved(true);

      window.dispatchEvent(new Event("settings-saved"));
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  useEffect(() => {
    if (isSaved) {
      const timer = setTimeout(() => setIsSaved(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [isSaved]);

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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(86vw,1280px)] h-[min(84vh,900px)] max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] overflow-hidden p-0 gap-0 sm:max-w-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Application preferences</DialogDescription>
        </DialogHeader>

        <div className="flex h-full w-full overflow-hidden bg-background text-muted-foreground">
          {/* Sidebar Navigation */}
          <aside className="w-72 border-r border-sidebar-border flex flex-col p-4 bg-sidebar-background text-sidebar-foreground">
            <nav className="flex-1 space-y-1">
              {tabs.map((tab) => {
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id as SubTabId)}
                    className={`w-full h-11 px-4 gap-4 rounded-md flex items-center text-left transition-all duration-300 group ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-lg"
                        : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <span className={`text-2xl transition-colors ${isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground"}`}>
                      {tab.icon}
                    </span>
                    <span className="text-[0.95rem] font-semibold truncate">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 border-t border-sidebar-border flex items-center gap-2">
              <Button
                onClick={handleSaveChanges}
                disabled={!isDirty}
                variant={isSaved ? "default" : isDirty ? "default" : "outline"}
                className={`flex-1 h-11 text-[11px] font-semibold ${isSaved ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}`}
              >
                {isSaved ? (
                  <CheckIcon className="text-sm" />
                ) : (
                  <SaveIcon className="text-sm" />
                )}
                <span>
                  {isSaved ? t("settings.saved") : t("settings.saveChanges")}
                </span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="w-11 h-11 flex-shrink-0"
                title={t("common.close")}
              >
                <CloseIcon className="text-2xl" />
              </Button>
            </div>
          </aside>

          {/* Content Area */}
          <main className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto px-12 pt-10 custom-scrollbar">
              <div className="w-full space-y-2 pb-20">{renderContent()}</div>
            </div>

            <div
              className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
              style={{
                background: `linear-gradient(to top, var(--background), transparent)`,
              }}
            />
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;

import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  LanguageIcon,
  PaletteIcon,
  SteamIcon,
  UpdateIcon,
  InfoIcon,
  SaveIcon,
  CheckIcon,
  CloseIcon,
  FolderIcon,
  BugIcon,
} from "./Icons";
import LocaleSettings from "./settings/LanguageSettings";
import AboutSettings from "./settings/AboutSettings";
import AppearanceSettings from "./settings/AppearanceSettings";
import UpdateSettings from "./settings/UpdateSettings";
import ApiSettings from "./settings/ApiSettings";
import MonitoredSettings from "./settings/MonitoredSettings";
import DebugSettings from "./settings/DebugSettings";
import { ToastItemData } from "./ToastContainer";
import {
  DateFormat,
  TimeFormat,
  SidebarGameScale,
  ApiSource,
  GamesViewMode,
} from "../types";
import { useTheme, Theme } from "../contexts/ThemeContext";
import { useI18n, Language } from "../contexts/I18nContext";

type SubTabId =
  | "language"
  | "appearance"
  | "api"
  | "monitored"
  | "updates"
  | "about"
  | "debug";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotifyToast: (toast: Omit<ToastItemData, "id">) => void;
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

  // State for current settings
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
  const [forceFrontendFetch, setForceFrontendFetch] = useState<boolean>(false);

  // State for tracking changes
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
    forceFrontendFetch: false,
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Load settings from electron on component mount
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

  // Sync local state if context changes
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

  // Auto-disable Steam integration when switching to Hydra API
  useEffect(() => {
    if (selectedApi !== "steam" && steamIntegrationEnabled) {
      setSteamIntegrationEnabled(false);
    }
  }, [selectedApi]);

  // Effect to check for changes
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
        forceFrontendFetch: finalForceFrontendFetch,
      });
      setIsSaved(true);

      // Dispatch event to notify other components that settings changed
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

  // Debug mode state
  const [debugClickCount, setDebugClickCount] = useState(0);
  const [showDebugTab, setShowDebugTab] = useState(
    process.env.NODE_ENV === "development",
  );
  const [systemInfo, setSystemInfo] = useState<{
    cpu: string;
    ram: string;
    os: string;
  } | null>(null);

  useEffect(() => {
    if (showDebugTab && !systemInfo) {
      const fetchSystemInfo = async () => {
        try {
          if ((window as any).electronAPI) {
            const info = await invoke("get_system_info");
            setSystemInfo(info as any);
          }
        } catch (error) {
          console.error("Failed to fetch system info:", error);
        }
      };
      fetchSystemInfo();
    }
  }, [showDebugTab, systemInfo]);

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
      id: "monitored",
      icon: <FolderIcon />,
      label: t("settings.monitored.tab"),
    },
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
            onNotifyToast={onNotifyToast}
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
    <div
      className={`fixed top-10 left-0 right-0 bottom-0 z-40 text-[var(--text-muted)] flex overflow-hidden ${isOpen ? "animate-fade-in" : "pointer-events-none opacity-0"}`}
      style={{ backgroundColor: "var(--bg-color)" }}
    >
      {/* Sidebar Navigation */}
      <aside
        className="w-64 border-r flex flex-col p-6"
        style={{
          backgroundColor: "var(--sidebar-bg)",
          borderColor: "var(--border-color)",
        }}
      >
        <nav className="flex-1 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SubTabId)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-300 group ${
                activeSubTab === tab.id
                  ? "bg-[var(--border-color)] text-[var(--text-main)] shadow-lg"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)]"
              }`}
            >
              <span
                className={`text-lg transition-colors ${activeSubTab === tab.id ? "text-[var(--text-main)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-main)]"}`}
              >
                {tab.icon}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest">
                {tab.label}
              </span>
            </button>
          ))}
        </nav>

        <div
          className="mt-auto pt-6 border-t flex items-center gap-2"
          style={{ borderColor: "var(--border-color)" }}
        >
          <button
            onClick={handleSaveChanges}
            disabled={!isDirty}
            className={`flex-1 h-11 flex items-center justify-center gap-2.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${
              isSaved
                ? "bg-emerald-500 text-white"
                : isDirty
                  ? "bg-[var(--text-main)] text-[var(--bg-color)] hover:opacity-90 active:scale-[0.98]"
                  : "bg-[var(--hover-bg)] text-[var(--text-muted)] border border-[var(--border-color)] cursor-not-allowed"
            }`}
          >
            {isSaved ? (
              <CheckIcon className="text-sm" />
            ) : (
              <SaveIcon className="text-sm" />
            )}
            <span>
              {isSaved ? t("settings.saved") : t("settings.saveChanges")}
            </span>
          </button>

          <button
            onClick={onClose}
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg bg-[var(--hover-bg)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)] transition-all duration-300 group"
            title={t("common.close")}
          >
            <CloseIcon className="text-xl transition-transform group-hover:rotate-90" />
          </button>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="flex items-start justify-between px-12 pt-10 pb-4">
          <div className="space-y-1">
            <h3
              className="text-3xl font-black tracking-tight uppercase"
              style={{ color: "var(--text-main)" }}
            >
              {tabs.find((t) => t.id === activeSubTab)?.label}
            </h3>
            <p
              className="text-xs font-medium max-w-full uppercase tracking-wider opacity-60 truncate whitespace-nowrap"
              style={{ color: "var(--text-main)" }}
            >
              {activeSubTab === "language" &&
                t("settings.language.description")}
              {activeSubTab === "appearance" &&
                t("settings.appearance.description")}
              {activeSubTab === "api" && t("settings.api.description")}
              {activeSubTab === "monitored" &&
                t("settings.monitored.description")}
              {activeSubTab === "updates" && t("settings.updates.description")}
              {activeSubTab === "about" && t("settings.about.description")}
              {activeSubTab === "debug" && systemInfo && (
                <span className="flex items-center gap-3">
                  <span className="opacity-100">{systemInfo.os}</span>
                  <span className="opacity-30">•</span>
                  <span className="opacity-100">{systemInfo.cpu}</span>
                  <span className="opacity-30">•</span>
                  <span className="opacity-100">{systemInfo.ram}</span>
                </span>
              )}
            </p>
          </div>
        </header>

        {/* Scrollable Region */}
        <div className="flex-1 overflow-y-auto px-12 pt-4 custom-scrollbar">
          <div className="w-full space-y-2 pb-20">{renderContent()}</div>
        </div>

        {/* Subtle aesthetic gradient overlap */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{
            background: `linear-gradient(to top, var(--bg-color), transparent)`,
          }}
        />
      </main>
    </div>
  );
};

export default SettingsModal;

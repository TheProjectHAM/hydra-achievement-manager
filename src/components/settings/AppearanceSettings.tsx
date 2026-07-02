import React from "react";
import { Theme, useTheme } from "../../contexts/ThemeContext";
import {
  SidebarGameScale,
  GamesViewMode,
  TitleBarMode,
  ApiSource,
} from "../../types";
import { useI18n } from "../../contexts/I18nContext";
import {
  SegmentedControl,
  SettingsActionRow,
  SettingsPage,
  SettingsPanel,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
  ThemeSwatch,
} from "./shared";

const DEFAULT_SIDEBAR_WIDTH = 288;

const AppearanceSettings: React.FC<{
  selectedTheme: Theme;
  setSelectedTheme: (theme: Theme) => void;
  selectedGameScale: SidebarGameScale;
  setSelectedGameScale: (scale: SidebarGameScale) => void;
  selectedMarquee: boolean;
  setSelectedMarquee: (marquee: boolean) => void;
  selectedGamesViewMode: GamesViewMode;
  setSelectedGamesViewMode: (mode: GamesViewMode) => void;
  selectedTitleBarMode: TitleBarMode;
  setSelectedTitleBarMode: (mode: TitleBarMode) => void;
  selectedHideHiddenAchievements: boolean;
  setSelectedHideHiddenAchievements: (enabled: boolean) => void;
  selectedApi: ApiSource;
}> = ({
  selectedTheme,
  setSelectedTheme,
  selectedGameScale,
  setSelectedGameScale,
  selectedMarquee,
  setSelectedMarquee,
  selectedGamesViewMode,
  setSelectedGamesViewMode,
  selectedTitleBarMode,
  setSelectedTitleBarMode,
  selectedHideHiddenAchievements,
  setSelectedHideHiddenAchievements,
  selectedApi,
}) => {
  const { t } = useI18n();
  const { setSidebarWidth } = useTheme();
  const canToggleHiddenAchievements = selectedApi === "steam";

  const themes: { id: Theme; name: string; palette: string[] }[] = [
    {
      id: "light",
      name: t("settings.appearance.lightTheme"),
      palette: ["#f0f2f5", "#edf1f4", "#1e293b"],
    },
    {
      id: "dark",
      name: t("settings.appearance.darkTheme"),
      palette: ["#0a0a0b", "#1a1a1b", "#ffffff"],
    },
    {
      id: "nord",
      name: t("settings.appearance.nordTheme"),
      palette: ["#2e3440", "#3b4252", "#88c0d0"],
    },
    {
      id: "gruvbox",
      name: t("settings.appearance.gruvboxTheme"),
      palette: ["#282828", "#3c3836", "#fb4934"],
    },
    {
      id: "tokyo-night",
      name: t("settings.appearance.tokyoNightTheme"),
      palette: ["#1a1b26", "#24283b", "#7aa2f7"],
    },
    {
      id: "everforest",
      name: t("settings.appearance.everforestTheme"),
      palette: ["#2d353b", "#343f44", "#a7c080"],
    },
    {
      id: "dracula",
      name: t("settings.appearance.draculaTheme"),
      palette: ["#282a36", "#44475a", "#bd93f9"],
    },
    {
      id: "retrowave",
      name: t("settings.appearance.retrowaveTheme"),
      palette: ["#140522", "#24103d", "#d746ff"],
    },
    {
      id: "catppuccin",
      name: t("settings.appearance.catppuccinTheme"),
      palette: ["#1f1b18", "#2a2320", "#d6a78a"],
    },
    {
      id: "github-dark",
      name: t("settings.appearance.githubDarkTheme"),
      palette: ["#0d1117", "#161b22", "#58a6ff"],
    },
    {
      id: "solarized-dark",
      name: t("settings.appearance.solarizedDarkTheme"),
      palette: ["#002b36", "#073642", "#268bd2"],
    },
    {
      id: "one-dark",
      name: t("settings.appearance.oneDarkTheme"),
      palette: ["#282c34", "#353b45", "#61afef"],
    },
    {
      id: "breeze-dark",
      name: t("settings.appearance.breezeDarkTheme"),
      palette: ["#202326", "#141618", "#3daee9"],
    },
  ];

  return (
    <SettingsPage
      title={t("settings.appearance.tab")}
      description={t("settings.appearance.description")}
    >
      <SettingsSection title={t("settings.appearance.title")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {themes.map((theme) => (
            <ThemeSwatch
              key={theme.id}
              name={theme.name}
              colors={theme.palette}
              selected={selectedTheme === theme.id}
              onSelect={() => setSelectedTheme(theme.id)}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t("settings.appearance.titleBarMode")}>
        <SettingsPanel>
          <SettingsRow
            label={t("settings.appearance.titleBarMode")}
            description={t("settings.appearance.titleBarModeDesc")}
          >
            <SegmentedControl
              value={selectedTitleBarMode}
              onChange={setSelectedTitleBarMode}
              options={[
                { value: "hidden", label: t("settings.appearance.titleBarHidden") },
                { value: "custom", label: t("settings.appearance.titleBarCustom") },
                { value: "native", label: t("settings.appearance.titleBarNative") },
              ]}
            />
          </SettingsRow>
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection>
        <SettingsPanel>
          <SettingsRow
            label={t("settings.appearance.viewMode")}
            description={t("settings.appearance.viewModeDesc")}
          >
            <SegmentedControl
              value={selectedGamesViewMode}
              onChange={setSelectedGamesViewMode}
              options={[
                { value: "grid", label: t("settings.appearance.grid") },
                { value: "list", label: t("settings.appearance.list") },
              ]}
            />
          </SettingsRow>

          <SettingsRow
            label={t("settings.appearance.sidebarGameScale")}
            description={t("settings.appearance.description")}
          >
            <SegmentedControl
              value={selectedGameScale}
              onChange={setSelectedGameScale}
              options={[
                { value: "sm", label: t("settings.appearance.sizeSmall") },
                { value: "md", label: t("settings.appearance.sizeMedium") },
                { value: "lg", label: t("settings.appearance.sizeLarge") },
              ]}
            />
          </SettingsRow>

          <SettingsToggleRow
            label={t("settings.appearance.sidebarMarquee")}
            description={t("settings.appearance.sidebarMarqueeDesc")}
            checked={selectedMarquee}
            onCheckedChange={setSelectedMarquee}
          />

          <SettingsToggleRow
            label={t("settings.appearance.hideHiddenAchievements")}
            description={t("settings.appearance.hideHiddenAchievementsDesc")}
            checked={selectedHideHiddenAchievements}
            onCheckedChange={setSelectedHideHiddenAchievements}
            disabled={!canToggleHiddenAchievements}
          />

          <SettingsActionRow
            label={t("settings.appearance.resetSidebarWidth")}
            description={t("settings.appearance.resetSidebarWidthDesc")}
            actionLabel={t("settings.appearance.reset")}
            onAction={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
          />
        </SettingsPanel>
      </SettingsSection>
    </SettingsPage>
  );
};

export default AppearanceSettings;

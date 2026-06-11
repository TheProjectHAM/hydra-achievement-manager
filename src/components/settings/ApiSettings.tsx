import React, { useState } from "react";
import { ApiSource } from "../../types";
import { SteamBrandIcon, HydraIcon } from "../Icons";
import { useI18n } from "../../contexts/I18nContext";

interface ApiSettingsProps {
  selectedApi: ApiSource;
  setSelectedApi: (api: ApiSource) => void;
  steamApiKey: string;
  setSteamApiKey: (key: string) => void;
  steamIntegrationEnabled: boolean;
  setSteamIntegrationEnabled: (enabled: boolean) => void;
  hideSteamGamesWithoutAchievements: boolean;
  setHideSteamGamesWithoutAchievements: (enabled: boolean) => void;
  onNotifyToast?: (toast: { title: string; message: string; durationMs?: number; type?: string }) => void;
}

const ApiSettings: React.FC<ApiSettingsProps> = ({
  selectedApi,
  setSelectedApi,
  steamApiKey,
  setSteamApiKey,
}) => {
  const { t } = useI18n();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isApiDropdownOpen, setIsApiDropdownOpen] = useState(false);

  const apiOptions: Array<{
    id: ApiSource;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "steam",
      label: t("settings.api.steamApi"),
      description: t("settings.api.steamDescription"),
      icon: <SteamBrandIcon className="w-4 h-4 opacity-80" />,
    },
    {
      id: "hydra",
      label: t("settings.api.hydraApi"),
      description: t("settings.api.hydraDescription"),
      icon: <HydraIcon className="text-base opacity-70" />,
    },
  ];

  const selectedApiOption = apiOptions.find((option) => option.id === selectedApi);

  return (
    <div className="space-y-1 animate-modal-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-8 border-b border-border">
        <div className="flex-1">
          <h4 className="text-sm font-semibold mb-1.5 text-foreground">
            {t("settings.api.title")}
          </h4>
          <p className="text-xs opacity-60 font-medium leading-relaxed max-w-md text-foreground">
            {t("settings.api.description")}
          </p>
        </div>

        <div className="relative w-full sm:w-60 flex-shrink-0">
          <button
            onClick={() => setIsApiDropdownOpen(!isApiDropdownOpen)}
            className="w-full h-12 border border-border rounded-md px-5 flex items-center justify-between transition-all duration-300 group shadow-sm hover:shadow-md bg-muted"
          >
            <div className="flex items-center gap-3 min-w-0">
              {selectedApiOption?.icon}
              <span className="text-xs font-semibold text-foreground">
                {selectedApiOption?.label}
              </span>
            </div>
            <svg className={`w-3.5 h-3.5 transition-transform duration-300 text-muted-foreground ${isApiDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isApiDropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsApiDropdownOpen(false)} />
              <ul className="absolute z-40 mt-1 w-full border border-border rounded-md shadow-2xl overflow-hidden p-1.5 animate-modal-in bg-card">
                {apiOptions.map((option) => (
                  <li key={option.id}>
                    <button
                      onClick={() => {
                        setSelectedApi(option.id);
                        setIsApiDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${selectedApi === option.id
                        ? "bg-border text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                    >
                      {option.icon}
                      <span className="text-xs font-semibold flex-grow text-left">{option.label}</span>
                      {selectedApi === option.id && <div className="w-1.5 h-1.5 rounded-full bg-foreground" />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {selectedApi === "steam" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-8 border-b border-border">
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1.5 text-foreground">
              {t("settings.api.apiKeyLabel")}
            </h4>
            <p className="text-xs opacity-60 font-medium leading-relaxed max-w-md text-foreground">
              {t("settings.api.apiKeyPlaceholder")}
            </p>
          </div>

          <div className="relative w-full sm:w-72 flex-shrink-0">
            <input
              type={showApiKey ? "text" : "password"}
              value={steamApiKey}
              onChange={(e) => setSteamApiKey(e.target.value)}
              placeholder={t("settings.api.apiKeyPlaceholder")}
              className="w-full h-12 border border-border rounded-md pl-4 pr-20 text-sm font-semibold outline-none shadow-inner placeholder:text-muted-foreground bg-muted text-foreground"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-3 rounded-md border border-border text-[10px] font-semibold bg-accent text-foreground"
            >
              {showApiKey ? t("settings.api.hideApiKey") : t("settings.api.showApiKey")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiSettings;

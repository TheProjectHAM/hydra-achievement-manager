import React, { useState } from "react";
import { ApiSource } from "../../types";
import { SteamBrandIcon, HydraIcon } from "../Icons";
import { useI18n } from "../../contexts/I18nContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import {
  OptionCard,
  OptionCardGrid,
  SettingsPage,
  SettingsPanel,
  SettingsRow,
  SettingsSection,
} from "./shared";

interface ApiSettingsProps {
  selectedApi: ApiSource;
  setSelectedApi: (api: ApiSource) => void;
  steamApiKey: string;
  setSteamApiKey: (key: string) => void;
  steamIntegrationEnabled: boolean;
  setSteamIntegrationEnabled: (enabled: boolean) => void;
  hideSteamGamesWithoutAchievements: boolean;
  setHideSteamGamesWithoutAchievements: (enabled: boolean) => void;
  onNotifyToast?: (toast: {
    title: string;
    message: string;
    durationMs?: number;
    type?: string;
  }) => void;
}

const ApiSettings: React.FC<ApiSettingsProps> = ({
  selectedApi,
  setSelectedApi,
  steamApiKey,
  setSteamApiKey,
}) => {
  const { t } = useI18n();
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <SettingsPage
      title={t("settings.api.title")}
      description={t("settings.api.description")}
    >
      <SettingsSection title={t("settings.api.title")}>
        <OptionCardGrid>
          <OptionCard
            selected={selectedApi === "hydra"}
            onSelect={() => setSelectedApi("hydra")}
            icon={<HydraIcon className="text-2xl" />}
            title={t("settings.api.hydraApi")}
            description={t("settings.api.hydraDescription")}
          />
          <OptionCard
            selected={selectedApi === "steam"}
            onSelect={() => setSelectedApi("steam")}
            icon={<SteamBrandIcon className="h-7 w-7" />}
            title={t("settings.api.steamApi")}
            description={t("settings.api.steamDescription")}
          />
        </OptionCardGrid>
      </SettingsSection>

      {selectedApi === "steam" && (
        <SettingsSection title={t("settings.api.apiKeyLabel")}>
          <SettingsPanel>
            <SettingsRow
              label={t("settings.api.apiKeyLabel")}
              description={t("settings.api.apiKeyPlaceholder")}
            >
              <div className="flex w-64 items-center gap-1">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={steamApiKey}
                  onChange={(e) => setSteamApiKey(e.target.value)}
                  placeholder={t("settings.api.apiKeyPlaceholder")}
                  className="font-normal"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={
                    showApiKey
                      ? t("settings.api.hideApiKey")
                      : t("settings.api.showApiKey")
                  }
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </SettingsRow>
          </SettingsPanel>
        </SettingsSection>
      )}
    </SettingsPage>
  );
};

export default ApiSettings;

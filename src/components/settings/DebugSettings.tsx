import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { exit } from "@tauri-apps/plugin-process";
import { useI18n } from "../../contexts/I18nContext";
import TestResultsModal from "../TestResultsModal";
import { saveSettings } from "../../tauri-api";
import {
  SettingsPage,
  SettingsPanel,
  SettingsToggleRow,
  SettingsActionRow,
} from "./shared";
import { Loader2 } from "lucide-react";

interface DebugSettingsProps {
  forceFrontendFetch: boolean;
  setForceFrontendFetch: (force: boolean) => void;
}

const DebugSettings: React.FC<DebugSettingsProps> = ({
  forceFrontendFetch,
  setForceFrontendFetch,
}) => {
  const { t } = useI18n();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [isRestartingWizard, setIsRestartingWizard] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, unknown> | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openDevTools = async () => {
    try {
      if ((window as Window & { electronAPI?: unknown }).electronAPI) {
        await invoke("open_devtools");
      }
    } catch (error) {
      console.error("Failed to open devtools:", error);
    }
  };

  const restartOnboardingWizard = async () => {
    if (isRestartingWizard) return;
    setIsRestartingWizard(true);
    try {
      await saveSettings({ wizardCompleted: false });
      localStorage.removeItem("wizardCompleted");
      window.dispatchEvent(new Event("settings-saved"));
      await exit(0);
    } catch (error) {
      console.error("Failed to restart onboarding wizard:", error);
      setIsRestartingWizard(false);
    }
  };

  const runConnectionTests = async () => {
    setIsTestRunning(true);
    const results = {
      steam: {
        backend: { success: false, message: "", time: 0 },
        frontend: { success: false, message: "", time: 0 },
      },
      hydra: {
        backend: { success: false, message: "", time: 0 },
        frontend: { success: false, message: "", time: 0 },
      },
    };

    const testGameId = "413150";

    try {
      if ((window as Window & { electronAPI?: unknown }).electronAPI) {
        const startSteam = performance.now();
        try {
          await invoke("get_game_name", { gameId: testGameId });
          results.steam.backend = {
            success: true,
            message: "Successfully fetched game details",
            time: Math.round(performance.now() - startSteam),
          };
        } catch (e: unknown) {
          results.steam.backend = {
            success: false,
            message: String(e),
            time: Math.round(performance.now() - startSteam),
          };
        }

        const startHydra = performance.now();
        try {
          await invoke("get_game_achievements", { gameId: testGameId });
          results.hydra.backend = {
            success: true,
            message: "Successfully fetched achievements",
            time: Math.round(performance.now() - startHydra),
          };
        } catch (e: unknown) {
          results.hydra.backend = {
            success: false,
            message: String(e),
            time: Math.round(performance.now() - startHydra),
          };
        }
      } else {
        results.steam.backend.message = "Backend not available in browser mode";
        results.hydra.backend.message = "Backend not available in browser mode";
      }

      const startSteamFront = performance.now();
      try {
        const url = `${import.meta.env.VITE_STEAM_STORE_API_URL || "https://store.steampowered.com/api"}/appdetails?appids=${testGameId}`;
        const response = await tauriFetch(url, { method: "GET" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data[testGameId]?.success) {
          results.steam.frontend = {
            success: true,
            message: "Successfully fetched via Tauri HTTP",
            time: Math.round(performance.now() - startSteamFront),
          };
        } else {
          throw new Error("Invalid response structure");
        }
      } catch (e: unknown) {
        results.steam.frontend = {
          success: false,
          message: String(e),
          time: Math.round(performance.now() - startSteamFront),
        };
      }

      const startHydraFront = performance.now();
      try {
        const hydraUrl = `${import.meta.env.VITE_HYDRA_API_URL || "https://hydra-api-us-east-1.losbroxas.org"}/games/achievements?shop=steam&objectId=${testGameId}`;
        const response = await tauriFetch(hydraUrl, { method: "GET" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await response.json();
        results.hydra.frontend = {
          success: true,
          message: "Successfully fetched via Tauri HTTP",
          time: Math.round(performance.now() - startHydraFront),
        };
      } catch (e: unknown) {
        results.hydra.frontend = {
          success: false,
          message: String(e),
          time: Math.round(performance.now() - startHydraFront),
        };
      }

      setTestResults(results);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Test suite failed:", error);
    } finally {
      setIsTestRunning(false);
    }
  };

  return (
    <SettingsPage
      title="Debug"
      description="Developer tools and debug configurations."
    >
      <TestResultsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        results={testResults}
      />

      <SettingsPanel>
        <SettingsActionRow
          label="Connection Tests"
          description="Run connectivity tests against Steam and Hydra APIs (frontend vs backend)."
          actionLabel={isTestRunning ? "Testing…" : "Run Tests"}
          onAction={runConnectionTests}
          disabled={isTestRunning}
          icon={
            isTestRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : undefined
          }
        />

        <SettingsToggleRow
          label={t("settings.api.forceFrontendFetch")}
          description={t("settings.api.forceFrontendFetchDescription")}
          checked={forceFrontendFetch}
          onCheckedChange={setForceFrontendFetch}
        />

        <SettingsActionRow
          label="DevTools"
          description="Open the application developer tools."
          actionLabel="Open"
          onAction={openDevTools}
        />

        <SettingsActionRow
          label="Onboarding Wizard"
          description="Reopen the initial setup wizard on next launch."
          actionLabel={isRestartingWizard ? "Restarting…" : "Run Wizard"}
          onAction={restartOnboardingWizard}
          disabled={isRestartingWizard}
        />
      </SettingsPanel>
    </SettingsPage>
  );
};

export default DebugSettings;

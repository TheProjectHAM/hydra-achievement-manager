import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { useI18n } from "../../contexts/I18nContext";
import TestResultsModal from "../TestResultsModal";

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
  const [testResults, setTestResults] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openDevTools = async () => {
    try {
      if ((window as any).electronAPI) {
        await invoke("open_devtools");
      }
    } catch (error) {
      console.error("Failed to open devtools:", error);
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

    const testGameId = "413150"; // Stardew Valley

    try {
      // BACKEND TESTS
      if ((window as any).electronAPI) {
        // Test Steam Backend
        const startSteam = performance.now();
        try {
          await invoke("get_game_name", { gameId: testGameId });
          results.steam.backend = {
            success: true,
            message: "Successfully fetched game details",
            time: Math.round(performance.now() - startSteam),
          };
        } catch (e: any) {
          results.steam.backend = {
            success: false,
            message: e.toString(),
            time: Math.round(performance.now() - startSteam),
          };
        }

        // Test Hydra Backend
        const startHydra = performance.now();
        try {
          await invoke("get_game_achievements", { gameId: testGameId });
          results.hydra.backend = {
            success: true,
            message: "Successfully fetched achievements",
            time: Math.round(performance.now() - startHydra),
          };
        } catch (e: any) {
          results.hydra.backend = {
            success: false,
            message: e.toString(),
            time: Math.round(performance.now() - startHydra),
          };
        }
      } else {
        results.steam.backend = {
          success: false,
          message: "Backend not available in browser mode",
          time: 0,
        };
        results.hydra.backend = {
          success: false,
          message: "Backend not available in browser mode",
          time: 0,
        };
      }

      // FRONTEND TESTS (Using Tauri HTTP plugin to bypass CORS)
      // Test Steam Frontend
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
      } catch (e: any) {
        results.steam.frontend = {
          success: false,
          message: e.toString(),
          time: Math.round(performance.now() - startSteamFront),
        };
      }

      // Test Hydra Frontend
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
      } catch (e: any) {
        results.hydra.frontend = {
          success: false,
          message: e.toString(),
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
    <div className="space-y-1">
      <TestResultsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        results={testResults}
      />

      <div
        className="pt-2 pb-8 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex-1 mb-6">
          <h4
            className="text-sm font-black tracking-[0.15em] uppercase mb-1.5"
            style={{ color: "var(--text-main)" }}
          >
            Debug Settings
          </h4>
          <p
            className="text-xs font-medium leading-relaxed w-full opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            Developer tools and debug configurations.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Connection Tests */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4
                className="text-sm font-black tracking-[0.15em] uppercase mb-1.5"
                style={{ color: "var(--text-main)" }}
              >
                Connection Tests
              </h4>
              <p
                className="text-xs font-medium leading-relaxed w-full"
                style={{ color: "var(--text-muted)" }}
              >
                Run connectivity tests against Steam and Hydra APIs (Frontend vs
                Backend).
              </p>
            </div>

            <button
              onClick={runConnectionTests}
              disabled={isTestRunning}
              className={`h-9 px-4 rounded-md text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 border flex items-center gap-2 ${isTestRunning ? "opacity-50 cursor-wait" : "hover:bg-[var(--hover-bg)]"}`}
              style={{
                borderColor: "var(--border-color)",
                color: "var(--text-main)",
              }}
            >
              {isTestRunning ? (
                <>
                  <div
                    className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                    style={{
                      borderColor: "var(--text-muted)",
                      borderTopColor: "var(--text-main)",
                    }}
                  />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Run Tests</span>
              )}
            </button>
          </div>

          {/* Force Frontend Fetch */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4
                className="text-sm font-black tracking-[0.15em] uppercase mb-1.5"
                style={{ color: "var(--text-main)" }}
              >
                {t("settings.api.forceFrontendFetch")}
              </h4>
              <p
                className="text-xs font-medium leading-relaxed w-full"
                style={{ color: "var(--text-muted)" }}
              >
                {t("settings.api.forceFrontendFetchDescription")}
              </p>
            </div>

            <button
              onClick={() => setForceFrontendFetch(!forceFrontendFetch)}
              className="relative w-14 h-7 rounded-full transition-all duration-300 mt-1 shrink-0 cursor-pointer"
              style={{
                backgroundColor: forceFrontendFetch
                  ? "var(--text-main)"
                  : "var(--border-color)",
              }}
            >
              <div
                className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-all duration-300 ${
                  forceFrontendFetch ? "translate-x-7" : "translate-x-0"
                }`}
                style={{ backgroundColor: "var(--bg-color)" }}
              />
            </button>
          </div>

          {/* Open DevTools */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4
                className="text-sm font-black tracking-[0.15em] uppercase mb-1.5"
                style={{ color: "var(--text-main)" }}
              >
                DevTools
              </h4>
              <p
                className="text-xs font-medium leading-relaxed w-full"
                style={{ color: "var(--text-muted)" }}
              >
                Open the application developer tools.
              </p>
            </div>

            <button
              onClick={openDevTools}
              className="h-9 px-4 rounded-md text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 border hover:bg-[var(--hover-bg)]"
              style={{
                borderColor: "var(--border-color)",
                color: "var(--text-main)",
              }}
            >
              Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugSettings;

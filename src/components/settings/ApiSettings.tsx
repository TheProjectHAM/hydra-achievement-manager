import React, { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApiSource } from "../../types";
import { SteamBrandIcon, HydraIcon } from "../Icons";
import { useI18n } from "../../contexts/I18nContext";
import { ToastItemData } from "../ToastContainer";

interface ApiSettingsProps {
  selectedApi: ApiSource;
  setSelectedApi: (api: ApiSource) => void;
  steamApiKey: string;
  setSteamApiKey: (key: string) => void;
  steamIntegrationEnabled: boolean;
  setSteamIntegrationEnabled: (enabled: boolean) => void;
  onNotifyToast: (toast: Omit<ToastItemData, "id">) => void;
}

const ApiSettings: React.FC<ApiSettingsProps> = ({
  selectedApi,
  setSelectedApi,
  steamApiKey,
  setSteamApiKey,
  steamIntegrationEnabled,
  setSteamIntegrationEnabled,
  onNotifyToast,
}) => {
  const { t } = useI18n();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSteamMissing, setIsSteamMissing] = useState(false);
  const [steamLibPath, setSteamLibPath] = useState<string | null>(null);
  const [steamDllPath, setSteamDllPath] = useState<string | null>(null);
  const [steamFailureReason, setSteamFailureReason] = useState<string | null>(null);
  const [isSelectingVdf, setIsSelectingVdf] = useState(false);
  const [isSelectingDll, setIsSelectingDll] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [isApiDropdownOpen, setIsApiDropdownOpen] = useState(false);
  const lastSteamMissingToastReasonRef = useRef<string | null>(null);

  const canEnableIntegration = selectedApi === "steam" && !isSteamMissing;

  const isSteamClientNotRunningReason = (reason: string | null) => {
    if (!reason) return false;
    const lower = reason.toLowerCase();
    return (
      lower.includes("nosteamclient") ||
      lower.includes("steam is probably not running") ||
      lower.includes("steam client may not be running") ||
      lower.includes("cannot create ipc pipe")
    );
  };

  const maybeNotifySteamMissing = (available: boolean, reason: string | null) => {
    if (available) {
      lastSteamMissingToastReasonRef.current = null;
      return;
    }

    if (!isSteamClientNotRunningReason(reason)) return;

    const dedupeKey = reason || "steam-not-running";
    if (lastSteamMissingToastReasonRef.current === dedupeKey) return;
    lastSteamMissingToastReasonRef.current = dedupeKey;

    onNotifyToast({
      title: t("settings.api.steamNotRunningToastTitle"),
      message: t("settings.api.steamNotRunningToastMessage"),
      durationMs: 7500,
      type: "info",
      actionLabel: t("settings.api.retryConnectionButton"),
      onAction: async () => {
        await refreshAvailability();
      },
    });
  };

  useEffect(() => {
    const checkSteamAvailability = async () => {
      try {
        const details = await invoke<{
          available: boolean;
          vdfPath: string | null;
          runtimeLibPath: string | null;
          reason: string | null;
        }>("get_steam_availability_details");

        const available = !!details?.available;
        setIsSteamMissing(!available);
        setSteamLibPath(details?.vdfPath ?? null);
        setSteamDllPath(details?.runtimeLibPath ?? null);
        setSteamFailureReason(details?.reason ?? null);
        maybeNotifySteamMissing(available, details?.reason ?? null);

        if (!available) setSteamIntegrationEnabled(false);
      } catch (error) {
        console.error("Failed to check steam availability:", error);
        setIsSteamMissing(true);
        setSteamFailureReason("Failed to run Steam diagnostics");
      }
    };

    checkSteamAvailability();
  }, [setSteamIntegrationEnabled]);

  const saveManualPath = async (
    key: "steamManualVdfPath" | "steamManualDllPath",
    value: string,
  ) => {
    await invoke<void>("save_settings", {
      settings: {
        [key]: value,
      },
    });
    window.dispatchEvent(new Event("settings-saved"));
  };

  const refreshAvailability = async () => {
    try {
      const details = await invoke<{
        available: boolean;
        reason: string | null;
        vdfPath?: string | null;
        runtimeLibPath?: string | null;
      }>("get_steam_availability_details");
      setIsSteamMissing(!details?.available);
      setSteamFailureReason(details?.reason ?? null);
      if (details?.vdfPath !== undefined) setSteamLibPath(details.vdfPath);
      if (details?.runtimeLibPath !== undefined)
        setSteamDllPath(details.runtimeLibPath);
      maybeNotifySteamMissing(!!details?.available, details?.reason ?? null);
    } catch (error) {
      console.error("Failed to refresh steam availability:", error);
      setIsSteamMissing(true);
      setSteamFailureReason("Failed to run Steam diagnostics");
    }
  };

  const handlePickVdf = async () => {
    try {
      setIsSelectingVdf(true);
      const selected = await invoke<string | null>("pick_steam_vdf_file");
      if (!selected) return;
      setSteamLibPath(selected);
      await saveManualPath("steamManualVdfPath", selected);
      await refreshAvailability();
    } catch (error) {
      console.error("Failed to select Steam VDF:", error);
    } finally {
      setIsSelectingVdf(false);
    }
  };

  const handlePickDll = async () => {
    try {
      setIsSelectingDll(true);
      const selected = await invoke<string | null>("pick_steam_dll_file");
      if (!selected) return;
      setSteamDllPath(selected);
      await saveManualPath("steamManualDllPath", selected);
      await refreshAvailability();
    } catch (error) {
      console.error("Failed to select Steam DLL:", error);
    } finally {
      setIsSelectingDll(false);
    }
  };

  const integrationStatus = useMemo(() => {
    if (selectedApi !== "steam") return t("settings.api.steamIntegrationDisabled");
    if (isSteamMissing) return t("settings.api.steamIntegrationMissing");
    return steamIntegrationEnabled
      ? t("settings.api.steamIntegrationEnabled")
      : t("settings.api.steamIntegrationDisabled");
  }, [selectedApi, isSteamMissing, steamIntegrationEnabled, t]);

  const neutralBadgeStyle = {
    backgroundColor: "var(--hover-bg)",
    borderColor: "var(--border-color)",
    color: "var(--text-main)",
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-8 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex-1">
          <h4 className="text-sm font-black tracking-[0.15em] uppercase mb-1.5" style={{ color: "var(--text-main)" }}>
            {t("settings.api.title")}
          </h4>
          <p className="text-xs opacity-60 font-medium leading-relaxed max-w-md" style={{ color: "var(--text-main)" }}>
            {t("settings.api.description")}
          </p>
        </div>

        <div className="relative w-full sm:w-60 flex-shrink-0">
          <button
            onClick={() => setIsApiDropdownOpen(!isApiDropdownOpen)}
            className="w-full h-12 border rounded-md px-5 flex items-center justify-between transition-all duration-300 group shadow-sm hover:shadow-md"
            style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {selectedApiOption?.icon}
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-main)" }}>
                {selectedApiOption?.label}
              </span>
            </div>
            <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${isApiDropdownOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isApiDropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsApiDropdownOpen(false)} />
              <ul className="absolute z-40 mt-1 w-full border rounded-md shadow-2xl overflow-hidden p-1.5 animate-modal-in" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                {apiOptions.map((option) => (
                  <li key={option.id}>
                    <button
                      onClick={() => {
                        setSelectedApi(option.id);
                        setIsApiDropdownOpen(false);
                      }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${selectedApi === option.id
                        ? "bg-[var(--border-color)] text-[var(--text-main)] shadow-sm"
                        : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]"
                        }`}
                  >
                    {option.icon}
                    <span className="text-xs font-bold uppercase tracking-widest flex-grow text-left">{option.label}</span>
                      {selectedApi === option.id && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--text-main)" }} />}
                  </button>
                </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {selectedApi === "steam" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-8 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex-1">
            <h4 className="text-sm font-black tracking-[0.15em] uppercase mb-1.5" style={{ color: "var(--text-main)" }}>
              {t("settings.api.apiKeyLabel")}
            </h4>
            <p className="text-xs opacity-60 font-medium leading-relaxed max-w-md" style={{ color: "var(--text-main)" }}>
              {t("settings.api.apiKeyPlaceholder")}
            </p>
          </div>

          <div className="relative w-full sm:w-72 flex-shrink-0">
            <input
              type={showApiKey ? "text" : "password"}
              value={steamApiKey}
              onChange={(e) => setSteamApiKey(e.target.value)}
              placeholder={t("settings.api.apiKeyPlaceholder")}
              className="w-full h-12 border rounded-md pl-4 pr-20 text-sm font-semibold outline-none shadow-inner"
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--border-color)",
                color: "var(--text-main)",
              }}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-3 rounded-md border text-[10px] font-black uppercase tracking-wider"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--hover-bg)",
                color: "var(--text-main)",
              }}
            >
              {showApiKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 pt-3">
        <div
          className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
            !steamIntegrationEnabled ? "opacity-70" : "hover:shadow-lg"
          }`}
          style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-widest truncate" style={{ color: "var(--text-main)" }}>
                  {t("settings.api.steamIntegrationTitle")}
                </p>
                <span
                  className="text-[7px] font-black px-1.5 py-0.5 rounded-sm border tracking-tighter"
                  style={neutralBadgeStyle}
                >
                  BETA
                </span>
              </div>
              <p className="text-[10px] font-medium opacity-50 truncate" style={{ color: "var(--text-main)" }}>
                {t("settings.api.steamIntegrationBetaNotice")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-wider opacity-60" style={{ color: "var(--text-main)" }}>
              {integrationStatus}
            </span>
            <button
              onClick={() => {
                if (canEnableIntegration) setSteamIntegrationEnabled(!steamIntegrationEnabled);
              }}
              disabled={!canEnableIntegration}
              className={`w-9 h-5 rounded-full transition-all duration-300 relative ${
                !canEnableIntegration
                  ? "bg-gray-500/30 opacity-50 cursor-not-allowed"
                  : steamIntegrationEnabled
                    ? "bg-emerald-500"
                    : "bg-gray-500/30"
              }`}
            >
              <div
                className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${
                  steamIntegrationEnabled ? "left-[22px]" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div
            className="group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 hover:shadow-lg"
            style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-main)" }}>
                  {t("settings.api.steamLibraryPath")}
                </p>
                <p className="text-[10px] font-medium opacity-50 truncate" style={{ color: "var(--text-main)" }}>
                  {steamLibPath || "--"}
                </p>
              </div>
            </div>
            <button
              onClick={handlePickVdf}
              disabled={isSelectingVdf}
              className="h-8 px-3 rounded-md border text-[10px] font-black uppercase tracking-wider disabled:opacity-60"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--hover-bg)",
                color: "var(--text-main)",
              }}
            >
              {isSelectingVdf ? t("settings.api.selecting") : t("settings.api.selectSteamVdf")}
            </button>
          </div>

          <div
            className="group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 hover:shadow-lg"
            style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-main)" }}>
                  {t("settings.api.steamDllPath")}
                </p>
                <p className="text-[10px] font-medium opacity-50 truncate" style={{ color: "var(--text-main)" }}>
                  {steamDllPath || "--"}
                </p>
              </div>
            </div>
            <button
              onClick={handlePickDll}
              disabled={isSelectingDll}
              className="h-8 px-3 rounded-md border text-[10px] font-black uppercase tracking-wider disabled:opacity-60"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--hover-bg)",
                color: "var(--text-main)",
              }}
            >
              {isSelectingDll ? t("settings.api.selecting") : t("settings.api.selectSteamDll")}
            </button>
          </div>
        </div>

        {selectedApi !== "steam" && (
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--input-bg)" }}>
            <p className="text-xs font-medium opacity-70" style={{ color: "var(--text-main)" }}>
              {t("settings.api.steamIntegrationWarning")}
            </p>
          </div>
        )}

        {selectedApi === "steam" && isSteamMissing && (
          <div className="rounded-xl border p-4" style={{ borderColor: "rgba(239,68,68,0.35)", backgroundColor: "rgba(239,68,68,0.08)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-main)" }}>
              {t("settings.api.steamIntegrationMissing")}
            </p>
            <p className="text-xs font-medium opacity-85" style={{ color: "var(--text-main)" }}>
              {t("settings.api.steamIntegrationMissingWarning")}
            </p>
            {steamFailureReason && (
              <p className="text-[11px] font-semibold mt-2 break-words" style={{ color: "var(--text-main)" }}>
                {t("settings.api.steamIntegrationFailureReason")} {steamFailureReason}
              </p>
            )}
            <div className="mt-3 pt-3 border-t flex justify-end" style={{ borderColor: "rgba(239,68,68,0.25)" }}>
              <button
                onClick={async () => {
                  setIsRetryingConnection(true);
                  await refreshAvailability();
                  setIsRetryingConnection(false);
                }}
                disabled={isRetryingConnection}
                className="h-8 px-3 rounded-md border text-[10px] font-black uppercase tracking-wider disabled:opacity-60"
                style={{
                  borderColor: "var(--border-color)",
                  backgroundColor: "var(--hover-bg)",
                  color: "var(--text-main)",
                }}
              >
                {isRetryingConnection
                  ? t("settings.api.selecting")
                  : t("settings.api.retryConnectionButton")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiSettings;

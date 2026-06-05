import React, { useState, useEffect } from "react";
import { UpdateIcon, TagIcon } from "../Icons";
import { useTheme } from "../../contexts/ThemeContext";
import { formatDateObj } from "../../formatters";
import { useI18n } from "../../contexts/I18nContext";
import packageJson from "../../../package.json";

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const UPDATES_URL =
  import.meta.env.VITE_UPDATES_URL ||
  "https://raw.githubusercontent.com/Levynsk/hydra-achievement-manager/refs/heads/main/updates.json";

const UpdateSettings: React.FC = () => {
  const { dateFormat, timeFormat } = useTheme();
  const { t } = useI18n();
  const [updates, setUpdates] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const currentSubVersion = packageJson.versionDateTag || "";
  const currentVersionLabel = `v${packageJson.version}${currentSubVersion ? ` ${currentSubVersion}` : ""}`;

  useEffect(() => {
    tauriFetch(UPDATES_URL, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((data) => setUpdates(data.updates || []))
      .catch(() => console.error("Failed to fetch updates."));
  }, []);

  const handleCheckForUpdates = () => {
    setIsChecking(true);
    setTimeout(() => {
      setLastChecked(new Date());
      setIsChecking(false);
    }, 2000);
  };

  const lastCheckedFormatted = lastChecked
    ? formatDateObj(lastChecked, dateFormat, timeFormat)
    : t("settings.updates.never");
  const latest = updates[updates.length - 1];
  const latestSubVersion = latest?.subVersion || "";
  const isUpToDate =
    latest?.version === packageJson.version &&
    latestSubVersion === currentSubVersion;

  return (
    <div className="space-y-6">
      {/* Refined Status Container */}
      <div className="border border-border rounded-md p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm bg-muted">
        <div className="flex items-center gap-6">
          <TagIcon className="text-2xl opacity-30 text-foreground" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">
              {t("settings.updates.currentVersion").replace(
                "{version}",
                currentVersionLabel,
              )}
            </h4>
            <p className="text-xs font-medium leading-none opacity-60 text-foreground">
              {isUpToDate
                ? t("settings.updates.systemUpToDate")
                : t("settings.updates.updateAvailable")}{" "}
              — {lastCheckedFormatted}
            </p>
          </div>
        </div>

        <button
          onClick={handleCheckForUpdates}
          disabled={isChecking}
          className={`flex items-center gap-3 px-8 py-3.5 rounded-md text-xs font-semibold transition-all border shadow-lg bg-foreground text-background border-foreground ${
            isChecking ? "opacity-50 cursor-not-allowed" : "active:scale-95"
          }`}
        >
          {isChecking && <UpdateIcon className="text-sm animate-spin" />}
          {isChecking
            ? t("settings.updates.syncing")
            : t("settings.updates.checkStatus")}
        </button>
      </div>

      {/* Structured Changelog Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-4 px-1">
          <h4 className="text-xs font-semibold opacity-50 text-foreground">
            {t("settings.updates.whatsNew")}
          </h4>
          <div className="h-px flex-1 opacity-10 bg-foreground" />
        </div>

        <div className="border border-border rounded-lg overflow-hidden shadow-sm bg-muted">
          {[...updates]
            .reverse()
            .slice(0, 3)
            .map((log, index) => (
              <div
                key={`${log.version}-${log.subVersion || index}`}
                className={`p-8 ${index !== 2 ? "border-b border-border" : ""}`}
              >
                <div className="flex items-center gap-4 mb-5">
                    <span className="text-xs font-semibold italic text-foreground">
                    {`v${log.version}${log.subVersion ? ` ${log.subVersion}` : ""}`}
                  </span>
                  {log.version === packageJson.version &&
                    (log.subVersion || "") === currentSubVersion && (
                    <span className="text-[10px] font-semibold border border-border px-2 py-0.5 rounded-md opacity-60 text-foreground">
                      {t("common.active")}
                    </span>
                    )}
                </div>
                <div className="grid grid-cols-1 gap-3 border-l border-border ml-1">
                  {log.changelog.map((change, idx) => (
                    <div
                      key={idx}
                      className="flex gap-4 text-xs font-medium leading-relaxed pl-6 text-muted-foreground"
                    >
                      <span className="opacity-20">—</span>
                      <span className="opacity-90">{change}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default UpdateSettings;

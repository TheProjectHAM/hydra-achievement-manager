import React, { useState, useEffect } from "react";
import { UpdateIcon } from "../Icons";
import { useTheme } from "../../contexts/ThemeContext";
import { formatDateObj } from "../../formatters";
import { useI18n } from "../../contexts/I18nContext";
import packageJson from "../../../package.json";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { Button } from "@/components/ui/button";
import {
  SettingsPage,
  SettingsPanel,
  SettingsSection,
  StatusBadge,
} from "./shared";
import { cn } from "@/lib/utils";

const UPDATES_URL =
  import.meta.env.VITE_UPDATES_URL ||
  "https://raw.githubusercontent.com/Levynsk/hydra-achievement-manager/refs/heads/main/updates.json";

const UpdateSettings: React.FC = () => {
  const { dateFormat, timeFormat } = useTheme();
  const { t } = useI18n();
  const [updates, setUpdates] = useState<
    Array<{
      version: string;
      subVersion?: string;
      changelog: string[];
    }>
  >([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const currentSubVersion = packageJson.versionDateTag || "";
  const currentVersionLabel = `v${packageJson.version}${currentSubVersion ? ` ${currentSubVersion}` : ""}`;

  useEffect(() => {
    tauriFetch(UPDATES_URL, { method: "GET" })
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

  const recentUpdates = [...updates].reverse().slice(0, 5);

  return (
    <SettingsPage
      title={t("settings.updates.tab")}
      description={t("settings.updates.systemUpToDate")}
    >
      <SettingsPanel>
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-foreground">
                {currentVersionLabel}
              </span>
              <StatusBadge variant={isUpToDate ? "success" : "warning"}>
                {isUpToDate
                  ? t("settings.updates.systemUpToDate")
                  : t("settings.updates.updateAvailable")}
              </StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settings.updates.currentVersion").replace(
                "{version}",
                currentVersionLabel,
              )}{" "}
              · {lastCheckedFormatted}
            </p>
          </div>
          <Button
            onClick={handleCheckForUpdates}
            disabled={isChecking}
            className="shrink-0"
          >
            {isChecking && <UpdateIcon className="animate-spin" />}
            {isChecking
              ? t("settings.updates.syncing")
              : t("settings.updates.checkStatus")}
          </Button>
        </div>
      </SettingsPanel>

      <SettingsSection title={t("settings.updates.whatsNew")}>
        <div className="space-y-3">
          {recentUpdates.map((log, index) => {
            const isCurrent =
              log.version === packageJson.version &&
              (log.subVersion || "") === currentSubVersion;
            const versionLabel = `v${log.version}${log.subVersion ? ` ${log.subVersion}` : ""}`;

            return (
              <div
                key={`${log.version}-${log.subVersion || index}`}
                className={cn(
                  "rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10",
                  isCurrent && "ring-foreground/20",
                )}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {versionLabel}
                  </span>
                  {isCurrent && (
                    <StatusBadge variant="success">
                      {t("common.active")}
                    </StatusBadge>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {log.changelog.map((change, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2 text-sm text-muted-foreground"
                    >
                      <span className="text-muted-foreground/40">·</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
};

export default UpdateSettings;

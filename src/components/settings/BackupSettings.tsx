import React, { useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  applyAchievementsRestore,
  createAchievementsBackup,
  getGameAchievements,
  getGameNames,
  getSteamGames,
  isSteamAvailable,
  requestAchievements,
  previewAchievementsRestore,
} from "../../tauri-api";
import { useI18n } from "../../contexts/I18nContext";

type ConflictStrategy = "backup" | "current" | "cancel";
type SettingsStrategy = "backup" | "current" | "merge";

interface BackupGame {
  gameId: string;
  directory: string;
  achievementsCount: number;
  source: "local" | "steam";
}

interface BackupGameGroup {
  gameId: string;
  name: string;
  entries: BackupGame[];
  totalAchievements: number;
}

interface RestorePreviewItem {
  index: number;
  gameId: string;
  directory: string;
  fileFormat: string;
  backupAchievements: number;
  existingAchievements: number;
  overlappingAchievements: number;
  changedAchievements: number;
  unchangedAchievements: number;
  newAchievements: number;
  willReplace: boolean;
  isSteamEntry: boolean;
  missingBasePath: boolean;
  steamUnavailable: boolean;
  steamGameNotDetected: boolean;
  restoreBlocked: boolean;
  restoreBlockReason?: string | null;
}

interface RestoreSettingsPreview {
  included: boolean;
  totalKeys: number;
  conflictingKeys: number;
  missingKeys: number;
}

const ToggleRow: React.FC<{
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}> = ({ label, description, enabled, onChange }) => (
  <div
    className="flex items-center justify-between gap-4 rounded-lg border p-3"
    style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}
  >
    <div className="min-w-0">
      <p className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
        {label}
      </p>
      {description && (
        <p className="text-[10px] opacity-65 mt-1" style={{ color: "var(--text-main)" }}>
          {description}
        </p>
      )}
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 p-1 ${enabled ? "bg-[var(--text-main)]" : "bg-[var(--hover-bg)]"}`}
      aria-label={label}
      aria-pressed={enabled}
    >
      <div
        className={`w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${enabled ? "translate-x-5" : "translate-x-0"}`}
        style={{ backgroundColor: "var(--bg-color)" }}
      />
    </button>
  </div>
);

const ThemedCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, className = "", disabled = false }) => (
  <button
    type="button"
    onClick={() => {
      if (!disabled) onChange(!checked);
    }}
    aria-label={label}
    aria-pressed={checked}
    aria-disabled={disabled}
    className={`w-5 h-5 rounded-[3px] border flex items-center justify-center transition-all duration-200 ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    style={{
      borderColor: checked ? "var(--text-main)" : "var(--border-color)",
      backgroundColor: checked ? "var(--text-main)" : "var(--input-bg)",
      color: checked ? "var(--bg-color)" : "transparent",
    }}
  >
    <svg
      viewBox="0 0 24 24"
      className={`w-3.5 h-3.5 transition-opacity ${checked ? "opacity-100" : "opacity-0"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  </button>
);

const SteamGameLogo: React.FC<{ gameId: string; className?: string }> = ({
  gameId,
  className = "w-8 h-8",
}) => {
  const steamCdn =
    import.meta.env.VITE_STEAM_CDN_URL ||
    "https://cdn.akamai.steamstatic.com/steam/apps";

  const fallbacks = [
    `${steamCdn}/${gameId}/capsule_sm_120.jpg`,
    `${steamCdn}/${gameId}/capsule_184x69.jpg`,
    `${steamCdn}/${gameId}/capsule_231x87.jpg`,
    `${steamCdn}/${gameId}/capsule_467x181.jpg`,
    `${steamCdn}/${gameId}/capsule_616x353.jpg`,
    `${steamCdn}/${gameId}/library_hero.jpg`,
    `${steamCdn}/${gameId}/library_600x900.jpg`,
    `${steamCdn}/${gameId}/header.jpg`,
    `${steamCdn}/${gameId}/header_292x136.jpg`,
  ];

  return (
    <div
      className={`${className} rounded-md border overflow-hidden shrink-0`}
      style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}
    >
      <img
        src={`${steamCdn}/${gameId}/logo.png`}
        alt=""
        className="w-full h-full object-contain"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (!img.dataset.index) img.dataset.index = "0";
          const index = parseInt(img.dataset.index);
          if (index < fallbacks.length) {
            img.src = fallbacks[index];
            img.dataset.index = String(index + 1);
          }
        }}
      />
    </div>
  );
};

const CompactDropdown = <T extends string>({
  value,
  options,
  onChange,
  fullWidth = false,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
  fullWidth?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) || options[0];

  return (
    <div className={`relative ${fullWidth ? "w-full" : "w-44"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full h-9 border rounded-md px-3 flex items-center justify-between transition-all duration-300 shadow-sm hover:shadow-md"
        style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: "var(--text-main)" }}>
          {selected?.label}
        </span>
        <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul className="absolute z-40 mt-1 w-full border rounded-md shadow-2xl overflow-hidden p-1.5 animate-modal-in" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
            {options.map((opt) => (
              <li key={opt.id}>
                <button
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-md transition-colors text-left ${value === opt.id ? "bg-[var(--border-color)] text-[var(--text-main)] shadow-sm" : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]"}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">{opt.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const BackupSettings: React.FC = () => {
  const { t } = useI18n();

  const [groups, setGroups] = useState<BackupGameGroup[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());
  const [loadingGames, setLoadingGames] = useState(false);
  const [includeSettingsInBackup, setIncludeSettingsInBackup] = useState(true);

  const [creatingBackup, setCreatingBackup] = useState(false);
  const [lastBackupPath, setLastBackupPath] = useState<string>("");

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [backupPath, setBackupPath] = useState<string>("");
  const [previewItems, setPreviewItems] = useState<RestorePreviewItem[]>([]);
  const [previewNames, setPreviewNames] = useState<Record<string, string>>({});
  const [selectedRestoreIndices, setSelectedRestoreIndices] = useState<Set<number>>(new Set());
  const [conflictStrategyByIndex, setConflictStrategyByIndex] = useState<Record<number, ConflictStrategy>>({});

  const [settingsPreview, setSettingsPreview] = useState<RestoreSettingsPreview>({
    included: false,
    totalKeys: 0,
    conflictingKeys: 0,
    missingKeys: 0,
  });
  const [restoreSettingsEnabled, setRestoreSettingsEnabled] = useState(true);
  const [settingsStrategy, setSettingsStrategy] = useState<SettingsStrategy>("backup");

  const [restoring, setRestoring] = useState(false);

  const hasAnyGame = groups.length > 0;
  const allSelected = hasAnyGame && selectedGameIds.size === groups.length;
  const selectedBackupCount = selectedGameIds.size;

  const isRestoreItemBlocked = (item: RestorePreviewItem) =>
    item.steamUnavailable ||
    item.steamGameNotDetected ||
    (item.missingBasePath && !restoreSettingsEnabled);

  const selectableRestoreIndices = useMemo(
    () =>
      new Set(
        previewItems
          .filter((item) => !isRestoreItemBlocked(item))
          .map((item) => item.index),
      ),
    [previewItems, restoreSettingsEnabled],
  );

  const selectedRestoreCount = useMemo(
    () =>
      Array.from(selectedRestoreIndices).filter((index) =>
        selectableRestoreIndices.has(index),
      ).length,
    [selectedRestoreIndices, selectableRestoreIndices],
  );

  const restoreConflicts = useMemo(
    () =>
      previewItems.filter((item) => {
        if (!selectedRestoreIndices.has(item.index) || !item.willReplace) return false;
        return (conflictStrategyByIndex[item.index] || "backup") === "backup";
      }).length,
    [previewItems, selectedRestoreIndices, conflictStrategyByIndex],
  );

  useEffect(() => {
    setSelectedRestoreIndices((prev) => {
      const next = new Set(
        Array.from(prev).filter((index) => selectableRestoreIndices.has(index)),
      );
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [selectableRestoreIndices]);

  const loadBackupCandidates = async () => {
    setLoadingGames(true);
    try {
      const games = await requestAchievements();
      let steamGames: any[] = [];
      try {
        const steamAvailable = await isSteamAvailable();
        if (steamAvailable) {
          steamGames = await getSteamGames();
        }
      } catch (error) {
        console.warn("Steam unavailable for backup candidates:", error);
      }
      const steamNameById: Record<string, string> = Object.fromEntries(
        steamGames
          .filter((sg) => sg?.gameId && sg?.name)
          .map((sg) => [String(sg.gameId), String(sg.name)]),
      );

      const ids = Array.from(new Set((games || []).map((g: any) => g.gameId)));
      for (const sg of steamGames) {
        if (!ids.includes(sg.gameId)) {
          ids.push(sg.gameId);
        }
      }
      const names = ids.length > 0 ? await getGameNames(ids) : {};

      const groupedMap = new Map<string, BackupGameGroup>();
      for (const g of games || []) {
        const current = groupedMap.get(g.gameId);
        const entry: BackupGame = {
          gameId: g.gameId,
          directory: g.directory,
          achievementsCount: Array.isArray(g.achievements) ? g.achievements.length : 0,
          source: "local",
        };

        if (!current) {
          groupedMap.set(g.gameId, {
            gameId: g.gameId,
            name: names[g.gameId] || steamNameById[g.gameId] || g.gameId,
            entries: [entry],
            totalAchievements: entry.achievementsCount,
          });
        } else {
          current.entries.push(entry);
          current.totalAchievements += entry.achievementsCount;
        }
      }

      for (const sg of steamGames) {
        const current = groupedMap.get(sg.gameId);
        const entry: BackupGame = {
          gameId: sg.gameId,
          directory: "steam://",
          achievementsCount: Number(sg.achievementsTotal || 0),
          source: "steam",
        };

        if (!current) {
          groupedMap.set(sg.gameId, {
            gameId: sg.gameId,
            name: names[sg.gameId] || sg.name || sg.gameId,
            entries: [entry],
            totalAchievements: entry.achievementsCount,
          });
        } else if (!current.entries.some((e) => e.source === "steam")) {
          if (!names[sg.gameId] && sg.name && current.name === current.gameId) {
            current.name = sg.name;
          }
          current.entries.push(entry);
          current.totalAchievements += entry.achievementsCount;
        }
      }

      const next = Array.from(groupedMap.values())
        .filter((group) => group.totalAchievements > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      setGroups(next);
      setSelectedGameIds(new Set(next.map((g) => g.gameId)));
    } catch (error) {
      console.error("Failed to load backup candidates:", error);
      setGroups([]);
      setSelectedGameIds(new Set());
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    loadBackupCandidates();
  }, []);

  const toggleGame = (gameId: string) => {
    setSelectedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const toggleSelectAllBackup = () => {
    if (allSelected) {
      setSelectedGameIds(new Set());
    } else {
      setSelectedGameIds(new Set(groups.map((g) => g.gameId)));
    }
  };

  const handleCreateBackup = async () => {
    if (selectedBackupCount === 0 && !includeSettingsInBackup) return;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const suggestedName = `backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.ham`;

    const selectedPath = await save({
      title: t("settings.backup.saveDialogTitle"),
      defaultPath: suggestedName,
      filters: [{ name: "HAM Backup", extensions: ["ham"] }],
    });

    if (!selectedPath || typeof selectedPath !== "string") return;

    setCreatingBackup(true);
    try {
      const selectedIds = Array.from(selectedGameIds);
      const selectedSteamIds = groups
        .filter((group) => selectedGameIds.has(group.gameId) && group.entries.some((e) => e.source === "steam"))
        .map((group) => group.gameId);

      let steamEntries: Array<{
        gameId: string;
        achievements: Array<{ name: string; achieved: boolean; unlockTime: number }>;
      }> = [];

      if (selectedSteamIds.length > 0) {
        const steamAvailable = await isSteamAvailable().catch(() => false);
        if (steamAvailable) {
          const resolved = await Promise.all(
            selectedSteamIds.map(async (gameId) => {
              try {
                const result = await getGameAchievements(gameId);
                const achievements = (result?.achievements || [])
                  .map((ach: any) => {
                    const name = ach.name || ach.apiname;
                    if (!name) return null;
                    const achieved = ach.achieved === true || ach.achieved === 1;
                    const unlockTime = Number(ach.unlockTime ?? ach.unlocktime ?? 0) || 0;
                    return { name, achieved, unlockTime };
                  })
                  .filter(Boolean) as Array<{ name: string; achieved: boolean; unlockTime: number }>;

                return { gameId, achievements };
              } catch (error) {
                console.warn(`Failed to snapshot Steam achievements for ${gameId}:`, error);
                return null;
              }
            }),
          );

          steamEntries = resolved.filter((item): item is { gameId: string; achievements: Array<{ name: string; achieved: boolean; unlockTime: number }> } => Boolean(item));
        }
      }

      const result = await createAchievementsBackup(
        selectedPath,
        selectedIds,
        includeSettingsInBackup,
        steamEntries,
      );
      setLastBackupPath(result.outputPath);
    } catch (error) {
      console.error("Failed to create backup:", error);
      setLastBackupPath("");
    } finally {
      setCreatingBackup(false);
    }
  };

  const loadRestorePreview = async (path: string) => {
    setLoadingPreview(true);
    try {
      const preview = await previewAchievementsRestore(path);
      setBackupPath(path);
      setPreviewItems(preview.items || []);
      setSettingsPreview(preview.settings || { included: false, totalKeys: 0, conflictingKeys: 0, missingKeys: 0 });
      const nextRestoreSettingsEnabled = preview.settings?.included ?? false;
      setRestoreSettingsEnabled(nextRestoreSettingsEnabled);
      setSettingsStrategy("backup");

      const allIndices = new Set(
        (preview.items || [])
          .filter((i: RestorePreviewItem) => !i.steamUnavailable && !(i.missingBasePath && !nextRestoreSettingsEnabled))
          .map((i: RestorePreviewItem) => i.index),
      );
      setSelectedRestoreIndices(allIndices);

      const nextStrategies: Record<number, ConflictStrategy> = {};
      for (const item of preview.items || []) {
        nextStrategies[item.index] = "backup";
      }
      setConflictStrategyByIndex(nextStrategies);

      const ids = Array.from(new Set((preview.items || []).map((i: RestorePreviewItem) => i.gameId)));
      const names = ids.length > 0 ? await getGameNames(ids) : {};
      const previewHasSteam = (preview.items || []).some((i: RestorePreviewItem) => i.directory?.startsWith("steam://"));
      if (previewHasSteam) {
        try {
          const steamAvailable = await isSteamAvailable();
          if (steamAvailable) {
            const steamGames = await getSteamGames();
            for (const sg of steamGames || []) {
              if (!names[sg.gameId] && sg.name) {
                names[sg.gameId] = sg.name;
              }
            }
          }
        } catch (error) {
          console.warn("Failed to resolve Steam names for preview:", error);
        }
      }
      setPreviewNames(names);
    } catch (error) {
      console.error("Failed to preview backup restore:", error);
      setBackupPath("");
      setPreviewItems([]);
      setPreviewNames({});
      setSelectedRestoreIndices(new Set());
      setConflictStrategyByIndex({});
      setSettingsPreview({ included: false, totalKeys: 0, conflictingKeys: 0, missingKeys: 0 });
      setRestoreSettingsEnabled(false);
      setSettingsStrategy("backup");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleChooseBackupFile = async () => {
    const selected = await open({
      title: t("settings.backup.openDialogTitle"),
      multiple: false,
      filters: [{ name: "HAM Backup", extensions: ["ham", "json"] }],
    });

    if (!selected || typeof selected !== "string") return;
    loadRestorePreview(selected);
  };

  const toggleRestoreEntry = (index: number) => {
    const item = previewItems.find((it) => it.index === index);
    if (item && isRestoreItemBlocked(item)) return;

    setSelectedRestoreIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleRestoreAll = () => {
    const available = Array.from(selectableRestoreIndices);
    if (available.length === 0) {
      setSelectedRestoreIndices(new Set());
      return;
    }

    const allSelectableSelected = available.every((idx) => selectedRestoreIndices.has(idx));
    if (allSelectableSelected) {
      setSelectedRestoreIndices(new Set());
    } else {
      setSelectedRestoreIndices(new Set(available));
    }
  };

  const setStrategyForIndex = (index: number, strategy: ConflictStrategy) => {
    setConflictStrategyByIndex((prev) => ({ ...prev, [index]: strategy }));
  };

  const handleApplyRestore = async () => {
    if (!backupPath) return;

    const selectedIndices = Array.from(selectedRestoreIndices).filter((index) =>
      selectableRestoreIndices.has(index),
    );
    if (selectedIndices.length === 0) return;

    const confirmed = window.confirm(
      t("settings.backup.restoreConfirm", { count: selectedIndices.length }),
    );
    if (!confirmed) return;

    setRestoring(true);
    try {
      const conflictResolutions = selectedIndices.map((index) => ({
        index,
        strategy: (conflictStrategyByIndex[index] || "backup") as ConflictStrategy,
      }));

      await applyAchievementsRestore(
        backupPath,
        selectedIndices,
        conflictResolutions,
        restoreSettingsEnabled && settingsPreview.included,
        settingsStrategy,
      );

      await loadBackupCandidates();
      await loadRestorePreview(backupPath);
    } catch (error) {
      console.error("Failed to restore backup:", error);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6 animate-modal-in">
      <div className="border rounded-xl p-6 shadow-sm space-y-4" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-main)" }}>
            {t("settings.backup.createSection")}
          </h5>
          <button
            onClick={loadBackupCandidates}
            disabled={loadingGames}
            className="h-9 px-4 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all disabled:opacity-50"
            style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
          >
            {loadingGames ? t("settings.backup.loading") : t("settings.backup.refresh")}
          </button>
        </div>

        <ToggleRow
          label={t("settings.backup.includeSettings")}
          description={t("settings.backup.includeSettingsDesc")}
          enabled={includeSettingsInBackup}
          onChange={setIncludeSettingsInBackup}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold opacity-70" style={{ color: "var(--text-main)" }}>
            {t("settings.backup.selectedGames", { count: selectedBackupCount })}
          </p>
          <button
            onClick={toggleSelectAllBackup}
            disabled={!hasAnyGame}
            className="h-8 px-3 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all disabled:opacity-40"
            style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
          >
            {allSelected ? t("settings.backup.unselectAll") : t("settings.backup.selectAll")}
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto rounded-md border" style={{ borderColor: "var(--border-color)" }}>
          {groups.length === 0 ? (
            <div className="p-4 text-[11px] opacity-60" style={{ color: "var(--text-main)" }}>
              {t("settings.backup.noGames")}
            </div>
          ) : (
            groups.map((group) => (
              <label
                key={group.gameId}
                className="flex items-center justify-between gap-3 p-3 border-b last:border-b-0 cursor-pointer"
                style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
              >
                <div className="min-w-0 flex items-center gap-3">
                  <SteamGameLogo gameId={group.gameId} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{group.name}</p>
                    <p className="text-[10px] opacity-60 truncate">
                      {group.gameId} • {group.entries.length} {t("settings.backup.entries")} • {group.totalAchievements} {t("common.achievements").toLowerCase()}
                    </p>
                  </div>
                </div>
                <ThemedCheckbox
                  checked={selectedGameIds.has(group.gameId)}
                  onChange={() => toggleGame(group.gameId)}
                  label={group.name}
                />
              </label>
            ))
          )}
        </div>

        <div
          className="border rounded-lg p-3 flex items-center justify-between gap-4"
          style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70" style={{ color: "var(--text-main)" }}>
              {t("settings.backup.createSection")}
            </p>
            <p className="text-[11px] font-semibold opacity-80" style={{ color: "var(--text-main)" }}>
              {t("settings.backup.selectedGames", { count: selectedBackupCount })}
            </p>
            {lastBackupPath && (
              <p className="text-[10px] opacity-60 truncate max-w-[420px]" style={{ color: "var(--text-main)" }}>
                {t("settings.backup.lastBackupPath")}: {lastBackupPath}
              </p>
            )}
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup || (selectedBackupCount === 0 && !includeSettingsInBackup)}
            className="h-11 px-5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all disabled:opacity-50 shrink-0"
            style={{
              borderColor: "var(--text-main)",
              backgroundColor: "var(--text-main)",
              color: "var(--bg-color)",
            }}
          >
            {creatingBackup ? t("settings.backup.creating") : t("settings.backup.createButton")}
          </button>
        </div>
      </div>

      <div className="border rounded-xl p-6 shadow-sm space-y-4" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-main)" }}>
            {t("settings.backup.restoreSection")}
          </h5>
          <button
            onClick={handleChooseBackupFile}
            disabled={loadingPreview || restoring}
            className="h-9 px-4 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all disabled:opacity-50"
            style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
          >
            {loadingPreview ? t("settings.backup.loading") : t("settings.backup.chooseFile")}
          </button>
        </div>

        {backupPath && (
          <p className="text-[11px] opacity-70 break-all" style={{ color: "var(--text-main)" }}>
            {backupPath}
          </p>
        )}

        {settingsPreview.included && (
          <div className="border rounded-lg p-4 space-y-3" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[11px] font-bold" style={{ color: "var(--text-main)" }}>
                <ThemedCheckbox
                  checked={restoreSettingsEnabled}
                  onChange={setRestoreSettingsEnabled}
                  label={t("settings.backup.restoreSettings")}
                />
                {t("settings.backup.restoreSettings")}
              </label>
              <p className="text-[10px] opacity-70" style={{ color: "var(--text-main)" }}>
                {t("settings.backup.settingsStats", {
                  total: settingsPreview.totalKeys,
                  conflicts: settingsPreview.conflictingKeys,
                  missing: settingsPreview.missingKeys,
                })}
              </p>
            </div>

            {restoreSettingsEnabled && (
              <CompactDropdown
                value={settingsStrategy}
                onChange={(next) => setSettingsStrategy(next as SettingsStrategy)}
                fullWidth
                options={[
                  { id: "backup", label: t("settings.backup.settingsStrategyBackup") },
                  { id: "current", label: t("settings.backup.settingsStrategyCurrent") },
                  { id: "merge", label: t("settings.backup.settingsStrategyMerge") },
                ]}
              />
            )}
          </div>
        )}

        {previewItems.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold opacity-70" style={{ color: "var(--text-main)" }}>
                {t("settings.backup.selectedEntries", { count: selectedRestoreCount })}
              </p>
              <button
                onClick={toggleRestoreAll}
                className="h-8 px-3 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all"
                style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
              >
                {selectedRestoreCount === selectableRestoreIndices.size
                  ? t("settings.backup.unselectAll")
                  : t("settings.backup.selectAll")}
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border" style={{ borderColor: "var(--border-color)" }}>
              {previewItems.map((item) => {
                const name = previewNames[item.gameId] || item.gameId;
                const strategy = conflictStrategyByIndex[item.index] || "backup";
                const isBlocked = isRestoreItemBlocked(item);
                const warning =
                  item.steamUnavailable
                    ? t("settings.backup.restoreWarningSteamUnavailable")
                    : item.steamGameNotDetected
                      ? t("settings.backup.restoreWarningSteamNotDetected")
                    : item.missingBasePath
                      ? restoreSettingsEnabled
                        ? t("settings.backup.restoreWarningMissingPathWithSettings")
                        : t("settings.backup.restoreWarningMissingPathWithoutSettings")
                      : "";
                const blockedBadge = item.steamUnavailable
                  ? t("settings.backup.restoreBlockedSteam")
                  : item.steamGameNotDetected
                    ? t("settings.backup.restoreBlockedSteamNotDetected")
                  : item.missingBasePath && !restoreSettingsEnabled
                    ? t("settings.backup.restoreBlockedPath")
                    : "";

                return (
                  <div
                    key={item.index}
                    className="p-3 border-b last:border-b-0"
                    style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className={`flex items-start gap-3 min-w-0 flex-1 ${isBlocked ? "cursor-not-allowed opacity-85" : "cursor-pointer"}`}>
                        <ThemedCheckbox
                          checked={selectedRestoreIndices.has(item.index)}
                          onChange={() => toggleRestoreEntry(item.index)}
                          label={name}
                          className="mt-0.5"
                          disabled={isBlocked}
                        />
                        <div className="min-w-0 flex items-start gap-3">
                          <SteamGameLogo gameId={item.gameId} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{name}</p>
                            <p className="text-[10px] opacity-60 truncate">{item.gameId} • {item.directory}</p>
                            <p className="text-[10px] opacity-70">
                              {t("settings.backup.restoreStats", {
                                backup: item.backupAchievements,
                                existing: item.existingAchievements,
                                overlap: item.overlappingAchievements,
                                changed: item.changedAchievements,
                              })}
                            </p>
                            {warning && (
                              <p className="text-[10px] font-semibold mt-1" style={{ color: "var(--warning-color, #d97706)" }}>
                                {warning}
                              </p>
                            )}
                          </div>
                        </div>
                      </label>

                      {isBlocked ? (
                        <span className="text-[10px] font-bold opacity-80 whitespace-nowrap">{blockedBadge}</span>
                      ) : item.willReplace ? (
                        <CompactDropdown
                          value={strategy}
                          onChange={(next) => setStrategyForIndex(item.index, next as ConflictStrategy)}
                          options={[
                            { id: "backup", label: t("settings.backup.keepBackup") },
                            { id: "current", label: t("settings.backup.keepCurrent") },
                            { id: "cancel", label: t("settings.backup.cancelOnConflict") },
                          ]}
                        />
                      ) : (
                        <span className="text-[10px] font-bold opacity-70">{t("settings.backup.noConflict")}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold opacity-80" style={{ color: "var(--text-main)" }}>
                {t("settings.backup.conflictsSelected", { count: restoreConflicts })}
              </p>

              <button
                onClick={handleApplyRestore}
                disabled={restoring || selectedRestoreCount === 0}
                className="h-11 px-5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all disabled:opacity-50"
                style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
              >
                {restoring ? t("settings.backup.restoring") : t("settings.backup.restoreButton")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BackupSettings;

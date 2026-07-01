import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getSteamLogoFallbackUrls, getSteamLogoUrl } from "@/lib/steam-assets";
import { Archive, CheckCircle2, FileUp, RefreshCw, RotateCcw, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ConflictStrategy = "backup" | "current" | "cancel";
type SettingsStrategy = "backup" | "current" | "merge";

interface BackupGame {
  gameId: string;
  directory: string;
  achievementsCount: number;
  unlockedCount: number;
  source: "local" | "steam";
}

interface BackupGameGroup {
  gameId: string;
  name: string;
  entries: BackupGame[];
  totalAchievements: number;
  unlockedAchievements: number;
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
  <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/50 p-3">
    <div className="min-w-0">
      <p className="text-xs font-semibold text-foreground">
        {label}
      </p>
      {description && (
        <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative h-6 w-11 rounded-full p-1 transition-all duration-300 ${enabled ? "bg-foreground" : "bg-accent"}`}
      aria-label={label}
      aria-pressed={enabled}
    >
      <div className={`w-4 h-4 rounded-full bg-background transition-all duration-300 shadow-sm ${enabled ? "translate-x-5" : "translate-x-0"}`} />
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
    className={`w-5 h-5 rounded-[3px] border flex items-center justify-center transition-all duration-200 ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${checked ? "bg-foreground text-background border-foreground" : "bg-muted border-border text-transparent"} ${className}`}
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

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, description, badge, action, children }) => (
  <section className="overflow-hidden rounded-xl border border-border bg-card/60">
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex flex-shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            {badge}
          </div>
          {description && <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
    <div className="border-t border-border p-3">
      {children}
    </div>
  </section>
);

const SteamGameLogo: React.FC<{ gameId: string; className?: string }> = ({
  gameId,
  className = "w-8 h-8",
}) => {
  const fallbacks = getSteamLogoFallbackUrls(gameId);

  return (
    <div
      className={`${className} rounded-md border border-border overflow-hidden shrink-0 bg-background`}
    >
      <img
        src={getSteamLogoUrl(gameId)}
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
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value) || options[0];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    },
    [open],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  return (
    <div ref={containerRef} className={`relative ${fullWidth ? "w-full" : "w-44"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full h-9 border border-border rounded-md px-3 flex items-center justify-between transition-all duration-300 shadow-sm hover:shadow-md bg-muted"
      >
        <span className="text-[10px] font-semibold truncate text-foreground">
          {selected?.label}
        </span>
        <svg className={`w-3.5 h-3.5 transition-transform duration-300 text-muted-foreground ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul className="absolute z-40 mt-1 w-full border border-border rounded-md shadow-2xl overflow-hidden p-1.5 animate-modal-in bg-card">
            {options.map((opt) => (
              <li key={opt.id}>
                <button
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-md transition-colors text-left ${value === opt.id ? "bg-border text-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                >
                  <span className="text-[10px] font-semibold">{opt.label}</span>
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasAnyGame = groups.length > 0;
  const allSelected = hasAnyGame && selectedGameIds.size === groups.length;
  const selectedBackupCount = selectedGameIds.size;

  const isRestoreItemBlocked = (item: RestorePreviewItem) =>
    item.restoreBlocked || (item.missingBasePath && !restoreSettingsEnabled);

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

  const willReplaceCount = useMemo(
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
        const achievements = Array.isArray(g.achievements) ? g.achievements : [];
        const entry: BackupGame = {
          gameId: g.gameId,
          directory: g.directory,
          achievementsCount: achievements.length,
          unlockedCount: achievements.filter((a: any) => a.achieved).length,
          source: "local",
        };

        if (!current) {
          groupedMap.set(g.gameId, {
            gameId: g.gameId,
            name: names[g.gameId] || steamNameById[g.gameId] || g.gameId,
            entries: [entry],
            totalAchievements: entry.achievementsCount,
            unlockedAchievements: entry.unlockedCount,
          });
        } else {
          current.entries.push(entry);
          current.totalAchievements += entry.achievementsCount;
          current.unlockedAchievements += entry.unlockedCount;
        }
      }

      for (const sg of steamGames) {
        const current = groupedMap.get(sg.gameId);
        const entry: BackupGame = {
          gameId: sg.gameId,
          directory: "steam://",
          achievementsCount: Number(sg.achievementsTotal || 0),
          unlockedCount: Number(sg.achievementsCurrent || 0),
          source: "steam",
        };

        if (!current) {
          groupedMap.set(sg.gameId, {
            gameId: sg.gameId,
            name: names[sg.gameId] || sg.name || sg.gameId,
            entries: [entry],
            totalAchievements: entry.achievementsCount,
            unlockedAchievements: entry.unlockedCount,
          });
        } else if (!current.entries.some((e) => e.source === "steam")) {
          if (!names[sg.gameId] && sg.name && current.name === current.gameId) {
            current.name = sg.name;
          }
          current.entries.push(entry);
          current.totalAchievements += entry.achievementsCount;
          current.unlockedAchievements += entry.unlockedCount;
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
      setSuccessMessage(t("settings.backup.backupCreated"));
      setTimeout(() => setSuccessMessage(null), 5000);
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

      setSuccessMessage(
        t("settings.backup.restoreSuccess", {
          restored: selectedIndices.length,
          skipped: 0,
        }),
      );
      setTimeout(() => setSuccessMessage(null), 5000);

      await loadBackupCandidates();
      await loadRestorePreview(backupPath);
    } catch (error) {
      console.error("Failed to restore backup:", error);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-3 animate-modal-in">
      {successMessage && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-[11px] font-semibold text-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
          {successMessage}
        </div>
      )}
      <SectionCard
        icon={<Archive className="h-4 w-4" />}
        title={t("settings.backup.createSection")}
        description={t("settings.backup.selectedGames", { count: selectedBackupCount })}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={loadBackupCandidates}
              disabled={loadingGames}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-[10px] font-semibold text-foreground disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3 w-3", loadingGames && "animate-spin")} />
              {loadingGames ? t("settings.backup.loading") : t("settings.backup.refresh")}
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={creatingBackup || (selectedBackupCount === 0 && !includeSettingsInBackup)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-foreground bg-foreground px-3 text-[10px] font-semibold text-background disabled:opacity-50"
            >
              <Archive className="h-3 w-3" />
              {creatingBackup ? t("settings.backup.creating") : t("settings.backup.createButton")}
            </button>
          </div>
        }
      >
        <div className="space-y-3">

        <ToggleRow
          label={t("settings.backup.includeSettings")}
          description={t("settings.backup.includeSettingsDesc")}
          enabled={includeSettingsInBackup}
          onChange={setIncludeSettingsInBackup}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t("settings.backup.selectedGames", { count: selectedBackupCount })}
          </p>
          <button
            onClick={toggleSelectAllBackup}
            disabled={!hasAnyGame}
            className="h-8 rounded-md border border-border bg-background px-3 text-[10px] font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-40"
          >
            {allSelected ? t("settings.backup.unselectAll") : t("settings.backup.selectAll")}
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-background">
          {groups.length === 0 ? (
            <div className="p-4 text-[11px] font-medium text-muted-foreground">
              {t("settings.backup.noGames")}
            </div>
          ) : (
            groups.map((group) => (
              <label
                key={group.gameId}
                className="flex cursor-pointer items-center justify-between gap-3 border-b border-border p-3 text-foreground transition-colors last:border-b-0 hover:bg-accent/45"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <SteamGameLogo gameId={group.gameId} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{group.name}</p>
                    <p className="truncate text-[10px] font-medium text-muted-foreground">
                      {group.gameId} • {group.entries.length} {t("settings.backup.entries")} • {group.unlockedAchievements}/{group.totalAchievements} {t("common.achievements").toLowerCase()}
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

        {lastBackupPath && (
          <p className="truncate px-1 text-[10px] font-medium text-muted-foreground">
            {t("settings.backup.lastBackupPath")}: {lastBackupPath}
          </p>
        )}
        </div>
      </SectionCard>

      <SectionCard
        icon={<FileUp className="h-4 w-4" />}
        title={t("settings.backup.restoreSection")}
        description={backupPath || t("settings.backup.chooseFile")}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleChooseBackupFile}
              disabled={loadingPreview || restoring}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-[10px] font-semibold text-foreground disabled:opacity-60"
            >
              <FileUp className="h-3 w-3" />
              {loadingPreview ? t("settings.backup.loading") : t("settings.backup.chooseFile")}
            </button>
            {previewItems.length > 0 && (
              <button
                onClick={handleApplyRestore}
                disabled={restoring || selectedRestoreCount === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-foreground bg-foreground px-3 text-[10px] font-semibold text-background disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                {restoring ? t("settings.backup.restoring") : t("settings.backup.restoreButton")}
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-3">

        {settingsPreview.included && (
          <div className="space-y-3 rounded-md border border-border bg-muted/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Settings2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <label className="flex min-w-0 cursor-pointer items-center gap-2 text-[11px] font-semibold text-foreground">
                  <ThemedCheckbox
                    checked={restoreSettingsEnabled}
                    onChange={setRestoreSettingsEnabled}
                    label={t("settings.backup.restoreSettings")}
                  />
                  <span className="truncate">{t("settings.backup.restoreSettings")}</span>
                </label>
              </div>
              <p className="text-[10px] font-medium text-muted-foreground">
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
              <p className="text-[11px] font-semibold text-muted-foreground">
                {t("settings.backup.selectedEntries", { count: selectedRestoreCount })}
              </p>
              <button
                onClick={toggleRestoreAll}
                className="h-8 rounded-md border border-border bg-background px-3 text-[10px] font-semibold text-foreground transition-colors hover:bg-accent"
              >
                {selectedRestoreCount === selectableRestoreIndices.size
                  ? t("settings.backup.unselectAll")
                  : t("settings.backup.selectAll")}
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-background">
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
                    className="border-b border-border p-3 text-foreground transition-colors last:border-b-0 hover:bg-accent/45"
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
                    <p className="text-xs font-semibold truncate">{name}</p>
                            <p className="truncate text-[10px] font-medium text-muted-foreground">{item.gameId} • {item.directory}</p>
                            <p className="text-[10px] font-medium text-muted-foreground">
                              {t("settings.backup.restoreStats", {
                                backup: item.backupAchievements,
                                existing: item.existingAchievements,
                                overlap: item.overlappingAchievements,
                                changed: item.changedAchievements,
                              })}
                            </p>
                            {warning && (
                              <p className="mt-1 text-[10px] font-semibold text-amber-600">
                                {warning}
                              </p>
                            )}
                          </div>
                        </div>
                      </label>

                      {isBlocked ? (
                        <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">{blockedBadge}</span>
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
                        <span className="text-[10px] font-semibold text-muted-foreground">{t("settings.backup.noConflict")}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 px-1">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {t("settings.backup.conflictsSelected", { count: willReplaceCount })}
              </p>
            </div>
          </>
        )}
        </div>
      </SectionCard>
    </div>
  );
};

export default BackupSettings;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SteamBrandIcon, HydraIcon } from '../Icons';
import { useI18n } from '../../contexts/I18nContext';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { getHydraConnectionProfile, getSteamConnectionProfile } from '../../tauri-api';

type ConnectionKind = 'steam' | 'hydra';

interface ConnectionProfile {
  id: string;
  kind: ConnectionKind;
  displayName: string;
  avatarInitials: string;
  avatarUrl?: string | null;
}

interface ConnectionsSettingsProps {
  steamIntegrationEnabled: boolean;
  setSteamIntegrationEnabled: (enabled: boolean) => void;
  hideSteamGamesWithoutAchievements: boolean;
  setHideSteamGamesWithoutAchievements: (enabled: boolean) => void;
}

let cachedConnectionProfiles: ConnectionProfile[] | null = null;

const getServiceIcon = (kind: ConnectionKind) => {
  if (kind === 'steam') return <SteamBrandIcon className="h-3.5 w-3.5" />;
  return <HydraIcon className="h-3.5 w-3.5" />;
};

interface ConnectionCardProps {
  profile: ConnectionProfile;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children?: React.ReactNode;
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({ profile, expanded, onToggle, badge, children }) => (
  <div className="rounded-xl border border-border bg-card overflow-hidden transition-shadow duration-300 ease-out hover:shadow-sm">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-3 text-left transition-colors duration-300 ease-out hover:bg-accent/45"
    >
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden text-xs font-bold text-muted-foreground ring-1 ring-border">
        {profile.avatarUrl ? (
          <img
            key={profile.avatarUrl}
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              (e.currentTarget.nextElementSibling as HTMLElement | null)?.classList.remove('hidden');
            }}
          />
        ) : null}
        <span className={cn('text-xs font-bold', profile.avatarUrl && 'hidden')}>{profile.avatarInitials}</span>
      </div>

      <div className="flex flex-1 items-center gap-2 min-w-0 text-foreground">
        <span className="text-muted-foreground flex-shrink-0">{getServiceIcon(profile.kind)}</span>
        <span className="text-sm font-medium truncate">{profile.displayName}</span>
        {badge && (
          <Badge variant="secondary" className="text-[10px] flex-shrink-0">
            {badge}
          </Badge>
        )}
      </div>

      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-300 ease-out hover:bg-accent">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn(
            'block h-4 w-4 origin-center transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            expanded && 'rotate-90'
          )}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </button>

    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      )}
    >
      <div className="overflow-hidden">
        <div className="border-t border-border p-3">{children}</div>
      </div>
    </div>
  </div>
);

const SettingsRow: React.FC<{
  title: string;
  description?: string;
  trailing: React.ReactNode;
  disabled?: boolean;
}> = ({ title, description, trailing, disabled = false }) => (
  <div className={cn('flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 p-3', disabled && 'opacity-60')}>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-foreground truncate">{title}</p>
      {description && <p className="mt-0.5 text-[10px] font-medium text-muted-foreground leading-relaxed">{description}</p>}
    </div>
    <div className="flex-shrink-0">{trailing}</div>
  </div>
);

const ConnectionsSettings: React.FC<ConnectionsSettingsProps> = ({
  steamIntegrationEnabled,
  setSteamIntegrationEnabled,
  hideSteamGamesWithoutAchievements,
  setHideSteamGamesWithoutAchievements,
}) => {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<ConnectionProfile[]>(cachedConnectionProfiles ?? []);
  const [expandedCard, setExpandedCard] = useState<string | null>(cachedConnectionProfiles?.[0]?.id ?? null);
  const [isSteamMissing, setIsSteamMissing] = useState(false);
  const [steamLibPath, setSteamLibPath] = useState<string | null>(null);
  const [steamDllPath, setSteamDllPath] = useState<string | null>(null);
  const [steamFailureReason, setSteamFailureReason] = useState<string | null>(null);
  const [subAccounts, setSubAccounts] = useState<Array<{ personaName: string; steamId64: string; accountName?: string | null; avatarUrl?: string | null; profileUrl: string }>>([]);
  const [isSelectingVdf, setIsSelectingVdf] = useState(false);
  const [isSelectingDll, setIsSelectingDll] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const lastSteamMissingReasonRef = useRef<string | null>(null);

  const canEnableSteamIntegration = !isSteamMissing;
  const connectedCount = profiles.length;

  const isSteamClientNotRunningReason = (reason: string | null) => {
    if (!reason) return false;
    const lower = reason.toLowerCase();
    return (
      lower.includes('nosteamclient') ||
      lower.includes('steam is probably not running') ||
      lower.includes('steam client may not be running') ||
      lower.includes('cannot create ipc pipe')
    );
  };

  const maybeLogSteamMissing = (available: boolean, reason: string | null) => {
    if (available) {
      lastSteamMissingReasonRef.current = null;
      return;
    }

    if (!isSteamClientNotRunningReason(reason)) return;
    const dedupeKey = reason || 'steam-not-running';
    if (lastSteamMissingReasonRef.current === dedupeKey) return;
    lastSteamMissingReasonRef.current = dedupeKey;
    console.info('Steam connection is unavailable:', reason);
  };

  const refreshAvailability = async () => {
    try {
      const details = await invoke<{
        available: boolean;
        reason: string | null;
        vdfPath?: string | null;
        runtimeLibPath?: string | null;
      }>('get_steam_availability_details');

      const available = !!details?.available;
      setIsSteamMissing(!available);
      setSteamFailureReason(details?.reason ?? null);
      if (details?.vdfPath !== undefined) setSteamLibPath(details.vdfPath);
      if (details?.runtimeLibPath !== undefined) setSteamDllPath(details.runtimeLibPath);
      maybeLogSteamMissing(available, details?.reason ?? null);
    } catch (error) {
      console.error('Failed to refresh Steam availability:', error);
      setIsSteamMissing(true);
      setSteamFailureReason('Failed to run Steam diagnostics');
    }
  };

  const saveManualPath = async (
    key: 'steamManualVdfPath' | 'steamManualDllPath',
    value: string,
  ) => {
    await invoke<void>('save_settings', { settings: { [key]: value } });
    window.dispatchEvent(new Event('settings-saved'));
  };

  const handlePickVdf = async () => {
    try {
      setIsSelectingVdf(true);
      const selected = await invoke<string | null>('pick_steam_vdf_file');
      if (!selected) return;
      setSteamLibPath(selected);
      await saveManualPath('steamManualVdfPath', selected);
      await refreshAvailability();
    } catch (error) {
      console.error('Failed to select Steam VDF:', error);
    } finally {
      setIsSelectingVdf(false);
    }
  };

  const handlePickDll = async () => {
    try {
      setIsSelectingDll(true);
      const selected = await invoke<string | null>('pick_steam_dll_file');
      if (!selected) return;
      setSteamDllPath(selected);
      await saveManualPath('steamManualDllPath', selected);
      await refreshAvailability();
    } catch (error) {
      console.error('Failed to select Steam runtime:', error);
    } finally {
      setIsSelectingDll(false);
    }
  };

  const integrationStatus = useMemo(() => {
    if (isSteamMissing) return t('settings.api.steamIntegrationMissing');
    return steamIntegrationEnabled
      ? t('settings.api.steamIntegrationEnabled')
      : t('settings.api.steamIntegrationDisabled');
  }, [isSteamMissing, steamIntegrationEnabled, t]);

  useEffect(() => {
    let cancelled = false;

    const loadConnectionProfiles = async () => {
      try {
        const [hydraProfile, steamProfile] = await Promise.all([
          getHydraConnectionProfile(),
          getSteamConnectionProfile(),
        ]);
        if (cancelled) return;

        const nextProfiles: ConnectionProfile[] = [];

        if (steamProfile) {
          const displayName = steamProfile.personaName || steamProfile.accountName || 'Steam';
          nextProfiles.push({
            id: 'steam-main',
            kind: 'steam',
            displayName,
            avatarInitials: displayName.slice(0, 2).toUpperCase(),
            avatarUrl: steamProfile.avatarUrl,
          });
          setSubAccounts(steamProfile.subAccounts ?? []);
        } else {
          setSubAccounts([]);
        }

        if (hydraProfile) {
          const displayName = hydraProfile.displayName || 'Hydra';
          nextProfiles.push({
            id: 'hydra-default',
            kind: 'hydra',
            displayName,
            avatarInitials: displayName.slice(0, 2).toUpperCase(),
            avatarUrl: hydraProfile.profileImageUrl,
          });
        }

        cachedConnectionProfiles = nextProfiles;
        setProfiles(nextProfiles);
        setExpandedCard(current => current ?? nextProfiles[0]?.id ?? null);
      } catch (error) {
        console.warn('Failed to load connection profiles:', error);
      }
    };

    loadConnectionProfiles();
    refreshAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 animate-modal-in">
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-foreground">
          {t('settings.connections.title')}
        </h4>
        <p className="text-xs font-medium opacity-60 leading-relaxed text-foreground">
          {t('settings.connections.description')}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">{t('settings.connections.accounts')}</p>
          <Badge variant="secondary" className="text-[10px]">
            {connectedCount} {t('settings.connections.connected')}
          </Badge>
        </div>

        <div className="space-y-2">
          {profiles.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Nenhuma conexão local encontrada.
              </p>
            </div>
          )}

          {profiles.map(profile => (
            <ConnectionCard
              key={profile.id}
              profile={profile}
              expanded={expandedCard === profile.id}
              onToggle={() => setExpandedCard(expandedCard === profile.id ? null : profile.id)}
              badge={profile.kind === 'steam' && subAccounts.length > 0 ? `+${subAccounts.length}` : undefined}
            >
              {profile.kind === 'steam' ? (
                <div className="space-y-2">
                  {subAccounts.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {t('settings.connections.connectedAccounts', { count: subAccounts.length })}
                      </p>
                      <div className="space-y-1">
                        {subAccounts.map(sub => (
                          <a
                            key={sub.steamId64}
                            href={sub.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-2 transition-colors hover:bg-accent"
                          >
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden text-[10px] font-bold text-muted-foreground ring-1 ring-border">
                              {sub.avatarUrl ? (
                                <img
                                  src={sub.avatarUrl}
                                  alt={sub.personaName}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    (e.currentTarget.nextElementSibling as HTMLElement | null)?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <span className={cn('text-[10px] font-bold', sub.avatarUrl && 'hidden')}>
                                {(sub.personaName || sub.accountName || '?').slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-xs font-medium text-foreground truncate">
                              {sub.personaName || sub.accountName || sub.steamId64}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <SettingsRow
                    title={t('settings.api.steamIntegrationTitle')}
                    description={t('settings.api.steamIntegrationBetaNotice')}
                    disabled={!canEnableSteamIntegration}
                    trailing={
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {integrationStatus}
                        </span>
                        <Switch
                          size="sm"
                          checked={steamIntegrationEnabled}
                          disabled={!canEnableSteamIntegration}
                          onCheckedChange={setSteamIntegrationEnabled}
                        />
                      </div>
                    }
                  />

                  <SettingsRow
                    title={t('settings.api.hideSteamGamesWithoutAchievements')}
                    description={t('settings.api.hideSteamGamesWithoutAchievementsDesc')}
                    trailing={
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {hideSteamGamesWithoutAchievements ? t('settings.api.hidden') : t('settings.api.visible')}
                        </span>
                        <Switch
                          size="sm"
                          checked={hideSteamGamesWithoutAchievements}
                          onCheckedChange={setHideSteamGamesWithoutAchievements}
                        />
                      </div>
                    }
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    <SettingsRow
                      title={t('settings.api.steamLibraryPath')}
                      description={steamLibPath || '--'}
                      trailing={
                        <button
                          onClick={handlePickVdf}
                          disabled={isSelectingVdf}
                          className="h-8 px-3 rounded-md border border-border text-[10px] font-semibold disabled:opacity-60 bg-accent text-foreground"
                        >
                          {isSelectingVdf ? t('settings.api.selecting') : t('settings.api.selectSteamVdf')}
                        </button>
                      }
                    />

                    <SettingsRow
                      title={t('settings.api.steamDllPath')}
                      description={steamDllPath || '--'}
                      trailing={
                        <button
                          onClick={handlePickDll}
                          disabled={isSelectingDll}
                          className="h-8 px-3 rounded-md border border-border text-[10px] font-semibold disabled:opacity-60 bg-accent text-foreground"
                        >
                          {isSelectingDll ? t('settings.api.selecting') : t('settings.api.selectSteamDll')}
                        </button>
                      }
                    />
                  </div>

                  {isSteamMissing && (
                    <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                      <p className="text-xs font-semibold mb-1 text-foreground">
                        {t('settings.api.steamIntegrationMissing')}
                      </p>
                      <p className="text-xs font-medium opacity-85 text-foreground">
                        {t('settings.api.steamIntegrationMissingWarning')}
                      </p>
                      {steamFailureReason && (
                        <p className="text-[11px] font-semibold mt-2 break-words text-foreground">
                          {t('settings.api.steamIntegrationFailureReason')} {steamFailureReason}
                        </p>
                      )}
                      <div className="mt-3 pt-3 border-t flex justify-end" style={{ borderColor: 'rgba(239,68,68,0.25)' }}>
                        <button
                          onClick={async () => {
                            setIsRetryingConnection(true);
                            await refreshAvailability();
                            setIsRetryingConnection(false);
                          }}
                          disabled={isRetryingConnection}
                          className="h-8 px-3 rounded-md border border-border text-[10px] font-semibold disabled:opacity-60 bg-accent text-foreground"
                        >
                          {isRetryingConnection
                            ? t('settings.api.selecting')
                            : t('settings.api.retryConnectionButton')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">
                  Nenhuma configuração disponível para o Hydra por enquanto.
                </p>
              )}
            </ConnectionCard>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConnectionsSettings;

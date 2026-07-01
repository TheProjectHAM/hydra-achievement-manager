import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SteamBrandIcon, HydraIcon, RetroAchievementsIcon } from '../Icons';
import { useI18n } from '../../contexts/I18nContext';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getHydraConnectionProfile, getRetroAchievementsConnectionProfile, getSteamConnectionProfile, loadSettings, loginRetroAchievementsRuntimeWithPassword, testRetroAchievementsConnection } from '../../tauri-api';
import { SteamAchievementSource } from '../../types';

type ConnectionKind = 'steam' | 'hydra' | 'retroachievements';

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
  steamAchievementSource: SteamAchievementSource;
  setSteamAchievementSource: (source: SteamAchievementSource) => void;
  hideSteamGamesWithoutAchievements: boolean;
  setHideSteamGamesWithoutAchievements: (enabled: boolean) => void;
}

let cachedConnectionProfiles: ConnectionProfile[] | null = null;

const getServiceIcon = (kind: ConnectionKind) => {
  if (kind === 'steam') return <SteamBrandIcon className="h-3.5 w-3.5" />;
  if (kind === 'retroachievements') return <RetroAchievementsIcon className="h-3.5 w-3.5" />;
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
  steamAchievementSource,
  setSteamAchievementSource,
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
  const [retroUsername, setRetroUsername] = useState('');
  const [retroApiKey, setRetroApiKey] = useState('');
  const [retroStatus, setRetroStatus] = useState<string | null>(null);
  const [retroRuntimePassword, setRetroRuntimePassword] = useState('');
  const [retroRuntimeStatus, setRetroRuntimeStatus] = useState<string | null>(null);
  const [hasRetroRuntimeToken, setHasRetroRuntimeToken] = useState(false);
  const [isRetroRuntimeLoggingIn, setIsRetroRuntimeLoggingIn] = useState(false);
  const [retroWebCookie, setRetroWebCookie] = useState('');
  const [retroXsrfToken, setRetroXsrfToken] = useState('');
  const [retroWebSessionStatus, setRetroWebSessionStatus] = useState<string | null>(null);
  const [savedRetroUsername, setSavedRetroUsername] = useState('');
  const [savedRetroApiKey, setSavedRetroApiKey] = useState('');
  const lastSteamMissingReasonRef = useRef<string | null>(null);
  const lastRetroValidationKeyRef = useRef<string | null>(null);
  const retroValidationRunRef = useRef(0);

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

  const saveRetroCredentials = async () => {
    const username = retroUsername.trim();
    const apiKey = retroApiKey.trim();
    await invoke<void>('save_settings', {
      settings: {
        retroAchievementsUsername: username,
        retroAchievementsApiKey: apiKey,
      },
    });
    setSavedRetroUsername(username);
    setSavedRetroApiKey(apiKey);
    window.dispatchEvent(new Event('settings-saved'));
    setRetroStatus('RetroAchievements credentials saved.');
  };

  const handleRetroRuntimeLogin = async () => {
    const username = retroUsername.trim();
    const password = retroRuntimePassword;
    if (!username || !password) {
      setRetroRuntimeStatus('Enter your RetroAchievements username and password.');
      return;
    }

    try {
      setIsRetroRuntimeLoggingIn(true);
      setRetroRuntimeStatus('Logging in to RetroAchievements...');
      const result = await loginRetroAchievementsRuntimeWithPassword(username, password);
      await invoke<void>('save_settings', {
        settings: {
          retroAchievementsUsername: result.username || username,
          retroAchievementsRuntimeToken: result.token,
        },
      });
      setRetroUsername(result.username || username);
      setSavedRetroUsername(result.username || username);
      setRetroRuntimePassword('');
      setHasRetroRuntimeToken(true);
      window.dispatchEvent(new Event('settings-saved'));
      setRetroRuntimeStatus('Login successful. Token saved locally; password was not saved.');
    } catch (error) {
      console.error('RetroAchievements runtime login failed:', error);
      setHasRetroRuntimeToken(false);
      setRetroRuntimeStatus(`Login failed: ${String(error)}`);
    } finally {
      setIsRetroRuntimeLoggingIn(false);
    }
  };

  const saveRetroWebSession = async () => {
    await invoke<void>('save_settings', {
      settings: {
        retroAchievementsWebCookie: retroWebCookie.trim(),
        retroAchievementsXsrfToken: retroXsrfToken.trim(),
      },
    });
    window.dispatchEvent(new Event('settings-saved'));
    setRetroWebSessionStatus(t('settings.connections.retroWebSessionSaved'));
  };

  const upsertRetroProfile = (profile?: { username?: string; displayName?: string; avatarUrl?: string | null } | null) => {
    const displayName = profile?.displayName || profile?.username || 'RetroAchievements';
    setProfiles(current => {
      const withoutRetro = current.filter(item => item.kind !== 'retroachievements');
      const next = [
        ...withoutRetro,
        {
          id: 'retroachievements-default',
          kind: 'retroachievements' as const,
          displayName,
          avatarInitials: 'RA',
          avatarUrl: profile?.avatarUrl,
        },
      ];
      cachedConnectionProfiles = next;
      return next;
    });
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
        const [hydraResult, retroResult, steamResult] = await Promise.allSettled([
          getHydraConnectionProfile(),
          getRetroAchievementsConnectionProfile(),
          getSteamConnectionProfile(),
        ]);
        if (cancelled) return;

        const hydraProfile = hydraResult.status === 'fulfilled' ? hydraResult.value : null;
        const retroProfile = retroResult.status === 'fulfilled' ? retroResult.value : null;
        const steamProfile = steamResult.status === 'fulfilled' ? steamResult.value : null;

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

        const retroDisplayName = retroProfile?.displayName || retroProfile?.username || 'RetroAchievements';
        nextProfiles.push({
          id: 'retroachievements-default',
          kind: 'retroachievements',
          displayName: retroDisplayName,
          avatarInitials: 'RA',
          avatarUrl: retroProfile?.avatarUrl,
        });
        if (retroProfile) {
          setRetroStatus(`Connected as ${retroProfile.displayName || retroProfile.username}`);
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

    loadSettings()
      .then((settings) => {
        if (cancelled) return;
        setRetroUsername(settings?.retroAchievementsUsername || '');
        setRetroApiKey(settings?.retroAchievementsApiKey || '');
        setSavedRetroUsername(settings?.retroAchievementsUsername || '');
        setSavedRetroApiKey(settings?.retroAchievementsApiKey || '');
        setHasRetroRuntimeToken(!!settings?.retroAchievementsRuntimeToken);
        setRetroWebCookie(settings?.retroAchievementsWebCookie || '');
        setRetroXsrfToken(settings?.retroAchievementsXsrfToken || '');
        if (settings?.retroAchievementsRuntimeToken) {
          setRetroRuntimeStatus(t('settings.connections.retroRuntimeTokenSaved'));
        }
        if (settings?.retroAchievementsWebCookie) {
          setRetroWebSessionStatus(t('settings.connections.retroWebSessionSaved'));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const username = retroUsername.trim();
    const apiKey = retroApiKey.trim();

    if (!username || !apiKey) {
      lastRetroValidationKeyRef.current = null;
      setRetroStatus(username || apiKey ? 'Enter username and API key to validate automatically.' : null);
      upsertRetroProfile(null);
      return;
    }

    const validationKey = `${username}:${apiKey}`;
    if (lastRetroValidationKeyRef.current === validationKey) {
      return;
    }

    const runId = retroValidationRunRef.current + 1;
    retroValidationRunRef.current = runId;
    setRetroStatus('Validating RetroAchievements credentials...');

    const timeout = window.setTimeout(async () => {
      try {
        const profile = await testRetroAchievementsConnection(username, apiKey);
        if (retroValidationRunRef.current !== runId) return;

        lastRetroValidationKeyRef.current = validationKey;
        await invoke<void>('save_settings', {
          settings: {
            retroAchievementsUsername: username,
            retroAchievementsApiKey: apiKey,
          },
        });
        setSavedRetroUsername(username);
        setSavedRetroApiKey(apiKey);
        window.dispatchEvent(new Event('settings-saved'));
        upsertRetroProfile(profile);
        setRetroStatus(`Connected as ${profile.displayName || profile.username}`);
      } catch (error) {
        if (retroValidationRunRef.current !== runId) return;
        console.warn('Automatic RetroAchievements validation failed:', error);
        setRetroStatus('Invalid RetroAchievements credentials.');
        upsertRetroProfile(null);
      }
    }, 850);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [retroUsername, retroApiKey]);

  const isRetroSaved =
    retroUsername.trim() === savedRetroUsername &&
    retroApiKey.trim() === savedRetroApiKey;

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
                    title={t('settings.connections.steamAchievementSource')}
                    description={t('settings.connections.steamAchievementSourceDesc')}
                    trailing={
                      <div className="flex rounded-md border border-border bg-background p-0.5">
                        {([
                          ['steamworks', t('settings.connections.steamworksSource'), t('settings.connections.steamworksSourceTooltip')],
                          ['steamapi', t('settings.connections.steamApiSource'), t('settings.connections.steamApiSourceTooltip')],
                        ] as const).map(([value, label, tooltip]) => (
                          <TooltipProvider key={value} delay={250}>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <button
                                    type="button"
                                    onClick={() => setSteamAchievementSource(value)}
                                    className={cn(
                                      'h-7 px-2.5 rounded text-[10px] font-semibold transition-colors',
                                      steamAchievementSource === value
                                        ? 'bg-accent text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                    )}
                                  >
                                    {label}
                                  </button>
                                }
                              />
                              <TooltipContent className="max-w-64 text-center leading-relaxed" side="top">
                                {tooltip}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
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
              ) : profile.kind === 'retroachievements' ? (
                <div className="space-y-2">
                  <SettingsRow
                    title={t('settings.connections.retroUsername')}
                    description={t('settings.connections.retroUsernameDesc')}
                    trailing={
                      <input
                        value={retroUsername}
                        onChange={(event) => setRetroUsername(event.target.value)}
                        className="h-8 w-48 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
                        placeholder="username"
                      />
                    }
                  />
                  <SettingsRow
                    title={t('settings.connections.retroApiKey')}
                    description={t('settings.connections.retroApiKeyDesc')}
                    trailing={
                      <input
                        value={retroApiKey}
                        onChange={(event) => setRetroApiKey(event.target.value)}
                        className="h-8 w-48 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
                        placeholder="API key"
                        type="password"
                      />
                    }
                  />
                  <SettingsRow
                    title={t('settings.connections.retroRuntimeLogin')}
                    description={hasRetroRuntimeToken
                      ? t('settings.connections.retroRuntimeLoginSavedDesc')
                      : t('settings.connections.retroRuntimeLoginDesc')}
                    trailing={
                      <div className="flex items-center gap-2">
                        <input
                          value={retroRuntimePassword}
                          onChange={(event) => setRetroRuntimePassword(event.target.value)}
                          className="h-8 w-48 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
                          placeholder="password"
                          type="password"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={handleRetroRuntimeLogin}
                          disabled={isRetroRuntimeLoggingIn || !retroUsername.trim() || !retroRuntimePassword}
                          className="h-8 px-3 rounded-md border border-border text-[10px] font-semibold disabled:opacity-70 bg-accent text-foreground"
                        >
                          {isRetroRuntimeLoggingIn ? t('settings.connections.retroRuntimeLoggingIn') : hasRetroRuntimeToken ? t('settings.connections.retroRuntimeRenewToken') : t('settings.connections.retroRuntimeLoginButton')}
                        </button>
                      </div>
                    }
                  />
                  <SettingsRow
                    title={t('settings.connections.retroWebSession')}
                    description={retroWebCookie.trim()
                      ? t('settings.connections.retroWebSessionDesc')
                      : t('settings.connections.retroWebSessionMissingDesc')}
                    trailing={
                      <div className="flex flex-col gap-2 sm:w-[28rem]">
                        <input
                          value={retroWebCookie}
                          onChange={(event) => setRetroWebCookie(event.target.value)}
                          className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
                          placeholder={t('settings.connections.retroWebCookiePlaceholder')}
                          type="password"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            value={retroXsrfToken}
                            onChange={(event) => setRetroXsrfToken(event.target.value)}
                            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
                            placeholder={t('settings.connections.retroXsrfPlaceholder')}
                            type="password"
                          />
                          <button
                            type="button"
                            onClick={saveRetroWebSession}
                            disabled={!retroWebCookie.trim()}
                            className="h-8 px-3 rounded-md border border-border text-[10px] font-semibold disabled:opacity-70 bg-accent text-foreground"
                          >
                            {t('settings.connections.retroWebSessionSave')}
                          </button>
                        </div>
                      </div>
                    }
                  />
                  {retroStatus && (
                    <p className="text-[11px] font-semibold text-muted-foreground">{retroStatus}</p>
                  )}
                  {retroRuntimeStatus && (
                    <p className="text-[11px] font-semibold text-muted-foreground">{retroRuntimeStatus}</p>
                  )}
                  {retroWebSessionStatus && (
                    <p className="text-[11px] font-semibold text-muted-foreground">{retroWebSessionStatus}</p>
                  )}
                  {!retroWebCookie.trim() && (
                    <p className="text-[11px] font-semibold text-amber-500">{t('settings.connections.retroResetDeleteDisabled')}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={saveRetroCredentials}
                      disabled={isRetroSaved}
                      className="h-8 px-3 rounded-md border border-border text-[10px] font-semibold disabled:opacity-70 bg-accent text-foreground"
                    >
                      {isRetroSaved ? 'Saved' : 'Save'}
                    </button>
                  </div>
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

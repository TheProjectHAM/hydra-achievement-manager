import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SteamBrandIcon, HydraIcon, RetroAchievementsIcon } from '../Icons';
import { useI18n } from '../../contexts/I18nContext';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle2, Database, Eye, EyeOff, FolderOpen, Globe2, KeyRound, Loader2, LockKeyhole, RefreshCw, SlidersHorizontal, UserRound } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  AccordionCard,
  InlineFieldRow,
  SettingsPage,
  SettingsSection,
  Switch,
} from './shared';
import { getHydraConnectionProfile, getHydraDbPath, getRetroAchievementsConnectionProfile, getSteamConnectionProfile, loadSettings, loginRetroAchievementsRuntimeWithPassword, loginRetroAchievementsWebSession, saveSettings, testRetroAchievementsConnection } from '../../tauri-api';
import { SteamAchievementSource } from '../../types';

type ConnectionKind = 'steam' | 'hydra' | 'retroachievements';

interface ConnectionProfile {
  id: string;
  kind: ConnectionKind;
  displayName: string;
  avatarInitials: string;
  avatarUrl?: string | null;
  available: boolean;
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

const createDefaultConnectionProfiles = (): ConnectionProfile[] => [
  {
    id: 'steam-main',
    kind: 'steam',
    displayName: 'Steam',
    avatarInitials: 'ST',
    avatarUrl: null,
    available: false,
  },
  {
    id: 'hydra-default',
    kind: 'hydra',
    displayName: 'Hydra',
    avatarInitials: 'HY',
    avatarUrl: null,
    available: false,
  },
  {
    id: 'retroachievements-default',
    kind: 'retroachievements',
    displayName: 'RetroAchievements',
    avatarInitials: 'RA',
    avatarUrl: null,
    available: true,
  },
];

const getServiceIcon = (kind: ConnectionKind) => {
  if (kind === 'steam') return <SteamBrandIcon className="h-3.5 w-3.5" />;
  if (kind === 'retroachievements') return <RetroAchievementsIcon className="h-3.5 w-3.5" />;
  return <HydraIcon className="h-3.5 w-3.5" />;
};

const ConnectionsSettings: React.FC<ConnectionsSettingsProps> = ({
  steamIntegrationEnabled,
  setSteamIntegrationEnabled,
  steamAchievementSource,
  setSteamAchievementSource,
  hideSteamGamesWithoutAchievements,
  setHideSteamGamesWithoutAchievements,
}) => {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<ConnectionProfile[]>(() => cachedConnectionProfiles ?? createDefaultConnectionProfiles());
  const [expandedCard, setExpandedCard] = useState<string | null>(() => cachedConnectionProfiles?.[0]?.id ?? 'steam-main');
  const [isSteamMissing, setIsSteamMissing] = useState(true);
  const [steamLibPath, setSteamLibPath] = useState<string | null>(null);
  const [steamDllPath, setSteamDllPath] = useState<string | null>(null);
  const [steamFailureReason, setSteamFailureReason] = useState<string | null>(null);
  const [subAccounts, setSubAccounts] = useState<Array<{ personaName: string; steamId64: string; accountName?: string | null; avatarUrl?: string | null; profileUrl: string }>>([]);
  const [isSelectingVdf, setIsSelectingVdf] = useState(false);
  const [isSelectingDll, setIsSelectingDll] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [retroUsername, setRetroUsername] = useState('');
  const [retroApiKey, setRetroApiKey] = useState('');
  const [showRetroApiKey, setShowRetroApiKey] = useState(false);
  const [retroStatus, setRetroStatus] = useState<string | null>(null);
  const [retroRuntimePassword, setRetroRuntimePassword] = useState('');
  const [showRetroPassword, setShowRetroPassword] = useState(false);
  const [retroRuntimeStatus, setRetroRuntimeStatus] = useState<string | null>(null);
  const [hasRetroRuntimeToken, setHasRetroRuntimeToken] = useState(false);
  const [isRetroRuntimeLoggingIn, setIsRetroRuntimeLoggingIn] = useState(false);
  const [retroWebCookie, setRetroWebCookie] = useState('');
  const [retroWebSessionStatus, setRetroWebSessionStatus] = useState<string | null>(null);
  const [isRetroWebSessionLoggingIn, setIsRetroWebSessionLoggingIn] = useState(false);
  const [retroDisclaimerAccepted, setRetroDisclaimerAccepted] = useState(false);
  const [retroDisclaimerChecked, setRetroDisclaimerChecked] = useState(false);
  const [steamDisclaimerAccepted, setSteamDisclaimerAccepted] = useState(false);
  const [steamDisclaimerChecked, setSteamDisclaimerChecked] = useState(false);
  const [savedRetroUsername, setSavedRetroUsername] = useState('');
  const [savedRetroApiKey, setSavedRetroApiKey] = useState('');
  const [savedRetroPassword, setSavedRetroPassword] = useState('');
  const [hydraDbPath, setHydraDbPath] = useState('');
  const [hydraDefaultPath, setHydraDefaultPath] = useState('');
  const [isHydraSelecting, setIsHydraSelecting] = useState(false);
  const lastSteamMissingReasonRef = useRef<string | null>(null);
  const lastRetroValidationKeyRef = useRef<string | null>(null);
  const retroValidationRunRef = useRef(0);

  const canEnableSteamIntegration = !isSteamMissing;

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
        retroAchievementsPassword: retroRuntimePassword,
      },
    });
    setSavedRetroUsername(username);
    setSavedRetroApiKey(apiKey);
    setSavedRetroPassword(retroRuntimePassword);
    window.dispatchEvent(new Event('settings-saved'));
    setRetroStatus(null);
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
          retroAchievementsPassword: password,
        },
      });
      setRetroUsername(result.username || username);
      setSavedRetroUsername(result.username || username);
      setSavedRetroPassword(password);
      setHasRetroRuntimeToken(true);
      window.dispatchEvent(new Event('settings-saved'));
      setRetroRuntimeStatus(null);
    } catch (error) {
      console.error('RetroAchievements runtime login failed:', error);
      setHasRetroRuntimeToken(false);
      setRetroRuntimeStatus(`Login failed: ${String(error)}`);
    } finally {
      setIsRetroRuntimeLoggingIn(false);
    }
  };

  const handleRetroWebSessionLogin = async () => {
    try {
      setIsRetroWebSessionLoggingIn(true);
      setRetroWebSessionStatus(t('settings.connections.retroWebSessionLoggingIn'));
      const result = await loginRetroAchievementsWebSession();
      setRetroWebCookie(result.cookie);
      await invoke<void>('save_settings', {
        settings: {
          retroAchievementsWebCookie: result.cookie,
          retroAchievementsXsrfToken: result.xsrfToken,
        },
      });
      window.dispatchEvent(new Event('settings-saved'));
      setRetroWebSessionStatus(null);
    } catch (error) {
      console.error('RetroAchievements web session login failed:', error);
      setRetroWebSessionStatus(`Web session login failed: ${String(error)}`);
    } finally {
      setIsRetroWebSessionLoggingIn(false);
    }
  };

  const acceptRetroDisclaimer = async () => {
    await invoke<void>('save_settings', {
      settings: {
        retroAchievementsDisclaimerAccepted: true,
      },
    });
    setRetroDisclaimerAccepted(true);
    setRetroDisclaimerChecked(false);
    window.dispatchEvent(new Event('settings-saved'));
  };

  const acceptSteamDisclaimer = async () => {
    await invoke<void>('save_settings', {
      settings: {
        steamDisclaimerAccepted: true,
      },
    });
    setSteamDisclaimerAccepted(true);
    setSteamDisclaimerChecked(false);
    window.dispatchEvent(new Event('settings-saved'));
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
          available: true,
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

        getHydraDbPath()
          .then(path => { if (!cancelled) setHydraDefaultPath(path); })
          .catch(() => {});

        const nextProfiles: ConnectionProfile[] = [];

        const steamDisplayName = steamProfile?.personaName || steamProfile?.accountName || 'Steam';
        if (steamProfile) {
          setSubAccounts(steamProfile.subAccounts ?? []);
        } else {
          setSubAccounts([]);
        }
        nextProfiles.push({
          id: 'steam-main',
          kind: 'steam',
          displayName: steamDisplayName,
          avatarInitials: steamProfile ? steamDisplayName.slice(0, 2).toUpperCase() : 'ST',
          avatarUrl: steamProfile?.avatarUrl,
          available: !!steamProfile,
        });

        const hydraDisplayName = hydraProfile?.displayName || 'Hydra';
        nextProfiles.push({
          id: 'hydra-default',
          kind: 'hydra',
          displayName: hydraDisplayName,
          avatarInitials: hydraProfile ? hydraDisplayName.slice(0, 2).toUpperCase() : 'HY',
          avatarUrl: hydraProfile?.profileImageUrl,
          available: !!hydraProfile,
        });

        const retroDisplayName = retroProfile?.displayName || retroProfile?.username || 'RetroAchievements';
        nextProfiles.push({
          id: 'retroachievements-default',
          kind: 'retroachievements',
          displayName: retroDisplayName,
          avatarInitials: 'RA',
          avatarUrl: retroProfile?.avatarUrl,
          available: true,
        });
        if (retroProfile) setRetroStatus(null);

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
        setRetroRuntimePassword(settings?.retroAchievementsPassword || '');
        setSavedRetroUsername(settings?.retroAchievementsUsername || '');
        setSavedRetroApiKey(settings?.retroAchievementsApiKey || '');
        setSavedRetroPassword(settings?.retroAchievementsPassword || '');
        setHydraDbPath(settings?.hydraDbPath || '');
        setHasRetroRuntimeToken(!!settings?.retroAchievementsRuntimeToken);
        setRetroWebCookie(settings?.retroAchievementsWebCookie || '');
        setRetroDisclaimerAccepted(!!settings?.retroAchievementsDisclaimerAccepted);
        setSteamDisclaimerAccepted(!!settings?.steamDisclaimerAccepted);
        if (settings?.retroAchievementsRuntimeToken) setRetroRuntimeStatus(null);
        if (settings?.retroAchievementsWebCookie) setRetroWebSessionStatus(null);
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
        setRetroStatus(null);
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
    retroApiKey.trim() === savedRetroApiKey &&
    retroRuntimePassword === savedRetroPassword;
  const hasRetroUsername = !!retroUsername.trim();
  const hasRetroPassword = !!retroRuntimePassword;
  const hasRetroApiKey = !!retroApiKey.trim();
  const hasRetroWebSession = !!retroWebCookie.trim();

  return (
    <SettingsPage
      title={t('settings.connections.title')}
      description={t('settings.connections.description')}
    >
      <SettingsSection>
        <div className="mb-3 px-1">
          <p className="text-sm font-medium text-foreground">{t('settings.connections.accounts')}</p>
        </div>

        <div className="space-y-2">
          {profiles.map(profile => (
            <AccordionCard
              key={profile.id}
              expanded={expandedCard === profile.id}
              onToggle={() => setExpandedCard(expandedCard === profile.id ? null : profile.id)}
              className={!profile.available ? 'opacity-70' : undefined}
              header={
                <>
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground ring-1 ring-border',
                    !profile.available && 'grayscale'
                  )}>
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
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 text-muted-foreground">{getServiceIcon(profile.kind)}</span>
                    <span className="truncate text-sm font-medium">{profile.displayName}</span>
                    {!profile.available && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {t('settings.connections.unavailable')}
                      </Badge>
                    )}
                    {profile.kind === 'steam' && subAccounts.length > 0 && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        +{subAccounts.length}
                      </Badge>
                    )}
                  </div>
                </>
              }
            >
              {!profile.available && (
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-semibold text-foreground">
                      {t('settings.connections.unavailable')}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground">
                    {profile.kind === 'steam'
                      ? t('settings.connections.steamUnavailableHint')
                      : t('settings.connections.hydraUnavailableHint')}
                  </p>
                </div>
              )}
              {profile.kind === 'steam' ? (
                <div className="space-y-2">
                  {subAccounts.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <SteamBrandIcon className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">{t('settings.connections.steamAccounts')}</p>
                          <p className="text-[10px] font-medium text-muted-foreground">{t('settings.connections.steamHint')}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {subAccounts.map(sub => (
                          <a
                            key={sub.steamId64}
                            href={sub.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 p-3 transition-colors hover:bg-accent"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-background text-[10px] font-bold text-muted-foreground ring-1 ring-border">
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
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-foreground">
                                  {sub.personaName || sub.accountName || sub.steamId64}
                                </p>
                                {sub.accountName && sub.accountName !== sub.personaName && (
                                  <p className="truncate text-[10px] font-medium text-muted-foreground">{sub.accountName}</p>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground">Steam</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {!steamDisclaimerAccepted ? (
                    <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <p className="text-xs font-semibold text-foreground">{t('settings.connections.steamDisclaimerTitle')}</p>
                      </div>
                      <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
                        {t('settings.connections.steamDisclaimerBody')}
                      </p>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background p-2 text-[10px] font-semibold text-foreground">
                        <Checkbox
                          checked={steamDisclaimerChecked}
                          onCheckedChange={(event) => setSteamDisclaimerChecked(event)}
                          className="mt-0.5"
                        />
                        <span>{t('settings.connections.steamDisclaimerAccept')}</span>
                      </label>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={acceptSteamDisclaimer}
                          disabled={!steamDisclaimerChecked}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-[10px] font-semibold text-foreground disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t('settings.connections.retroDisclaimerContinue')}
                        </button>
                      </div>
                    </div>
                  ) : (<>
	                  <div className="flex items-center gap-2 px-1 pt-1">
	                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
	                    <div className="min-w-0">
	                      <p className="text-xs font-semibold text-foreground">{t('settings.connections.steamMainTitle')}</p>
	                      <p className="text-[10px] font-medium text-muted-foreground">{t('settings.connections.steamMainDesc')}</p>
	                    </div>
	                  </div>
                  <InlineFieldRow
                    label={t('settings.api.steamIntegrationTitle')}
                    description={t('settings.api.steamIntegrationBetaNotice')}
                    disabled={!canEnableSteamIntegration}
                    trailing={
                      <div className="flex items-center gap-2">
                        <Switch
                          size="sm"
                          checked={steamIntegrationEnabled}
                          disabled={!canEnableSteamIntegration}
                          onCheckedChange={setSteamIntegrationEnabled}
                        />
                      </div>
                    }
                  />

                  <InlineFieldRow
                    label={t('settings.connections.steamAchievementSource')}
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

	                  <InlineFieldRow
	                    label={t('settings.api.hideSteamGamesWithoutAchievements')}
	                    description={t('settings.api.hideSteamGamesWithoutAchievementsDesc')}
	                    trailing={
	                      <div className="flex items-center gap-2">
	                        <Switch
	                          size="sm"
	                          checked={hideSteamGamesWithoutAchievements}
	                          onCheckedChange={setHideSteamGamesWithoutAchievements}
	                        />
	                      </div>
	                    }
	                  />

	                  <div className="flex items-center gap-2 px-1 pt-1">
	                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
	                    <div className="min-w-0">
	                      <p className="text-xs font-semibold text-foreground">{t('settings.connections.steamPathsTitle')}</p>
	                      <p className="text-[10px] font-medium text-muted-foreground">{t('settings.connections.steamPathsDesc')}</p>
	                    </div>
	                  </div>
	                  <div className="space-y-2">
	                    <InlineFieldRow
	                      label={t('settings.api.steamLibraryPath')}
	                      description={steamLibPath || '--'}
	                      trailing={
	                        <button
	                          onClick={handlePickVdf}
	                          disabled={isSelectingVdf}
	                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-[10px] font-semibold text-foreground disabled:opacity-60"
	                        >
	                          {isSelectingVdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderOpen className="h-3 w-3" />}
	                          {isSelectingVdf ? t('settings.api.selecting') : t('settings.api.selectSteamVdf')}
	                        </button>
	                      }
	                    />

	                    <InlineFieldRow
	                      label={t('settings.api.steamDllPath')}
	                      description={steamDllPath || '--'}
	                      trailing={
	                        <button
	                          onClick={handlePickDll}
	                          disabled={isSelectingDll}
	                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-[10px] font-semibold text-foreground disabled:opacity-60"
	                        >
	                          {isSelectingDll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
	                          {isSelectingDll ? t('settings.api.selecting') : t('settings.api.selectSteamDll')}
	                        </button>
	                      }
	                    />
	                  </div>

                  {isSteamMissing && (
                    <div className="rounded-md border border-border bg-muted/40 p-4">
                      <div className="mb-1 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs font-semibold text-foreground">
                          {t('settings.api.steamIntegrationMissing')}
                        </p>
                      </div>
                      <p className="text-xs font-medium opacity-85 text-foreground">
                        {t('settings.api.steamIntegrationMissingWarning')}
                      </p>
                      {steamFailureReason && (
                        <p className="text-[11px] font-semibold mt-2 break-words text-foreground">
                          {t('settings.api.steamIntegrationFailureReason')} {steamFailureReason}
                        </p>
                      )}
                      <div className="mt-3 flex justify-end border-t border-border pt-3">
                        <button
                          onClick={async () => {
                            setIsRetryingConnection(true);
                            await refreshAvailability();
                            setIsRetryingConnection(false);
                          }}
                          disabled={isRetryingConnection}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-[10px] font-semibold text-foreground disabled:opacity-60"
                        >
                          {isRetryingConnection ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          {isRetryingConnection
                            ? t('settings.api.selecting')
                            : t('settings.api.retryConnectionButton')}
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                )}
                </div>
              ) : profile.kind === 'retroachievements' ? (
                <div className="space-y-3">
                  {!retroDisclaimerAccepted && (
                    <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <p className="text-xs font-semibold text-foreground">{t('settings.connections.retroDisclaimerTitle')}</p>
                      </div>
                      <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
                        {t('settings.connections.retroDisclaimerBody')}
                      </p>
                      <p className="text-[10px] font-medium leading-relaxed text-muted-foreground">
                        {t('settings.connections.retroDisclaimerMode')}
                      </p>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background p-2 text-[10px] font-semibold text-foreground">
                        <Checkbox
                          checked={retroDisclaimerChecked}
                          onCheckedChange={(event) => setRetroDisclaimerChecked(event)}
                          className="mt-0.5"
                        />
                        <span>{t('settings.connections.retroDisclaimerAccept')}</span>
                      </label>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={acceptRetroDisclaimer}
                          disabled={!retroDisclaimerChecked}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-[10px] font-semibold text-foreground disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t('settings.connections.retroDisclaimerContinue')}
                        </button>
                      </div>
                    </div>
                  )}
                  {retroDisclaimerAccepted && <>
	                  <div className="flex items-center gap-2 px-1">
	                    <KeyRound className="h-4 w-4 text-muted-foreground" />
	                    <div className="min-w-0">
	                      <p className="text-xs font-semibold text-foreground">{t('settings.connections.retroRequiredTitle')}</p>
	                      <p className="text-[10px] font-medium text-muted-foreground">{t('settings.connections.retroRequiredDesc')}</p>
	                    </div>
	                  </div>
	                  <InlineFieldRow
	                    label={t('settings.connections.retroUsername')}
	                    description={t('settings.connections.retroUsernameDesc')}
                    trailing={
                      <div className="flex items-center gap-2">
                        <div className="relative w-48">
                          <UserRound className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={retroUsername}
                            onChange={(event) => setRetroUsername(event.target.value)}
                            className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
                            placeholder="username"
                          />
                        </div>
                      </div>
                    }
                  />
	                  <InlineFieldRow
	                    label={t('settings.connections.retroRuntimeLogin')}
	                    description={hasRetroRuntimeToken
                      ? t('settings.connections.retroRuntimeLoginSavedDesc')
                      : t('settings.connections.retroRuntimeLoginDesc')}
                    trailing={
                      <div className="flex items-center gap-2">
                        <div className="relative w-48">
                          <LockKeyhole className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={retroRuntimePassword}
                            onChange={(event) => setRetroRuntimePassword(event.target.value)}
                            className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-9 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
                            placeholder="password"
                            type={showRetroPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRetroPassword(current => !current)}
                            className="absolute right-1 top-1/2 grid h-6 w-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                            title={showRetroPassword ? t('settings.connections.hideSecret') : t('settings.connections.showSecret')}
                          >
                            {showRetroPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleRetroRuntimeLogin}
                          disabled={isRetroRuntimeLoggingIn || !retroUsername.trim() || !retroRuntimePassword}
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[10px] font-semibold disabled:opacity-70',
                            hasRetroRuntimeToken ? 'border-border bg-muted text-foreground' : 'border-border bg-accent text-foreground'
                          )}
                        >
                          {isRetroRuntimeLoggingIn && <Loader2 className="h-3 w-3 animate-spin" />}
                          {!isRetroRuntimeLoggingIn && hasRetroRuntimeToken && <CheckCircle2 className="h-3 w-3" />}
                          {!isRetroRuntimeLoggingIn && !hasRetroRuntimeToken && <KeyRound className="h-3 w-3" />}
                          {isRetroRuntimeLoggingIn ? t('settings.connections.retroRuntimeLoggingIn') : hasRetroRuntimeToken ? t('settings.connections.loggedIn') : t('settings.connections.retroRuntimeLoginButton')}
                        </button>
                      </div>
                    }
                  />
	                  <InlineFieldRow
	                    label={t('settings.connections.retroApiKey')}
	                    description={t('settings.connections.retroApiKeyDesc')}
                    trailing={
                      <div className="flex items-center gap-2">
                        <div className="relative w-48">
                          <KeyRound className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={retroApiKey}
                            onChange={(event) => setRetroApiKey(event.target.value)}
                            className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-9 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
                            placeholder="API key"
                            type={showRetroApiKey ? 'text' : 'password'}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRetroApiKey(current => !current)}
                            className="absolute right-1 top-1/2 grid h-6 w-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                            title={showRetroApiKey ? t('settings.connections.hideSecret') : t('settings.connections.showSecret')}
                          >
                            {showRetroApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    }
                  />
	                  <div className="flex items-center gap-2 px-1 pt-1">
	                    <Globe2 className="h-4 w-4 text-muted-foreground" />
	                    <div className="min-w-0">
	                      <p className="text-xs font-semibold text-foreground">{t('settings.connections.retroOptionalTitle')}</p>
	                      <p className="text-[10px] font-medium text-muted-foreground">{t('settings.connections.retroOptionalDesc')}</p>
	                    </div>
	                  </div>
	                  <InlineFieldRow
	                    label={t('settings.connections.retroWebSession')}
	                    description={retroWebCookie.trim()
                      ? t('settings.connections.retroWebSessionDesc')
                      : t('settings.connections.retroWebSessionMissingDesc')}
                    trailing={
                      <button
                        type="button"
                        onClick={handleRetroWebSessionLogin}
                        disabled={isRetroWebSessionLoggingIn}
                        className={cn(
                          'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[10px] font-semibold disabled:opacity-70',
                          hasRetroWebSession ? 'border-border bg-muted text-foreground' : 'border-border bg-accent text-foreground'
                        )}
                      >
                        {isRetroWebSessionLoggingIn && <Loader2 className="h-3 w-3 animate-spin" />}
                        {!isRetroWebSessionLoggingIn && hasRetroWebSession && <CheckCircle2 className="h-3 w-3" />}
                        {!isRetroWebSessionLoggingIn && !hasRetroWebSession && <Globe2 className="h-3 w-3" />}
                        {isRetroWebSessionLoggingIn ? t('settings.connections.retroWebSessionLoggingIn') : hasRetroWebSession ? t('settings.connections.loggedIn') : t('settings.connections.retroWebSessionLogin')}
                      </button>
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
                  {!hasRetroWebSession && (
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
                  </>}
                </div>
              ) : (
                <div className="space-y-2">
                  <InlineFieldRow
                    label={t('settings.connections.hydraDbPathTitle')}
                    description={hydraDefaultPath || '--'}
                    trailing={
                      <div className="flex items-center gap-1.5">
                        <input
                          value={hydraDbPath}
                          onChange={async (event) => {
                            const value = event.target.value;
                            setHydraDbPath(value);
                            await saveSettings({ hydraDbPath: value });
                            window.dispatchEvent(new Event('settings-saved'));
                          }}
                          className="h-8 w-52 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
                          placeholder={hydraDefaultPath || '~/.config/hydralauncher/hydra-db'}
                        />
                        <button
                          onClick={async () => {
                            setIsHydraSelecting(true);
                            try {
                              const selected = await invoke<string | null>('pick_folder');
                              if (selected) {
                                setHydraDbPath(selected);
                                await saveSettings({ hydraDbPath: selected });
                                window.dispatchEvent(new Event('settings-saved'));
                              }
                            } catch (error) {
                              console.error('Failed to pick folder:', error);
                            } finally {
                              setIsHydraSelecting(false);
                            }
                          }}
                          disabled={isHydraSelecting}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-accent text-foreground disabled:opacity-60"
                          title={t('settings.connections.hydraSelectFolder')}
                        >
                          {isHydraSelecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                        </button>
                        {hydraDbPath && (
                          <button
                            type="button"
                            onClick={async () => {
                              setHydraDbPath('');
                              await saveSettings({ hydraDbPath: '' });
                              window.dispatchEvent(new Event('settings-saved'));
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-accent px-2.5 text-[10px] font-semibold text-foreground"
                          >
                            {t('settings.connections.hydraResetDefault')}
                          </button>
                        )}
                      </div>
                    }
                  />
                </div>
              )}
            </AccordionCard>
          ))}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
};

export default ConnectionsSettings;

export type AppPlatform = 'linux' | 'windows' | 'macos' | string;

export const getAppPlatform = (): AppPlatform => {
  const forced = import.meta.env.VITE_FORCE_PLATFORM;
  if (forced) return forced;

  return (window as any).electronAPI?.platform ?? '';
};

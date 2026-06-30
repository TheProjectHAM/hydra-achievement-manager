const DEFAULT_STEAM_CDN_URL = 'https://cdn.akamai.steamstatic.com/steam/apps';

export const getSteamCdnBaseUrl = () =>
  import.meta.env.VITE_STEAM_CDN_URL || DEFAULT_STEAM_CDN_URL;

export const getSteamAssetUrl = (gameId: string | number, assetName: string) =>
  `${getSteamCdnBaseUrl()}/${gameId}/${assetName}`;

export const getSteamHeaderUrl = (gameId: string | number) =>
  getSteamAssetUrl(gameId, 'header.jpg');

export const getSteamLogoUrl = (gameId: string | number) =>
  getSteamAssetUrl(gameId, 'logo.png');

export const getSteamCapsuleUrl = (gameId: string | number, size: string) =>
  getSteamAssetUrl(gameId, `capsule_${size}.jpg`);

export const getSteamLogoFallbackUrl = (gameId: string | number) =>
  getSteamCapsuleUrl(gameId, '184x69');

export const isSteamLogoFallbackUrl = (url: string, gameId: string | number) => {
  try {
    return new URL(url).pathname === new URL(getSteamLogoFallbackUrl(gameId)).pathname;
  } catch {
    return url === getSteamLogoFallbackUrl(gameId);
  }
};

export const getSteamBackgroundFallbackUrls = (gameId: string | number) => [
  getSteamHeaderUrl(gameId),
  getSteamAssetUrl(gameId, 'library_hero.jpg'),
  getSteamCapsuleUrl(gameId, '616x353'),
  getSteamCapsuleUrl(gameId, '467x181'),
  getSteamCapsuleUrl(gameId, '231x87'),
  getSteamLogoUrl(gameId),
  getSteamAssetUrl(gameId, 'library_600x900.jpg'),
];

export const getSteamLogoFallbackUrls = (gameId: string | number) => [
  getSteamAssetUrl(gameId, 'capsule_sm_120.jpg'),
  getSteamLogoFallbackUrl(gameId),
  getSteamCapsuleUrl(gameId, '231x87'),
  getSteamCapsuleUrl(gameId, '467x181'),
  getSteamCapsuleUrl(gameId, '616x353'),
  getSteamAssetUrl(gameId, 'library_hero.jpg'),
  getSteamAssetUrl(gameId, 'library_600x900.jpg'),
  getSteamHeaderUrl(gameId),
  getSteamAssetUrl(gameId, 'header_292x136.jpg'),
];

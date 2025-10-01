const STEAM_API_BASE = 'https://api.steampowered.com';

export interface SteamAchievement {
  apiname: string;
  achieved: number;
  unlocktime: number;
  name?: string;
  description?: string;
  icon?: string;
  icongray?: string;
}

export interface SteamAchievementsResponse {
  playerstats: {
    steamID: string;
    gameName: string;
    achievements: SteamAchievement[];
    success: boolean;
  };
}

const STEAM_TO_HYDRA_LANGUAGE_MAP: Record<string, string> = {
  'english': 'en',
  'german': 'de',
  'french': 'fr',
  'italian': 'it',
  'spanish': 'es',
  'russian': 'ru',
  'portuguese': 'pt',
  'brazilian': 'pt',
  'en-us': 'en',
  'es-es': 'es',
  'fr-fr': 'fr',
  'it-it': 'it',
  'ja-jp': '',
  'pl-pl': '',
  'pt-br': 'pt',
  'ru-ru': 'ru',
  'uk-ua': '',
  'zh-cn': '',
};

export class SteamAPI {
  private static async fetchWithErrorHandling(url: string, params: Record<string, any>): Promise<any> {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${queryString}`;

    const response = await fetch(fullUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Steam API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch achievements for a Steam game using Steam API
   * @param appId Steam AppID
   * @param apiKey Steam API key
   * @param language Language code (e.g. 'en', 'fr', 'pt')
   * @returns Promise<SteamAchievement[]>
   */
  static async getGameAchievements(appId: number, apiKey: string, language: string): Promise<SteamAchievement[]> {
    const url = `${STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/`;

    try {
      const data = await this.fetchWithErrorHandling(url, {
        key: apiKey,
        appid: appId,
        l: language,
      });

      if (data.game && data.game.availableGameStats && data.game.availableGameStats.achievements) {
        const steamAchievements = data.game.availableGameStats.achievements.map((ach: any) => ({
          apiname: ach.name,
          achieved: 0, // Not applicable for schema
          unlocktime: 0, // Not applicable for schema
          name: ach.displayName,
          description: ach.description,
          icon: ach.icon,
          icongray: ach.icongray,
        }));

        // Fetch Hydra achievements for fallback descriptions
        try {
          let hydraUrl = `https://hydra-api-us-east-1.losbroxas.org/games/achievements?shop=steam&objectId=${appId}`;
          const hydraLang = STEAM_TO_HYDRA_LANGUAGE_MAP[language.toLowerCase()];
          if (hydraLang && ['en', 'es', 'ru', 'pt'].includes(hydraLang)) {
            hydraUrl += `&language=${hydraLang}`;
          }
          const hydraResponse = await fetch(hydraUrl);
          if (hydraResponse.ok) {
            const hydraAchievements: any[] = await hydraResponse.json();

            // Replace missing descriptions in steamAchievements with hydra descriptions
            steamAchievements.forEach(sa => {
              if (!sa.description || sa.description.trim() === '') {
                const ha = hydraAchievements.find((h: any) => h.name === sa.apiname);
                if (ha && ha.description) {
                  sa.description = ha.description;
                }
              }
            });
          }
        } catch (error) {
          console.warn('Failed to fetch Hydra achievements for fallback descriptions:', error);
        }

        return steamAchievements;
      } else {
        throw new Error('Failed to fetch achievements from Steam API');
      }
    } catch (error) {
      console.error('Error fetching Steam achievements:', error);
      throw error;
    }
  }
}

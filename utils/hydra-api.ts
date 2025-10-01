import { HydraAchievement, HydraGameAchievements } from './types';

const HYDRA_API_BASE = 'https://hydra-api-us-east-1.losbroxas.org';

export class HydraAPI {
  private static async fetchWithErrorHandling(url: string): Promise<any> {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Hydra API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch achievements for a Steam game using Hydra API
   * @param gameId Steam AppID
   * @param language Language code (en, es, ru, pt)
   * @returns Promise<HydraGameAchievements>
   */
  static async getGameAchievements(gameId: string, language?: string): Promise<HydraGameAchievements> {
    let url = `${HYDRA_API_BASE}/games/achievements?shop=steam&objectId=${gameId}`;
    if (language && ['en', 'es', 'ru', 'pt'].includes(language)) {
      url += `&language=${language}`;
    }

    try {
      const achievements: HydraAchievement[] = await this.fetchWithErrorHandling(url);

      return {
        gameId,
        achievements,
      };
    } catch (error) {
      console.error(`Failed to fetch achievements for game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Get achievement definition by name from the game achievements
   * @param gameAchievements
   * @param achievementName
   * @returns HydraAchievement | undefined
   */
  static getAchievementByName(
    gameAchievements: HydraGameAchievements,
    achievementName: string
  ): HydraAchievement | undefined {
    return gameAchievements.achievements.find(
      achievement => achievement.name === achievementName
    );
  }
}

export const getRetroAchievementsFallbackImage = () =>
  'https://media.retroachievements.org/Images/000001.png';

export const getRetroAchievementsGameImage = (game: {
  imageUrl?: string | null;
  logoUrl?: string | null;
}) => game.imageUrl || game.logoUrl || getRetroAchievementsFallbackImage();

// Crest-style glyphs (plain text, not emoji) shown on a school-badge circle
export const AVATARS = ['★', '◆', '▲', '●', '✦', '♞', '♜', '⚑', '☘', '☀', '☾', '✚'];
export const AVATAR_BG = ['#b8893a', '#4f7a9a', '#a14a4a', '#8a6d2f', '#a8643a', '#7a7a3a', '#4f8a5f', '#6b7480', '#9a8a2f', '#9a5a2a', '#4a8a76', '#7a6a9a'];

export const NG_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

// Economy (server-side too: see lib/server/rewards.ts)
export const REWARDS = {
  pvpWin: 50, pvpLoss: 15, heavyEach: 5, heavyMax: 30,
  aiWin: 25, aiLoss: 6, aiHeavyEach: 2,
  forfeitWin: 25,
  firstMatchBonus: 20,
  dailyCap: 500,      // max coins from matches per day
  aiDailyCap: 100,    // max coins from practice matches per day
  dailyBase: 30, dailyStep: 10, dailyMaxStreak: 7,
};

export const TURN_SECONDS = 25;
export const BEST_OF = 3;
export const USERNAME_RE = /^[A-Za-z0-9_]{3,15}$/;

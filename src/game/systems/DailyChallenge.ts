const STORAGE_KEY = 'ascension_daily_challenge';
const LEADERBOARD_KEY = 'ascension_leaderboard';
const WEEKLY_STORAGE_KEY = 'ascension_weekly_challenge';
const WEEKLY_LEADERBOARD_KEY = 'ascension_weekly_leaderboard';

interface DailyChallengeData {
    // Current challenge
    date: string;           // YYYY-MM-DD format
    seed: number;           // Deterministic seed for this day
    modifiers: string[];    // Active modifiers for this challenge
    class: string;          // Required class for this challenge
    // Player's best run for today
    bestAltitude: number;
    bestKills: number;
    bestBosses: number;
    bestTime: number;       // ms
    attempted: boolean;
    // History of past daily scores
    history: Array<{
        date: string;
        altitude: number;
        kills: number;
        class: string;
    }>;
}

export interface WeeklyChallengeData {
    weekStart: string; // Monday date string YYYY-MM-DD
    seed: number;
    modifiers: string[];
    class: string;
    // Weekly has unique rules
    specialRule: string; // e.g., 'all_elite', 'no_items', 'speed_run'
    specialRuleDescription: string;
    // Best run this week
    bestAltitude: number;
    bestKills: number;
    bestBosses: number;
    bestTime: number;
    attempted: boolean;
    runsThisWeek: number;
}

export interface WeeklyRule {
    id: string;
    name: string;
    description: string;
}

export const WEEKLY_RULES: WeeklyRule[] = [
    { id: 'all_elite', name: 'Elite Gauntlet', description: 'All enemies spawn as elite variants' },
    { id: 'no_items', name: 'Purist', description: 'No silver items can be collected' },
    { id: 'speed_run', name: 'Speed Demon', description: 'Reach 5000m in 10 minutes or die' },
    { id: 'glass_floor', name: 'Fragile Ground', description: 'All platforms are breakable' },
    { id: 'boss_rush', name: 'Boss Rush', description: 'Bosses appear every 500m instead of 1000m' },
    { id: 'double_essence', name: 'Essence Overflow', description: '2x essence but 2x enemy health' },
];

export interface LeaderboardEntry {
    date: string;
    classType: string;
    altitude: number;
    kills: number;
    bosses: number;
    timeMs: number;
}

// Simple seeded PRNG
function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

export const LocalLeaderboard = {
    entries: [] as LeaderboardEntry[],

    load(): void {
        try {
            const raw = localStorage.getItem(LEADERBOARD_KEY);
            if (raw) {
                this.entries = JSON.parse(raw);
            }
        } catch {
            this.entries = [];
        }
    },

    save(): void {
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(this.entries));
    },

    submit(entry: LeaderboardEntry): boolean {
        this.entries.push(entry);
        // Sort by altitude descending
        this.entries.sort((a, b) => b.altitude - a.altitude);
        // Keep top 10
        if (this.entries.length > 10) {
            this.entries = this.entries.slice(0, 10);
        }
        this.save();
        // Return true if the entry made it into the top 10
        return this.entries.some(
            (e) => e.date === entry.date && e.altitude === entry.altitude && e.timeMs === entry.timeMs
        );
    },

    getEntries(): LeaderboardEntry[] {
        return [...this.entries];
    },
};

export const WeeklyLeaderboard = {
    entries: [] as LeaderboardEntry[],

    load(): void {
        try {
            const raw = localStorage.getItem(WEEKLY_LEADERBOARD_KEY);
            if (raw) {
                this.entries = JSON.parse(raw);
            }
        } catch {
            this.entries = [];
        }
    },

    save(): void {
        localStorage.setItem(WEEKLY_LEADERBOARD_KEY, JSON.stringify(this.entries));
    },

    submit(entry: LeaderboardEntry): boolean {
        this.entries.push(entry);
        this.entries.sort((a, b) => b.altitude - a.altitude);
        if (this.entries.length > 10) {
            this.entries = this.entries.slice(0, 10);
        }
        this.save();
        return this.entries.some(
            (e) => e.date === entry.date && e.altitude === entry.altitude && e.timeMs === entry.timeMs
        );
    },

    getEntries(): LeaderboardEntry[] {
        return [...this.entries];
    },
};

export const DailyChallenge = {
    data: null as DailyChallengeData | null,
    weeklyData: null as WeeklyChallengeData | null,

    load(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this.data = JSON.parse(raw);
            }
        } catch {
            this.data = null;
        }
        LocalLeaderboard.load();
        WeeklyLeaderboard.load();
        // Check if we need to generate a new daily challenge
        const today = this.getTodayString();
        if (!this.data || this.data.date !== today) {
            this.generateNewChallenge(today);
        }

        // Load and check weekly challenge
        try {
            const weeklyRaw = localStorage.getItem(WEEKLY_STORAGE_KEY);
            if (weeklyRaw) {
                this.weeklyData = JSON.parse(weeklyRaw);
            }
        } catch {
            this.weeklyData = null;
        }
        const currentWeekStart = this.getWeekStart();
        if (!this.weeklyData || this.weeklyData.weekStart !== currentWeekStart) {
            this.generateWeeklyChallenge(currentWeekStart);
        }
    },

    save(): void {
        if (this.data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        }
        if (this.weeklyData) {
            localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(this.weeklyData));
        }
    },

    getTodayString(): string {
        const now = new Date();
        return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    },

    getWeekStart(): string {
        const now = new Date();
        // Find Monday of current week (UTC)
        const day = now.getUTCDay();
        const diff = day === 0 ? 6 : day - 1; // Monday = 0
        const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
        return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
    },

    generateNewChallenge(date: string): void {
        // Generate seed from date string
        let seed = 0;
        for (let i = 0; i < date.length; i++) {
            seed = ((seed << 5) - seed) + date.charCodeAt(i);
            seed |= 0;
        }

        const rng = seededRandom(seed);

        // Pick random class
        const classes = ['PALADIN', 'MONK', 'PRIEST'];
        const classIdx = Math.floor(rng() * classes.length);

        // Pick 1-2 random modifiers
        const allMods = ['glass_cannon', 'speed_demon', 'minimalist', 'one_shot', 'chaos_mode', 'rising_darkness'];
        const numMods = Math.floor(rng() * 2) + 1;
        const mods: string[] = [];
        for (let i = 0; i < numMods; i++) {
            const idx = Math.floor(rng() * allMods.length);
            if (!mods.includes(allMods[idx])) {
                mods.push(allMods[idx]);
            }
        }

        // Preserve history from previous data
        const history = this.data?.history ?? [];
        // Archive yesterday's result
        if (this.data && this.data.attempted) {
            history.push({
                date: this.data.date,
                altitude: this.data.bestAltitude,
                kills: this.data.bestKills,
                class: this.data.class,
            });
            // Keep only last 30 days
            while (history.length > 30) history.shift();
        }

        this.data = {
            date,
            seed: Math.abs(seed),
            modifiers: mods,
            class: classes[classIdx],
            bestAltitude: 0,
            bestKills: 0,
            bestBosses: 0,
            bestTime: 0,
            attempted: false,
            history,
        };
        this.save();
    },

    generateWeeklyChallenge(weekStart: string): void {
        // Use week start date as seed (different from daily)
        let seed = 0;
        for (let i = 0; i < weekStart.length; i++) {
            seed = ((seed << 7) - seed) + weekStart.charCodeAt(i);
            seed |= 0;
        }
        seed = Math.abs(seed) + 1000000; // Offset from daily seeds

        const rng = seededRandom(seed);
        const classes = ['PALADIN', 'MONK', 'PRIEST'];
        const classType = classes[Math.floor(rng() * classes.length)];

        // Weekly always has 2 modifiers + 1 special rule
        const allMods = ['glass_cannon', 'speed_demon', 'minimalist', 'one_shot', 'chaos_mode', 'rising_darkness'];
        const mods: string[] = [];
        while (mods.length < 2) {
            const idx = Math.floor(rng() * allMods.length);
            if (!mods.includes(allMods[idx])) mods.push(allMods[idx]);
        }

        const ruleIdx = Math.floor(rng() * WEEKLY_RULES.length);
        const rule = WEEKLY_RULES[ruleIdx];

        this.weeklyData = {
            weekStart,
            seed: Math.abs(seed),
            modifiers: mods,
            class: classType,
            specialRule: rule.id,
            specialRuleDescription: rule.description,
            bestAltitude: 0,
            bestKills: 0,
            bestBosses: 0,
            bestTime: 0,
            attempted: false,
            runsThisWeek: 0,
        };
        this.save();
    },

    getCurrentChallenge(): { date: string; seed: number; modifiers: string[]; class: string } | null {
        if (!this.data) return null;
        return {
            date: this.data.date,
            seed: this.data.seed,
            modifiers: this.data.modifiers,
            class: this.data.class,
        };
    },

    getWeeklyChallenge(): WeeklyChallengeData | null {
        return this.weeklyData;
    },

    submitRun(altitude: number, kills: number, bosses: number, timeMs: number): boolean {
        if (!this.data) return false;
        this.data.attempted = true;
        let isNewBest = false;
        if (altitude > this.data.bestAltitude) {
            this.data.bestAltitude = altitude;
            isNewBest = true;
        }
        if (kills > this.data.bestKills) this.data.bestKills = kills;
        if (bosses > this.data.bestBosses) this.data.bestBosses = bosses;
        if (timeMs > this.data.bestTime) this.data.bestTime = timeMs;
        this.save();

        // Also submit to local leaderboard
        LocalLeaderboard.submit({
            date: this.data.date,
            classType: this.data.class,
            altitude,
            kills,
            bosses,
            timeMs,
        });

        return isNewBest;
    },

    submitWeeklyRun(altitude: number, kills: number, bosses: number, timeMs: number): boolean {
        if (!this.weeklyData) return false;
        this.weeklyData.attempted = true;
        this.weeklyData.runsThisWeek++;
        let isNewBest = false;
        if (altitude > this.weeklyData.bestAltitude) {
            this.weeklyData.bestAltitude = altitude;
            isNewBest = true;
        }
        if (kills > this.weeklyData.bestKills) this.weeklyData.bestKills = kills;
        if (bosses > this.weeklyData.bestBosses) this.weeklyData.bestBosses = bosses;
        if (timeMs > this.weeklyData.bestTime) this.weeklyData.bestTime = timeMs;
        this.save();

        // Also submit to weekly leaderboard
        WeeklyLeaderboard.submit({
            date: this.weeklyData.weekStart,
            classType: this.weeklyData.class,
            altitude,
            kills,
            bosses,
            timeMs,
        });

        return isNewBest;
    },

    getBestRun(): { altitude: number; kills: number; bosses: number } {
        return {
            altitude: this.data?.bestAltitude ?? 0,
            kills: this.data?.bestKills ?? 0,
            bosses: this.data?.bestBosses ?? 0,
        };
    },

    getWeeklyBestRun(): { altitude: number; kills: number; bosses: number; time: number } {
        return {
            altitude: this.weeklyData?.bestAltitude ?? 0,
            kills: this.weeklyData?.bestKills ?? 0,
            bosses: this.weeklyData?.bestBosses ?? 0,
            time: this.weeklyData?.bestTime ?? 0,
        };
    },

    getHistory(): Array<{ date: string; altitude: number; kills: number; class: string }> {
        return this.data?.history ?? [];
    },

    getSeed(): number {
        return this.data?.seed ?? 0;
    },

    getTimeRemaining(): string {
        const now = new Date();
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        const diff = tomorrow.getTime() - now.getTime();
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    },

    getWeeklyTimeRemaining(): string {
        const now = new Date();
        // Next Monday UTC
        const day = now.getUTCDay();
        const daysUntilMonday = day === 0 ? 1 : (8 - day);
        const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
        const diff = nextMonday.getTime() - now.getTime();
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        return `${days}d ${hours}h`;
    },

    getWeeklySpecialRuleName(): string {
        if (!this.weeklyData) return '';
        const rule = WEEKLY_RULES.find(r => r.id === this.weeklyData!.specialRule);
        return rule ? rule.name : this.weeklyData.specialRule;
    },

    getWeeklyDateRange(): string {
        if (!this.weeklyData) return '';
        // Parse the week start to compute end (Sunday)
        const parts = this.weeklyData.weekStart.split('-');
        const monday = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
        const sunday = new Date(monday.getTime() + 6 * 86400000);
        const fmt = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
        return `${fmt(monday)} - ${fmt(sunday)}`;
    },
};

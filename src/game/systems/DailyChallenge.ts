const STORAGE_KEY = 'ascension_daily_challenge';
const LEADERBOARD_KEY = 'ascension_leaderboard';

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

export const DailyChallenge = {
    data: null as DailyChallengeData | null,

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
        // Check if we need to generate a new daily challenge
        const today = this.getTodayString();
        if (!this.data || this.data.date !== today) {
            this.generateNewChallenge(today);
        }
    },

    save(): void {
        if (this.data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        }
    },

    getTodayString(): string {
        const now = new Date();
        return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
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

    getCurrentChallenge(): { date: string; seed: number; modifiers: string[]; class: string } | null {
        if (!this.data) return null;
        return {
            date: this.data.date,
            seed: this.data.seed,
            modifiers: this.data.modifiers,
            class: this.data.class,
        };
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

    getBestRun(): { altitude: number; kills: number; bosses: number } {
        return {
            altitude: this.data?.bestAltitude ?? 0,
            kills: this.data?.bestKills ?? 0,
            bosses: this.data?.bestBosses ?? 0,
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
};

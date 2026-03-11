const STORAGE_KEY = 'ascension_audio_settings';

interface AudioSettings {
    masterVolume: number;   // 0-1
    musicVolume: number;    // 0-1
    sfxVolume: number;      // 0-1
    uiVolume: number;       // 0-1
}

export const AudioManager = {
    ctx: null as AudioContext | null,
    settings: {
        masterVolume: 0.7,
        musicVolume: 0.5,
        sfxVolume: 0.8,
        uiVolume: 0.6,
    } as AudioSettings,
    musicGain: null as GainNode | null,
    sfxGain: null as GainNode | null,
    uiGain: null as GainNode | null,
    masterGain: null as GainNode | null,

    // Throttle tracking for rapidly-repeating sounds
    _lastPlayTime: {} as Record<string, number>,
    _throttleMs: 80, // Minimum ms between same sound

    init(): void {
        if (this.ctx) return;
        this.ctx = new AudioContext();
        this.loadSettings();

        // Create gain node chain: source -> category gain -> master gain -> destination
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = this.settings.masterVolume;

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);
        this.sfxGain.gain.value = this.settings.sfxVolume;

        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.masterGain);
        this.musicGain.gain.value = this.settings.musicVolume;

        this.uiGain = this.ctx.createGain();
        this.uiGain.connect(this.masterGain);
        this.uiGain.gain.value = this.settings.uiVolume;
    },

    resume(): void {
        // Must be called after user gesture
        if (this.ctx?.state === 'suspended') this.ctx.resume();
    },

    loadSettings(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<AudioSettings>;
                this.settings = {
                    masterVolume: parsed.masterVolume ?? 0.7,
                    musicVolume: parsed.musicVolume ?? 0.5,
                    sfxVolume: parsed.sfxVolume ?? 0.8,
                    uiVolume: parsed.uiVolume ?? 0.6,
                };
            }
        } catch {
            // Keep defaults
        }
    },

    saveSettings(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch {
            // Storage full or unavailable
        }
    },

    setVolume(category: 'master' | 'music' | 'sfx' | 'ui', value: number): void {
        const clamped = Math.max(0, Math.min(1, value));
        switch (category) {
            case 'master':
                this.settings.masterVolume = clamped;
                if (this.masterGain) this.masterGain.gain.value = clamped;
                break;
            case 'music':
                this.settings.musicVolume = clamped;
                if (this.musicGain) this.musicGain.gain.value = clamped;
                break;
            case 'sfx':
                this.settings.sfxVolume = clamped;
                if (this.sfxGain) this.sfxGain.gain.value = clamped;
                break;
            case 'ui':
                this.settings.uiVolume = clamped;
                if (this.uiGain) this.uiGain.gain.value = clamped;
                break;
        }
        this.saveSettings();
    },

    /** Returns true if enough time has passed since last play of this sound */
    _throttle(key: string): boolean {
        const now = performance.now();
        const last = this._lastPlayTime[key] || 0;
        if (now - last < this._throttleMs) return false;
        this._lastPlayTime[key] = now;
        return true;
    },

    // ============ SOUND GENERATORS ============

    playJump(): void {
        if (!this._throttle('jump')) return;
        // Quick ascending tone
        this.playTone({ freq: 300, endFreq: 600, duration: 0.1, type: 'sine', gain: 0.3, category: 'sfx' });
    },

    playLand(): void {
        if (!this._throttle('land')) return;
        // Short thud
        this.playNoise({ duration: 0.05, gain: 0.2, category: 'sfx' });
    },

    playAttackSwing(): void {
        if (!this._throttle('attack')) return;
        // Whoosh: filtered noise sweep
        this.playNoise({ duration: 0.12, gain: 0.15, filterFreq: 2000, filterEnd: 500, category: 'sfx' });
    },

    playHitLight(): void {
        if (!this._throttle('hitLight')) return;
        // Short impact
        this.playTone({ freq: 200, endFreq: 80, duration: 0.08, type: 'square', gain: 0.3, category: 'sfx' });
        this.playNoise({ duration: 0.05, gain: 0.15, category: 'sfx' });
    },

    playHitHeavy(): void {
        if (!this._throttle('hitHeavy')) return;
        // Bigger impact
        this.playTone({ freq: 150, endFreq: 40, duration: 0.15, type: 'square', gain: 0.4, category: 'sfx' });
        this.playNoise({ duration: 0.1, gain: 0.25, category: 'sfx' });
    },

    playDodge(): void {
        if (!this._throttle('dodge')) return;
        // Quick whoosh
        this.playNoise({ duration: 0.08, gain: 0.1, filterFreq: 3000, filterEnd: 1000, category: 'sfx' });
    },

    playPerfectDodge(): void {
        if (!this._throttle('perfectDodge')) return;
        // Chime/bell
        this.playTone({ freq: 800, endFreq: 1200, duration: 0.2, type: 'sine', gain: 0.25, category: 'sfx' });
        this.playTone({ freq: 1200, endFreq: 1600, duration: 0.15, type: 'sine', gain: 0.2, category: 'sfx', delay: 0.08 });
    },

    playParry(): void {
        if (!this._throttle('parry')) return;
        // Metallic clang
        this.playTone({ freq: 1500, endFreq: 800, duration: 0.12, type: 'triangle', gain: 0.3, category: 'sfx' });
        this.playTone({ freq: 2000, endFreq: 1200, duration: 0.08, type: 'square', gain: 0.15, category: 'sfx' });
    },

    playDamage(): void {
        if (!this._throttle('damage')) return;
        // Pain sound: descending tone
        this.playTone({ freq: 400, endFreq: 150, duration: 0.2, type: 'sawtooth', gain: 0.3, category: 'sfx' });
    },

    playDeath(): void {
        // No throttle for death — it's a one-time event
        // Dramatic descending
        this.playTone({ freq: 300, endFreq: 50, duration: 0.5, type: 'sawtooth', gain: 0.4, category: 'sfx' });
        this.playTone({ freq: 200, endFreq: 30, duration: 0.6, type: 'square', gain: 0.2, category: 'sfx', delay: 0.2 });
    },

    playEssencePickup(): void {
        if (!this._throttle('essence')) return;
        // Bright ascending chime
        this.playTone({ freq: 600, endFreq: 900, duration: 0.1, type: 'sine', gain: 0.2, category: 'sfx' });
        this.playTone({ freq: 900, endFreq: 1200, duration: 0.1, type: 'sine', gain: 0.15, category: 'sfx', delay: 0.08 });
    },

    playItemPickup(): void {
        if (!this._throttle('item')) return;
        // Jingle: ascending arpeggio
        [0, 0.08, 0.16].forEach((delay, i) => {
            this.playTone({ freq: 500 + i * 200, endFreq: 600 + i * 200, duration: 0.1, type: 'sine', gain: 0.2, category: 'sfx', delay });
        });
    },

    playComboTick(): void {
        if (!this._throttle('combo')) return;
        // Quick tick that gets higher with combo
        this.playTone({ freq: 800, endFreq: 1000, duration: 0.04, type: 'sine', gain: 0.15, category: 'sfx' });
    },

    playBossWarning(): void {
        // No throttle — event-based
        // Low ominous horn
        this.playTone({ freq: 80, endFreq: 60, duration: 0.8, type: 'sawtooth', gain: 0.35, category: 'sfx' });
        this.playTone({ freq: 120, endFreq: 80, duration: 0.6, type: 'square', gain: 0.2, category: 'sfx', delay: 0.3 });
    },

    playBossDefeat(): void {
        // Victory fanfare: ascending chord
        [0, 0.1, 0.2, 0.3].forEach((delay, i) => {
            this.playTone({ freq: 400 + i * 150, endFreq: 500 + i * 150, duration: 0.3, type: 'sine', gain: 0.25, category: 'sfx', delay });
        });
    },

    playMenuClick(): void {
        if (!this._throttle('menuClick')) return;
        this.playTone({ freq: 600, endFreq: 700, duration: 0.03, type: 'sine', gain: 0.15, category: 'ui' });
    },

    playMenuConfirm(): void {
        if (!this._throttle('menuConfirm')) return;
        this.playTone({ freq: 500, endFreq: 800, duration: 0.08, type: 'sine', gain: 0.2, category: 'ui' });
    },

    playPortalTeleport(): void {
        // Warbling sweep
        this.playTone({ freq: 200, endFreq: 2000, duration: 0.4, type: 'sine', gain: 0.2, category: 'sfx' });
        this.playTone({ freq: 2000, endFreq: 400, duration: 0.3, type: 'sine', gain: 0.15, category: 'sfx', delay: 0.2 });
    },

    playBreakableCrumble(): void {
        if (!this._throttle('crumble')) return;
        this.playNoise({ duration: 0.3, gain: 0.2, filterFreq: 500, filterEnd: 100, category: 'sfx' });
    },

    playAchievement(): void {
        // Triumphant ascending
        [0, 0.12, 0.24, 0.36].forEach((delay, i) => {
            this.playTone({ freq: 400 + i * 100, endFreq: 500 + i * 100, duration: 0.2, type: 'triangle', gain: 0.2, category: 'ui', delay });
        });
    },

    // ============ LOW-LEVEL HELPERS ============

    playTone(opts: { freq: number; endFreq: number; duration: number; type: OscillatorType; gain: number; category: 'sfx' | 'music' | 'ui'; delay?: number }): void {
        if (!this.ctx) return;
        const now = this.ctx.currentTime + (opts.delay || 0);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = opts.type;
        osc.frequency.setValueAtTime(opts.freq, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(opts.endFreq, 1), now + opts.duration);

        gain.gain.setValueAtTime(opts.gain, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + opts.duration);

        const destGain = opts.category === 'ui' ? this.uiGain : opts.category === 'music' ? this.musicGain : this.sfxGain;
        osc.connect(gain);
        gain.connect(destGain!);

        osc.start(now);
        osc.stop(now + opts.duration + 0.01);
    },

    playNoise(opts: { duration: number; gain: number; category: 'sfx' | 'music' | 'ui'; filterFreq?: number; filterEnd?: number }): void {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Create white noise buffer
        const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * opts.duration));
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(opts.gain, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + opts.duration);

        const destGain = opts.category === 'ui' ? this.uiGain : this.sfxGain;

        if (opts.filterFreq) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(opts.filterFreq, now);
            if (opts.filterEnd) {
                filter.frequency.exponentialRampToValueAtTime(opts.filterEnd, now + opts.duration);
            }
            source.connect(filter);
            filter.connect(gain);
        } else {
            source.connect(gain);
        }

        gain.connect(destGain!);
        source.start(now);
    },
};

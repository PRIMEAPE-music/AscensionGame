const STORAGE_KEY = 'ascension_audio_settings';

interface AudioSettings {
    masterVolume: number;   // 0-1
    musicVolume: number;    // 0-1
    sfxVolume: number;      // 0-1
    uiVolume: number;       // 0-1
}

// Biome music configuration
interface BiomeMusicConfig {
    baseNote: number;  // Root frequency in Hz
    scale: number[];   // Scale intervals in semitones
    mood: 'minor' | 'major' | 'diminished';
    tempo: number;     // BPM
}

const BIOME_MUSIC: Record<string, BiomeMusicConfig> = {
    'CAVERNS':  { baseNote: 110, scale: [0, 2, 3, 5, 7, 8, 10], mood: 'minor', tempo: 80 },
    'TEMPLE':   { baseNote: 130, scale: [0, 2, 4, 5, 7, 9, 11], mood: 'major', tempo: 90 },
    'SKY':      { baseNote: 165, scale: [0, 2, 3, 5, 7, 8, 11], mood: 'minor', tempo: 100 },
    'VOID':     { baseNote: 82,  scale: [0, 1, 3, 4, 6, 7, 9, 10], mood: 'diminished', tempo: 70 },
    'ABYSS':    { baseNote: 98,  scale: [0, 2, 3, 5, 7, 8, 10], mood: 'minor', tempo: 110 },
};

// Map game biome names to music config keys
const BIOME_MAP: Record<string, string> = {
    'HELLFIRE_CAVERNS': 'CAVERNS',
    'CURSED_TEMPLE': 'TEMPLE',
    'SKY_FRAGMENTS': 'SKY',
    'VOID_DEPTHS': 'VOID',
    'ABYSSAL_THRONE': 'ABYSS',
};

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

    // ============ MUSIC STATE ============
    _musicPlaying: false,
    _currentBiome: 'CAVERNS',
    _inCombat: false,
    _inBoss: false,
    _lowHealth: false,
    _musicLoopTimer: null as ReturnType<typeof setTimeout> | null,
    // Sequence state for more musical note selection
    _lastNoteIdx: 0,
    _phraseStep: 0,
    _phraseDirection: 1 as 1 | -1,

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

    // ============ PROCEDURAL MUSIC ============

    startMusic(): void {
        if (this._musicPlaying || !this.ctx) return;
        this._musicPlaying = true;
        this._phraseStep = 0;
        this._lastNoteIdx = 0;
        this._phraseDirection = 1;
        this._scheduleNextBar();
    },

    stopMusic(): void {
        this._musicPlaying = false;
        if (this._musicLoopTimer) {
            clearTimeout(this._musicLoopTimer);
            this._musicLoopTimer = null;
        }
    },

    setBiome(biome: string): void {
        this._currentBiome = BIOME_MAP[biome] || 'CAVERNS';
    },

    setCombatState(inCombat: boolean): void {
        this._inCombat = inCombat;
    },

    setBossState(inBoss: boolean): void {
        this._inBoss = inBoss;
    },

    setLowHealth(low: boolean): void {
        this._lowHealth = low;
    },

    /** Pick the next note index in a musical way — stepwise motion with occasional leaps */
    _pickNextNote(scale: number[]): number {
        this._phraseStep++;
        // Every 8 notes, possibly reverse direction for a natural phrase shape
        if (this._phraseStep % 8 === 0) {
            this._phraseDirection = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
        }
        // 70% stepwise motion, 20% small leap, 10% larger leap
        const roll = Math.random();
        let step: number;
        if (roll < 0.7) {
            step = this._phraseDirection; // move one scale degree
        } else if (roll < 0.9) {
            step = this._phraseDirection * 2; // skip one
        } else {
            step = this._phraseDirection * (Math.random() > 0.5 ? 3 : -2); // leap
        }
        this._lastNoteIdx = ((this._lastNoteIdx + step) % scale.length + scale.length) % scale.length;
        return this._lastNoteIdx;
    },

    _scheduleNextBar(): void {
        if (!this._musicPlaying || !this.ctx) return;

        const biomeConfig = BIOME_MUSIC[this._currentBiome] || BIOME_MUSIC['CAVERNS'];
        const bpm = biomeConfig.tempo;
        const beatDuration = 60 / bpm; // seconds per beat
        const barDuration = beatDuration * 4; // 4/4 time
        const twoBarDuration = barDuration * 2;

        // === BASE LAYER: Ambient drone/pad ===
        this._playMusicDrone(biomeConfig.baseNote, twoBarDuration);

        // Add a subtle fifth drone for richness
        const fifthFreq = biomeConfig.baseNote * 1.5;
        this._playMusicDrone(fifthFreq, twoBarDuration, 0.025);

        // === MELODY LAYER: Sparse arpeggiated notes ===
        const scale = biomeConfig.scale;
        for (let beat = 0; beat < 8; beat++) {
            const noteTime = beat * beatDuration;

            // Sparse: only ~50% of beats get a note (more sparse = more ambient)
            if (Math.random() > 0.5) continue;

            const noteIdx = this._pickNextNote(scale);
            const semitones = scale[noteIdx];
            // One octave above the base note for the melody
            const freq = biomeConfig.baseNote * Math.pow(2, (semitones + 12) / 12);

            // Vary note duration and volume slightly for a human feel
            const noteDur = beatDuration * (0.6 + Math.random() * 0.4);
            const noteVol = 0.05 + Math.random() * 0.04;

            this._playMusicNote(freq, noteTime, noteDur, noteVol);
        }

        // === COMBAT LAYER: Rhythmic percussion ===
        if (this._inCombat || this._inBoss) {
            for (let beat = 0; beat < 8; beat++) {
                const noteTime = beat * beatDuration;
                // Kick on beats 1 and 5
                if (beat === 0 || beat === 4) {
                    this._playMusicPercussion(60, noteTime, 0.15, 0.06);
                }
                // Hi-hat on every beat (soft)
                this._playMusicPercussion(8000, noteTime, 0.03, 0.03);
                // Snare on beats 3 and 7
                if (beat === 2 || beat === 6) {
                    this._playMusicPercussion(200, noteTime, 0.08, 0.05);
                }
            }
        }

        // === BOSS LAYER: Heavy bass notes on root and fifth ===
        if (this._inBoss) {
            // Sub-bass root for first bar
            this._playMusicNote(biomeConfig.baseNote / 2, 0, barDuration, 0.10);
            // Fifth for second bar
            this._playMusicNote(biomeConfig.baseNote / 2 * 1.5, barDuration, barDuration, 0.08);
            // Add syncopated low hits for intensity
            for (let beat = 0; beat < 8; beat++) {
                if (beat % 3 === 1) {
                    this._playMusicPercussion(50, beat * beatDuration, 0.2, 0.05);
                }
            }
        }

        // === LOW HEALTH LAYER: Tense high-frequency pulse ===
        if (this._lowHealth) {
            for (let i = 0; i < 8; i++) {
                if (i % 2 === 0) {
                    this._playMusicNote(
                        biomeConfig.baseNote * 4,
                        i * beatDuration,
                        beatDuration * 0.25,
                        0.035,
                    );
                }
            }
        }

        // Schedule the next 2-bar phrase
        this._musicLoopTimer = setTimeout(() => {
            this._scheduleNextBar();
        }, twoBarDuration * 1000);
    },

    /** Sustained sine drone that fades in and out gently */
    _playMusicDrone(freq: number, duration: number, volume: number = 0.05): void {
        if (!this.ctx || !this.musicGain) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Gentle fade-in / fade-out envelope
        const fadeTime = Math.min(0.8, duration * 0.25);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(volume, now + fadeTime);
        gain.gain.setValueAtTime(volume, now + duration - fadeTime);
        gain.gain.linearRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + duration + 0.02);
    },

    /** Single melodic note with soft attack and exponential decay */
    _playMusicNote(freq: number, delay: number, duration: number, volume: number): void {
        if (!this.ctx || !this.musicGain) return;
        const startTime = this.ctx.currentTime + delay;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle'; // Soft, warm tone
        osc.frequency.setValueAtTime(freq, startTime);

        // Soft attack to avoid clicks
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
    },

    /** Percussion hit using playTone routed through the music gain */
    _playMusicPercussion(freq: number, delay: number, duration: number, volume: number = 0.06): void {
        this.playTone({
            freq,
            endFreq: Math.max(freq * 0.5, 1),
            duration,
            type: 'square',
            gain: volume,
            category: 'music',
            delay,
        });
    },

    /** Slow descending notes for death — plays once, does not loop */
    playDeathMusic(): void {
        if (!this.ctx || !this.musicGain) return;
        // A4 descending to C4: sad, final
        const notes = [440, 392, 349, 330, 294, 262];
        notes.forEach((freq, i) => {
            this._playMusicNote(freq, i * 0.6, 0.8, 0.08);
            // Bass octave underneath
            this._playMusicNote(freq * 0.5, i * 0.6, 1.0, 0.05);
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

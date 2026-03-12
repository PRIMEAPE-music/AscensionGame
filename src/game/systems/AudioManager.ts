import { GameSettings } from './GameSettings';

const STORAGE_KEY = 'ascension_audio_settings';

interface AudioSettings {
    masterVolume: number;   // 0-1
    musicVolume: number;    // 0-1
    sfxVolume: number;      // 0-1
    uiVolume: number;       // 0-1
}

// Gameplay track playlist (shuffled per run)
const GAMEPLAY_TRACKS = ['Warmth', 'gtfu', 'DRIFTIN', 'Bright', 'VIBRATIONS'];
const BOSS_TRACK = 'GRAYHORSE';
const DEATH_TRACK = 'SPIRITS';
const MUSIC_PATH = 'assets/music/';
const CROSSFADE_MS = 3000;

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

    // Mono audio support
    _monoEnabled: false,
    _monoMerger: null as ChannelMergerNode | null,
    _monoSplitter: null as ChannelSplitterNode | null,

    // Throttle tracking for rapidly-repeating sounds
    _lastPlayTime: {} as Record<string, number>,
    _throttleMs: 80, // Minimum ms between same sound

    // ============ MUSIC STATE ============
    _musicPlaying: false,
    _inBoss: false,
    _playlist: [] as string[],
    _playlistIndex: 0,
    _currentTrack: null as HTMLAudioElement | null,
    _currentSource: null as MediaElementAudioSourceNode | null,
    _bossTrack: null as HTMLAudioElement | null,
    _bossSource: null as MediaElementAudioSourceNode | null,
    _fadeInterval: null as ReturnType<typeof setInterval> | null,
    _trackGain: null as GainNode | null,
    _bossGain: null as GainNode | null,
    _deathTrack: null as HTMLAudioElement | null,
    _deathSource: null as MediaElementAudioSourceNode | null,

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

        // Apply mono audio setting from GameSettings
        const gameSettings = GameSettings.get();
        if (gameSettings.monoAudio) {
            this.setMonoMode(true);
        }
    },

    setMonoMode(enabled: boolean): void {
        if (!this.ctx || !this.masterGain) return;
        if (enabled === this._monoEnabled) return;
        this._monoEnabled = enabled;

        // Disconnect master from current destination
        this.masterGain.disconnect();

        if (enabled) {
            // Create splitter -> merger pipeline to merge stereo to mono
            // Splitter takes stereo input and splits into 2 channels
            this._monoSplitter = this.ctx.createChannelSplitter(2);
            // Merger takes 2 inputs and merges into 1 channel output
            this._monoMerger = this.ctx.createChannelMerger(1);

            // Connect master -> splitter
            this.masterGain.connect(this._monoSplitter);
            // Connect both L and R channels into the single mono channel
            this._monoSplitter.connect(this._monoMerger, 0, 0);
            this._monoSplitter.connect(this._monoMerger, 1, 0);
            // Connect merger -> destination
            this._monoMerger.connect(this.ctx.destination);
        } else {
            // Clean up mono nodes
            if (this._monoSplitter) {
                try { this._monoSplitter.disconnect(); } catch { /* already disconnected */ }
                this._monoSplitter = null;
            }
            if (this._monoMerger) {
                try { this._monoMerger.disconnect(); } catch { /* already disconnected */ }
                this._monoMerger = null;
            }
            // Reconnect master directly to destination
            this.masterGain.connect(this.ctx.destination);
        }
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
        // Boss warning sound replaced by boss music crossfade
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

    // ============ MP3 MUSIC PLAYBACK ============

    /** Shuffle the playlist and start playing from the first track */
    startMusic(): void {
        if (this._musicPlaying) return;
        this._musicPlaying = true;

        // Shuffle playlist for this run
        this._playlist = [...GAMEPLAY_TRACKS];
        for (let i = this._playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._playlist[i], this._playlist[j]] = [this._playlist[j], this._playlist[i]];
        }
        this._playlistIndex = 0;
        this._inBoss = false;

        this._playTrack(this._playlist[0]);
    },

    stopMusic(): void {
        this._musicPlaying = false;
        this._inBoss = false;
        this._stopFade();
        this._destroyTrack('_currentTrack', '_currentSource', '_trackGain');
        this._destroyTrack('_bossTrack', '_bossSource', '_bossGain');
        if (this._deathTrack) {
            this._deathTrack.pause();
            this._deathTrack.src = '';
            this._deathTrack = null;
        }
        if (this._deathSource) {
            try { this._deathSource.disconnect(); } catch { /* already disconnected */ }
            this._deathSource = null;
        }
    },

    _destroyTrack(
        audioKey: '_currentTrack' | '_bossTrack',
        sourceKey: '_currentSource' | '_bossSource',
        gainKey: '_trackGain' | '_bossGain',
    ): void {
        const audio = this[audioKey] as HTMLAudioElement | null;
        if (audio) {
            audio.pause();
            audio.src = '';
            (this as any)[audioKey] = null;
        }
        const source = this[sourceKey] as MediaElementAudioSourceNode | null;
        if (source) {
            try { source.disconnect(); } catch { /* already disconnected */ }
            (this as any)[sourceKey] = null;
        }
        const gain = this[gainKey] as GainNode | null;
        if (gain) {
            try { gain.disconnect(); } catch { /* already disconnected */ }
            (this as any)[gainKey] = null;
        }
    },

    /** No-ops kept for API compatibility — these were procedural music layers */
    setBiome(_biome: string): void { /* no-op */ },
    setCombatState(_inCombat: boolean): void { /* no-op */ },
    setLowHealth(_low: boolean): void { /* no-op */ },

    /** Crossfade from gameplay music to boss track */
    setBossState(inBoss: boolean): void {
        if (inBoss === this._inBoss) return;
        this._inBoss = inBoss;

        if (inBoss) {
            this._crossfadeToBoss();
        } else {
            this._crossfadeToGameplay();
        }
    },

    /** Start boss music: fade out gameplay track, fade in GRAYHORSE */
    startBossMusic(): void {
        if (this._inBoss) return;
        this._inBoss = true;
        this._crossfadeToBoss();
    },

    _playTrack(name: string): void {
        if (!this.ctx || !this.musicGain) return;

        // Clean up previous track fully
        this._destroyTrack('_currentTrack', '_currentSource', '_trackGain');

        // Create audio element
        const audio = new Audio(`${MUSIC_PATH}${name}.mp3`);
        audio.loop = false;
        audio.preload = 'auto';

        // Create per-track gain for crossfading
        const trackGain = this.ctx.createGain();
        trackGain.gain.value = 1.0;
        trackGain.connect(this.musicGain!);

        const source = this.ctx.createMediaElementSource(audio);
        source.connect(trackGain);

        this._currentTrack = audio;
        this._currentSource = source;
        this._trackGain = trackGain;

        // When track ends, advance to next in playlist
        audio.addEventListener('ended', () => {
            if (!this._musicPlaying || this._inBoss) return;
            this._playlistIndex = (this._playlistIndex + 1) % this._playlist.length;
            this._playTrack(this._playlist[this._playlistIndex]);
        });

        audio.play().catch(() => { /* autoplay blocked — will resume on user gesture */ });
    },

    _crossfadeToBoss(): void {
        if (!this.ctx || !this.musicGain) return;
        this._stopFade();

        // Create boss audio
        const audio = new Audio(`${MUSIC_PATH}${BOSS_TRACK}.mp3`);
        audio.loop = true;
        audio.preload = 'auto';

        const bossGain = this.ctx.createGain();
        bossGain.gain.value = 0;
        bossGain.connect(this.musicGain!);

        const source = this.ctx.createMediaElementSource(audio);
        source.connect(bossGain);

        this._bossTrack = audio;
        this._bossSource = source;
        this._bossGain = bossGain;

        audio.play().catch(() => {});

        // Crossfade: fade out gameplay, fade in boss over CROSSFADE_MS
        const steps = 30;
        const stepMs = CROSSFADE_MS / steps;
        let step = 0;
        this._fadeInterval = setInterval(() => {
            step++;
            const t = step / steps;
            if (this._trackGain) this._trackGain.gain.value = Math.max(0, 1 - t);
            if (this._bossGain) this._bossGain.gain.value = t;
            if (step >= steps) {
                this._stopFade();
                // Pause gameplay track (don't destroy — we'll resume after boss)
                if (this._currentTrack) this._currentTrack.pause();
            }
        }, stepMs);
    },

    _crossfadeToGameplay(): void {
        if (!this.ctx || !this.musicGain) return;
        this._stopFade();

        // Resume gameplay track from where it was, or advance to next
        if (this._currentTrack && this._trackGain) {
            this._trackGain.gain.value = 0;
            this._currentTrack.play().catch(() => {});
        } else {
            // No track to resume — start next
            this._playlistIndex = (this._playlistIndex + 1) % this._playlist.length;
            this._playTrack(this._playlist[this._playlistIndex]);
            if (this._trackGain) this._trackGain.gain.value = 0;
        }

        // Crossfade: fade out boss, fade in gameplay over CROSSFADE_MS
        const steps = 30;
        const stepMs = CROSSFADE_MS / steps;
        let step = 0;
        this._fadeInterval = setInterval(() => {
            step++;
            const t = step / steps;
            if (this._bossGain) this._bossGain.gain.value = Math.max(0, 1 - t);
            if (this._trackGain) this._trackGain.gain.value = t;
            if (step >= steps) {
                this._stopFade();
                if (this._bossTrack) {
                    this._bossTrack.pause();
                    this._bossTrack.currentTime = 0;
                }
            }
        }, stepMs);
    },

    _stopFade(): void {
        if (this._fadeInterval) {
            clearInterval(this._fadeInterval);
            this._fadeInterval = null;
        }
    },

    /** Play SPIRITS on death — fully stops all music first, then plays death track */
    playDeathMusic(): void {
        if (!this.ctx || !this.musicGain) return;

        // Fully stop all current music (crossfades, gameplay, boss)
        this._musicPlaying = false;
        this._inBoss = false;
        this._stopFade();
        this._destroyTrack('_currentTrack', '_currentSource', '_trackGain');
        this._destroyTrack('_bossTrack', '_bossSource', '_bossGain');

        const audio = new Audio(`${MUSIC_PATH}${DEATH_TRACK}.mp3`);
        audio.loop = false;
        audio.preload = 'auto';

        const source = this.ctx.createMediaElementSource(audio);
        source.connect(this.musicGain!);

        this._deathTrack = audio;
        this._deathSource = source;

        audio.play().catch(() => {});
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

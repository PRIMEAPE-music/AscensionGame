const STORAGE_KEY = "ascension_replays";
const MAX_SAVED_REPLAYS = 3;
const RECORD_INTERVAL_MS = 100; // 10 frames per second

export interface FrameSnapshot {
  tick: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  flipX: boolean;
  animation: string;
  health: number;
  altitude: number;
}

export interface ReplayMetadata {
  name: string;
  classType: string;
  date: string;
  duration: number;
  altitude: number;
  kills: number;
  bossesDefeated: number;
  seed?: number;
}

export interface ReplayData {
  metadata: ReplayMetadata;
  frames: DeltaFrame[];
}

/**
 * Delta-compressed frame: only stores fields that changed from the previous frame.
 * tick is always present.
 */
export interface DeltaFrame {
  t: number; // tick
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: boolean;
  a?: string;   // animation
  h?: number;    // health
  alt?: number;  // altitude
}

interface StoredReplays {
  replays: ReplayData[];
}

// Module state
let currentRecording: FrameSnapshot[] | null = null;
let currentClassType: string = "";
let recordingStartTime: number = 0;
let currentTick: number = 0;
let timerAccumulator: number = 0;
let savedReplays: ReplayData[] = [];
let lastRecording: ReplayData | null = null;

// Playback state
let playbackData: ReplayData | null = null;
let playbackTick: number = 0;
let playbackSpeed: number = 1;
let playbackPaused: boolean = false;
let playbackActive: boolean = false;
let playbackAccumulator: number = 0;

function compressFrames(frames: FrameSnapshot[]): DeltaFrame[] {
  if (frames.length === 0) return [];

  const deltas: DeltaFrame[] = [];

  // First frame: store everything
  const first = frames[0];
  deltas.push({
    t: first.tick,
    x: first.x,
    y: first.y,
    vx: first.velocityX,
    vy: first.velocityY,
    fx: first.flipX,
    a: first.animation,
    h: first.health,
    alt: first.altitude,
  });

  // Subsequent frames: only store deltas
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const delta: DeltaFrame = { t: curr.tick };

    if (curr.x !== prev.x) delta.x = curr.x;
    if (curr.y !== prev.y) delta.y = curr.y;
    if (curr.velocityX !== prev.velocityX) delta.vx = curr.velocityX;
    if (curr.velocityY !== prev.velocityY) delta.vy = curr.velocityY;
    if (curr.flipX !== prev.flipX) delta.fx = curr.flipX;
    if (curr.animation !== prev.animation) delta.a = curr.animation;
    if (curr.health !== prev.health) delta.h = curr.health;
    if (curr.altitude !== prev.altitude) delta.alt = curr.altitude;

    deltas.push(delta);
  }

  return deltas;
}

function decompressFrames(deltas: DeltaFrame[]): FrameSnapshot[] {
  if (deltas.length === 0) return [];

  const frames: FrameSnapshot[] = [];
  const first = deltas[0];
  const firstFrame: FrameSnapshot = {
    tick: first.t,
    x: first.x ?? 0,
    y: first.y ?? 0,
    velocityX: first.vx ?? 0,
    velocityY: first.vy ?? 0,
    flipX: first.fx ?? false,
    animation: first.a ?? "",
    health: first.h ?? 0,
    altitude: first.alt ?? 0,
  };
  frames.push(firstFrame);

  for (let i = 1; i < deltas.length; i++) {
    const prev = frames[i - 1];
    const delta = deltas[i];
    frames.push({
      tick: delta.t,
      x: delta.x ?? prev.x,
      y: delta.y ?? prev.y,
      velocityX: delta.vx ?? prev.velocityX,
      velocityY: delta.vy ?? prev.velocityY,
      flipX: delta.fx ?? prev.flipX,
      animation: delta.a ?? prev.animation,
      health: delta.h ?? prev.health,
      altitude: delta.alt ?? prev.altitude,
    });
  }

  return frames;
}

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: StoredReplays = JSON.parse(raw);
      savedReplays = parsed.replays || [];
    } else {
      savedReplays = [];
    }
  } catch {
    savedReplays = [];
  }
}

function saveToStorage(): void {
  try {
    const data: StoredReplays = { replays: savedReplays };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable; silently ignore
  }
}

export const ReplayManager = {
  /** Load saved replays from localStorage */
  load(): void {
    loadFromStorage();
  },

  /** Start recording a new run */
  startRecording(classType: string): void {
    currentRecording = [];
    currentClassType = classType;
    recordingStartTime = Date.now();
    currentTick = 0;
    timerAccumulator = 0;
  },

  /**
   * Called every frame from MainScene.update().
   * Uses a timer accumulator to record at fixed intervals.
   * @param player - The Phaser player sprite
   * @param delta - Frame delta in ms
   * @param altitude - Current altitude value
   */
  recordFrame(player: any, delta: number, altitude: number): void {
    if (!currentRecording) return;

    timerAccumulator += delta;
    if (timerAccumulator < RECORD_INTERVAL_MS) return;
    timerAccumulator -= RECORD_INTERVAL_MS;

    const snapshot: FrameSnapshot = {
      tick: currentTick,
      x: Math.round(player.x),
      y: Math.round(player.y),
      velocityX: Math.round(player.body?.velocity?.x ?? 0),
      velocityY: Math.round(player.body?.velocity?.y ?? 0),
      flipX: player.flipX ?? false,
      animation: player.anims?.currentAnim?.key ?? "",
      health: player.health ?? 0,
      altitude: Math.floor(altitude),
    };

    currentRecording.push(snapshot);
    currentTick++;
  },

  /** Stop recording and build final replay data */
  stopRecording(runStats: {
    altitude: number;
    kills: number;
    bossesDefeated: number;
    timeMs: number;
  }): void {
    if (!currentRecording) return;

    const metadata: ReplayMetadata = {
      name: "Last Run",
      classType: currentClassType,
      date: new Date().toISOString(),
      duration: runStats.timeMs,
      altitude: runStats.altitude,
      kills: runStats.kills,
      bossesDefeated: runStats.bossesDefeated,
    };

    const compressed = compressFrames(currentRecording);

    lastRecording = {
      metadata,
      frames: compressed,
    };

    currentRecording = null;
    currentTick = 0;
    timerAccumulator = 0;
  },

  /** Save the current (last) recording to localStorage */
  saveReplay(name?: string): void {
    if (!lastRecording) return;

    loadFromStorage();

    const replayToSave: ReplayData = {
      ...lastRecording,
      metadata: {
        ...lastRecording.metadata,
        name: name || `Run - ${new Date(lastRecording.metadata.date).toLocaleDateString()}`,
      },
    };

    // Add to the beginning of the list
    savedReplays.unshift(replayToSave);

    // Trim to max saved replays
    if (savedReplays.length > MAX_SAVED_REPLAYS) {
      savedReplays = savedReplays.slice(0, MAX_SAVED_REPLAYS);
    }

    saveToStorage();
  },

  /** Get list of saved replay metadata */
  getReplayList(): ReplayMetadata[] {
    loadFromStorage();
    return savedReplays.map((r) => ({ ...r.metadata }));
  },

  /** Load a full replay by index */
  loadReplay(index: number): ReplayData | null {
    loadFromStorage();
    if (index < 0 || index >= savedReplays.length) return null;
    return savedReplays[index];
  },

  /** Delete a saved replay by index */
  deleteReplay(index: number): void {
    loadFromStorage();
    if (index < 0 || index >= savedReplays.length) return;
    savedReplays.splice(index, 1);
    saveToStorage();
  },

  /** Get the current unsaved recording (last run) */
  getCurrentRecording(): ReplayData | null {
    return lastRecording;
  },

  /** Check if there is an unsaved recording from the last run */
  hasUnsavedRecording(): boolean {
    return lastRecording !== null;
  },

  // ─── Playback ───────────────────────────────────────────────────────

  /** Start playing back a replay */
  startPlayback(replayData: ReplayData): void {
    playbackData = replayData;
    playbackTick = 0;
    playbackSpeed = 1;
    playbackPaused = false;
    playbackActive = true;
    playbackAccumulator = 0;
  },

  /** Stop playback */
  stopPlayback(): void {
    playbackData = null;
    playbackTick = 0;
    playbackActive = false;
    playbackPaused = false;
    playbackAccumulator = 0;
  },

  /** Toggle pause during playback */
  togglePlaybackPause(): void {
    playbackPaused = !playbackPaused;
  },

  /** Set playback speed (0.5, 1, or 2) */
  setPlaybackSpeed(speed: number): void {
    playbackSpeed = speed;
  },

  /** Get current playback speed */
  getPlaybackSpeed(): number {
    return playbackSpeed;
  },

  /** Check if playback is active */
  isPlaying(): boolean {
    return playbackActive;
  },

  /** Check if playback is paused */
  isPaused(): boolean {
    return playbackPaused;
  },

  /**
   * Update playback state. Returns the current frame snapshot if playing,
   * or null if playback is finished/inactive.
   */
  updatePlayback(delta: number): FrameSnapshot | null {
    if (!playbackActive || !playbackData || playbackPaused) return null;

    playbackAccumulator += delta * playbackSpeed;

    if (playbackAccumulator >= RECORD_INTERVAL_MS) {
      playbackAccumulator -= RECORD_INTERVAL_MS;
      playbackTick++;
    }

    const frames = playbackData.frames;
    if (playbackTick >= frames.length) {
      // Playback complete
      this.stopPlayback();
      return null;
    }

    // Decompress on the fly: rebuild the current frame from deltas
    // For efficiency, we decompress only up to the current tick
    const decompressed = decompressFrames(frames.slice(0, playbackTick + 1));
    return decompressed[decompressed.length - 1] || null;
  },

  /** Get total number of frames in the current playback */
  getPlaybackTotalFrames(): number {
    return playbackData?.frames.length ?? 0;
  },

  /** Get current playback frame index */
  getPlaybackCurrentFrame(): number {
    return playbackTick;
  },

  /** Get the replay data currently being played */
  getPlaybackData(): ReplayData | null {
    return playbackData;
  },
};

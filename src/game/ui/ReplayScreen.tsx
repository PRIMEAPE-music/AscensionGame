import React, { useState, useEffect } from "react";
import { ReplayManager } from "../systems/ReplayManager";
import type { ReplayMetadata } from "../systems/ReplayManager";

interface ReplayScreenProps {
  onBack: () => void;
  onWatch: (replayIndex: number) => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}

const CLASS_COLORS: Record<string, string> = {
  PALADIN: "#6688ff",
  MONK: "#ffcc44",
  PRIEST: "#88ff88",
};

export const ReplayScreen: React.FC<ReplayScreenProps> = ({ onBack, onWatch }) => {
  const [replays, setReplays] = useState<ReplayMetadata[]>([]);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  useEffect(() => {
    ReplayManager.load();
    setReplays(ReplayManager.getReplayList());
    setHasUnsaved(ReplayManager.hasUnsavedRecording());
  }, []);

  const handleSaveLastRun = () => {
    ReplayManager.saveReplay();
    setReplays(ReplayManager.getReplayList());
    setHasUnsaved(false);
  };

  const handleDelete = (index: number) => {
    ReplayManager.deleteReplay(index);
    setReplays(ReplayManager.getReplayList());
  };

  const handleWatch = (index: number) => {
    onWatch(index);
  };

  const getButtonStyle = (id: string, variant: "primary" | "secondary" | "danger" = "secondary"): React.CSSProperties => {
    const isHovered = hoveredButton === id;
    const base: React.CSSProperties = {
      padding: "10px 20px",
      fontSize: "14px",
      fontFamily: "monospace",
      fontWeight: "bold",
      letterSpacing: "2px",
      textTransform: "uppercase",
      border: "1px solid",
      borderRadius: "4px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      outline: "none",
    };

    if (variant === "primary") {
      return {
        ...base,
        background: isHovered
          ? "rgba(100, 200, 255, 0.25)"
          : "rgba(100, 200, 255, 0.1)",
        borderColor: isHovered
          ? "rgba(100, 200, 255, 0.6)"
          : "rgba(100, 200, 255, 0.3)",
        color: isHovered ? "#80ddff" : "#60bbdd",
      };
    }

    if (variant === "danger") {
      return {
        ...base,
        background: isHovered
          ? "rgba(255, 80, 80, 0.25)"
          : "rgba(255, 80, 80, 0.1)",
        borderColor: isHovered
          ? "rgba(255, 80, 80, 0.6)"
          : "rgba(255, 80, 80, 0.3)",
        color: isHovered ? "#ff8888" : "#cc6666",
      };
    }

    return {
      ...base,
      background: isHovered
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(255, 255, 255, 0.04)",
      borderColor: isHovered
        ? "rgba(255, 255, 255, 0.3)"
        : "rgba(255, 255, 255, 0.12)",
      color: isHovered ? "#fff" : "rgba(200, 200, 220, 0.7)",
    };
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a12",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "monospace",
        color: "white",
        zIndex: 100,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          marginTop: "60px",
          marginBottom: "40px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "48px",
            fontWeight: "bold",
            letterSpacing: "8px",
            textTransform: "uppercase",
            color: "#e0d0a0",
            margin: 0,
          }}
        >
          Replays
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "rgba(200, 200, 220, 0.4)",
            letterSpacing: "3px",
            textTransform: "uppercase",
            marginTop: "8px",
          }}
        >
          Review your past runs
        </p>
      </div>

      {/* Save Last Run button */}
      {hasUnsaved && (
        <div style={{ marginBottom: "24px" }}>
          <button
            style={getButtonStyle("save-last", "primary")}
            onMouseEnter={() => setHoveredButton("save-last")}
            onMouseLeave={() => setHoveredButton(null)}
            onClick={handleSaveLastRun}
          >
            Save Last Run
          </button>
        </div>
      )}

      {/* Replay list */}
      <div
        style={{
          width: "700px",
          maxHeight: "400px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {replays.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "rgba(200, 200, 220, 0.35)",
              fontSize: "16px",
              padding: "60px 0",
              letterSpacing: "2px",
            }}
          >
            No saved replays yet.
            {!hasUnsaved && " Complete a run to record a replay."}
          </div>
        )}

        {replays.map((replay, index) => {
          const classColor = CLASS_COLORS[replay.classType] || "#e0d0a0";
          return (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "6px",
              }}
            >
              {/* Info section */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: "#e0d0a0",
                    marginBottom: "6px",
                  }}
                >
                  {replay.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "24px",
                    fontSize: "12px",
                    color: "rgba(200, 200, 220, 0.5)",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ color: classColor }}>{replay.classType}</span>
                  <span>{replay.altitude}m</span>
                  <span>{formatTime(replay.duration)}</span>
                  <span>{replay.kills} kills</span>
                  <span>{replay.bossesDefeated} bosses</span>
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(200, 200, 220, 0.3)",
                    marginTop: "4px",
                  }}
                >
                  {formatDate(replay.date)}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "8px", marginLeft: "16px" }}>
                <button
                  style={getButtonStyle(`watch-${index}`, "primary")}
                  onMouseEnter={() => setHoveredButton(`watch-${index}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  onClick={() => handleWatch(index)}
                >
                  Watch
                </button>
                <button
                  style={getButtonStyle(`delete-${index}`, "danger")}
                  onMouseEnter={() => setHoveredButton(`delete-${index}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  onClick={() => handleDelete(index)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Back button */}
      <div style={{ marginTop: "40px" }}>
        <button
          style={getButtonStyle("back")}
          onMouseEnter={() => setHoveredButton("back")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={onBack}
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
};

// ─── Playback Controls Overlay ──────────────────────────────────────────

interface PlaybackControlsProps {
  onStop: () => void;
}

const SPEED_OPTIONS = [0.5, 1, 2] as const;

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({ onStop }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame(ReplayManager.getPlaybackCurrentFrame());
      setTotalFrames(ReplayManager.getPlaybackTotalFrames());
      setIsPaused(ReplayManager.isPaused());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleTogglePause = () => {
    ReplayManager.togglePlaybackPause();
    setIsPaused(!isPaused);
  };

  const handleCycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(speed as typeof SPEED_OPTIONS[number]);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    const newSpeed = SPEED_OPTIONS[nextIndex];
    ReplayManager.setPlaybackSpeed(newSpeed);
    setSpeed(newSpeed);
  };

  const handleStop = () => {
    ReplayManager.stopPlayback();
    onStop();
  };

  const progress = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  const controlBtnStyle = (id: string): React.CSSProperties => {
    const isHovered = hoveredButton === id;
    return {
      padding: "8px 16px",
      fontSize: "14px",
      fontFamily: "monospace",
      fontWeight: "bold",
      letterSpacing: "1px",
      textTransform: "uppercase",
      border: "1px solid",
      borderRadius: "4px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      outline: "none",
      background: isHovered
        ? "rgba(255, 255, 255, 0.15)"
        : "rgba(255, 255, 255, 0.06)",
      borderColor: isHovered
        ? "rgba(255, 255, 255, 0.4)"
        : "rgba(255, 255, 255, 0.15)",
      color: isHovered ? "#fff" : "rgba(200, 200, 220, 0.8)",
    };
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "30px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        zIndex: 200,
        pointerEvents: "auto",
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          width: "400px",
          height: "4px",
          background: "rgba(255, 255, 255, 0.1)",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "rgba(100, 200, 255, 0.6)",
            transition: "width 0.1s linear",
          }}
        />
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          padding: "10px 20px",
          background: "rgba(10, 10, 18, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "8px",
          backdropFilter: "blur(8px)",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "rgba(100, 200, 255, 0.8)",
            letterSpacing: "2px",
            textTransform: "uppercase",
            fontFamily: "monospace",
            marginRight: "8px",
          }}
        >
          Replay
        </span>

        <button
          style={controlBtnStyle("pause")}
          onMouseEnter={() => setHoveredButton("pause")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={handleTogglePause}
        >
          {isPaused ? "Play" : "Pause"}
        </button>

        <button
          style={controlBtnStyle("speed")}
          onMouseEnter={() => setHoveredButton("speed")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={handleCycleSpeed}
        >
          {speed}x
        </button>

        <button
          style={controlBtnStyle("stop")}
          onMouseEnter={() => setHoveredButton("stop")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={handleStop}
        >
          Stop
        </button>

        <span
          style={{
            fontSize: "11px",
            color: "rgba(200, 200, 220, 0.4)",
            fontFamily: "monospace",
            marginLeft: "8px",
            minWidth: "60px",
            textAlign: "right",
          }}
        >
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
};

export default ReplayScreen;

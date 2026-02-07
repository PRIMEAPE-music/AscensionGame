import React from "react";

interface PauseMenuProps {
  altitude: number;
  elapsedTime: number;
  itemCount: number;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  altitude,
  elapsedTime,
  itemCount,
  onResume,
  onRestart,
  onQuit,
}) => {
  const buttonStyle: React.CSSProperties = {
    width: "240px",
    padding: "14px 0",
    fontSize: "18px",
    fontFamily: "monospace",
    fontWeight: "bold",
    letterSpacing: "2px",
    textTransform: "uppercase",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#ddd",
    border: "1px solid #444",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    pointerEvents: "auto",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "monospace",
        color: "white",
        zIndex: 200,
        pointerEvents: "auto",
      }}
    >
      <h1
        style={{
          fontSize: "42px",
          fontWeight: "bold",
          marginBottom: "32px",
          letterSpacing: "4px",
          textTransform: "uppercase",
          color: "#e0d0a0",
          textShadow: "0 0 20px rgba(224, 208, 160, 0.3)",
        }}
      >
        Paused
      </h1>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          gap: "40px",
          marginBottom: "40px",
          padding: "16px 32px",
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid #333",
          borderRadius: "6px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "12px",
              color: "#888",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Altitude
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            {Math.floor(altitude)}m
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "12px",
              color: "#888",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Time
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            {formatTime(elapsedTime)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "12px",
              color: "#888",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Items
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            {itemCount}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <button
          onClick={onResume}
          style={{
            ...buttonStyle,
            backgroundColor: "rgba(224, 208, 160, 0.15)",
            borderColor: "#e0d0a0",
            color: "#e0d0a0",
          }}
        >
          Resume
        </button>
        <button onClick={onRestart} style={buttonStyle}>
          Restart
        </button>
        <button
          onClick={onQuit}
          style={{ ...buttonStyle, color: "#f44336", borderColor: "#f4433666" }}
        >
          Quit
        </button>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback, useRef } from "react";
import { OnlineCoopManager } from "../systems/OnlineCoopManager";
import { CLASSES } from "../config/ClassConfig";
import type { ClassType } from "../config/ClassConfig";

interface OnlineLobbyProps {
  onBack: () => void;
  onStartGame: (
    role: "host" | "guest",
    roomCode: string,
    hostClass: string,
    guestClass: string
  ) => void;
}

type LobbyMode = "choose" | "hosting" | "joining" | "waiting" | "ready";

const VALID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const classTypes = Object.keys(CLASSES) as ClassType[];

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

const BACKGROUND = "#0a0a12";
const GOLD = "#ffd700";
const TEXT_PRIMARY = "#e0d0a0";
const TEXT_DIM = "rgba(200, 200, 220, 0.6)";
const BORDER_DIM = "rgba(224, 208, 160, 0.25)";
const BORDER_HIGHLIGHT = GOLD;

const baseButtonStyle: React.CSSProperties = {
  padding: "14px 28px",
  fontSize: "18px",
  fontFamily: "monospace",
  fontWeight: "bold",
  letterSpacing: "3px",
  textTransform: "uppercase",
  border: `1px solid ${BORDER_DIM}`,
  borderRadius: "6px",
  cursor: "pointer",
  transition: "all 0.25s ease",
  outline: "none",
  background: "rgba(224, 208, 160, 0.06)",
  color: TEXT_PRIMARY,
  textAlign: "center" as const,
};

const hoveredButtonOverrides: React.CSSProperties = {
  background: "rgba(255, 215, 0, 0.12)",
  borderColor: GOLD,
  color: GOLD,
  textShadow: `0 0 12px rgba(255, 215, 0, 0.4)`,
};

// ---------------------------------------------------------------------------
// Spinner keyframes (injected once)
// ---------------------------------------------------------------------------

let spinnerInjected = false;

function ensureSpinnerKeyframes() {
  if (spinnerInjected) return;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes onlineLobby_spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes onlineLobby_pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  spinnerInjected = true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const OnlineLobby: React.FC<OnlineLobbyProps> = ({
  onBack,
  onStartGame,
}) => {
  const [mode, setMode] = useState<LobbyMode>("choose");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassType>("PALADIN");
  const [guestClass, setGuestClass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const [connectionState, setConnectionState] = useState("");

  // Hover tracking
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const roleRef = useRef<"host" | "guest">("host");

  // Inject spinner CSS once
  useEffect(() => {
    ensureSpinnerKeyframes();
  }, []);

  // Register lobby update listener
  useEffect(() => {
    OnlineCoopManager.onLobbyUpdate((data) => {
      setConnectionState(data.state);
      setLatency(data.latency);

      if (data.roomCode) {
        setRoomCode(data.roomCode);
      }

      if (data.guestClass) {
        setGuestClass(data.guestClass);
      }

      if (data.state === "ready") {
        setMode("ready");
      } else if (data.state === "connected" && roleRef.current === "guest") {
        setMode("waiting");
      } else if (data.state === "class-selected" && roleRef.current === "host") {
        // Guest selected class — remain in hosting mode, but we now show their class
      }
    });

    return () => {
      OnlineCoopManager.onLobbyUpdate(() => {});
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleHost = useCallback(async () => {
    setError(null);
    roleRef.current = "host";
    setMode("hosting");

    try {
      const code = await OnlineCoopManager.hostGame(selectedClass);
      setRoomCode(code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setMode("choose");
    }
  }, [selectedClass]);

  const handleJoin = useCallback(() => {
    setError(null);
    roleRef.current = "guest";
    setMode("joining");
  }, []);

  const handleConnect = useCallback(async () => {
    if (joinCode.length < 6) {
      setError("Room code must be 6 characters");
      return;
    }

    setError(null);

    try {
      await OnlineCoopManager.joinGame(joinCode, selectedClass);
      setRoomCode(joinCode);
      setMode("waiting");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join room");
      setMode("joining");
    }
  }, [joinCode, selectedClass]);

  const handleStartGame = useCallback(() => {
    onStartGame("host", roomCode, selectedClass, guestClass);
  }, [onStartGame, roomCode, selectedClass, guestClass]);

  const handleBackFromLobby = useCallback(() => {
    OnlineCoopManager.disconnect();
    setMode("choose");
    setRoomCode("");
    setJoinCode("");
    setGuestClass("");
    setError(null);
    setConnectionState("");
    setLatency(0);
  }, []);

  // ---------------------------------------------------------------------------
  // Join code input filter
  // ---------------------------------------------------------------------------

  const handleJoinCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.toUpperCase();
      const filtered = raw
        .split("")
        .filter((ch) => VALID_CHARS.includes(ch))
        .join("")
        .slice(0, 6);
      setJoinCode(filtered);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Button helper
  // ---------------------------------------------------------------------------

  const btn = (
    id: string,
    label: string,
    onClick: () => void,
    extraStyle?: React.CSSProperties
  ) => {
    const isHovered = hoveredBtn === id;
    return (
      <button
        key={id}
        style={{
          ...baseButtonStyle,
          ...extraStyle,
          ...(isHovered ? hoveredButtonOverrides : {}),
        }}
        onMouseEnter={() => setHoveredBtn(id)}
        onMouseLeave={() => setHoveredBtn(null)}
        onClick={onClick}
      >
        {label}
      </button>
    );
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderClassSelector = () => (
    <div
      style={{
        display: "flex",
        gap: "16px",
        marginBottom: "32px",
      }}
    >
      {classTypes.map((ct) => {
        const isSelected = selectedClass === ct;
        const isHovered = hoveredBtn === `class-${ct}`;
        return (
          <button
            key={ct}
            style={{
              ...baseButtonStyle,
              width: "140px",
              padding: "12px 16px",
              fontSize: "14px",
              letterSpacing: "2px",
              borderColor: isSelected
                ? GOLD
                : isHovered
                  ? "rgba(255, 215, 0, 0.5)"
                  : BORDER_DIM,
              background: isSelected
                ? "rgba(255, 215, 0, 0.15)"
                : isHovered
                  ? "rgba(255, 215, 0, 0.06)"
                  : "rgba(224, 208, 160, 0.06)",
              color: isSelected ? GOLD : isHovered ? GOLD : TEXT_PRIMARY,
              textShadow: isSelected
                ? `0 0 10px rgba(255, 215, 0, 0.4)`
                : "none",
            }}
            onMouseEnter={() => setHoveredBtn(`class-${ct}`)}
            onMouseLeave={() => setHoveredBtn(null)}
            onClick={() => setSelectedClass(ct)}
          >
            {CLASSES[ct].name}
          </button>
        );
      })}
    </div>
  );

  const renderLatency = () => {
    if (latency <= 0) return null;
    const color =
      latency < 80
        ? "#44ff44"
        : latency < 150
          ? GOLD
          : "#ff4444";
    return (
      <div
        style={{
          fontSize: "12px",
          fontFamily: "monospace",
          color,
          marginTop: "12px",
          letterSpacing: "1px",
        }}
      >
        PING: {latency}ms
      </div>
    );
  };

  const renderSpinner = () => (
    <div
      style={{
        width: "24px",
        height: "24px",
        border: `2px solid rgba(255, 215, 0, 0.2)`,
        borderTopColor: GOLD,
        borderRadius: "50%",
        animation: "onlineLobby_spin 1s linear infinite",
        margin: "0 auto",
      }}
    />
  );

  const renderError = () => {
    if (!error) return null;
    return (
      <div
        style={{
          color: "#ff4444",
          fontSize: "14px",
          fontFamily: "monospace",
          marginTop: "12px",
          letterSpacing: "1px",
        }}
      >
        {error}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Mode: choose
  // ---------------------------------------------------------------------------

  const renderChoose = () => (
    <>
      <h1
        style={{
          fontSize: "36px",
          fontWeight: "bold",
          letterSpacing: "6px",
          textTransform: "uppercase",
          color: TEXT_PRIMARY,
          marginBottom: "8px",
          textShadow: "0 0 20px rgba(224, 208, 160, 0.3)",
        }}
      >
        Online Co-Op
      </h1>

      <div
        style={{
          fontSize: "13px",
          color: TEXT_DIM,
          letterSpacing: "2px",
          textTransform: "uppercase",
          marginBottom: "32px",
        }}
      >
        Select your class
      </div>

      {renderClassSelector()}

      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        {btn("host", "Host Game", handleHost, { width: "200px" })}
        {btn("join", "Join Game", handleJoin, { width: "200px" })}
      </div>

      {btn("back", "Back", onBack, {
        fontSize: "14px",
        padding: "10px 24px",
        letterSpacing: "2px",
        color: TEXT_DIM,
        borderColor: "rgba(255, 255, 255, 0.08)",
        background: "transparent",
      })}

      {renderError()}
    </>
  );

  // ---------------------------------------------------------------------------
  // Mode: hosting
  // ---------------------------------------------------------------------------

  const renderHosting = () => (
    <>
      <div
        style={{
          fontSize: "14px",
          color: TEXT_DIM,
          letterSpacing: "3px",
          textTransform: "uppercase",
          marginBottom: "16px",
        }}
      >
        Room Code
      </div>

      <div
        style={{
          fontSize: "48px",
          fontWeight: "bold",
          fontFamily: "monospace",
          color: GOLD,
          letterSpacing: "12px",
          textShadow: `0 0 20px rgba(255, 215, 0, 0.4)`,
          marginBottom: "32px",
          userSelect: "all",
        }}
      >
        {roomCode || "------"}
      </div>

      <div
        style={{
          fontSize: "14px",
          color: TEXT_DIM,
          letterSpacing: "2px",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        Your Class: {CLASSES[selectedClass].name}
      </div>

      {guestClass ? (
        <div
          style={{
            fontSize: "14px",
            color: TEXT_PRIMARY,
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: "24px",
          }}
        >
          Guest Class:{" "}
          <span style={{ color: GOLD }}>
            {CLASSES[guestClass as ClassType]?.name ?? guestClass}
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "14px",
              color: TEXT_DIM,
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "16px",
              animation: "onlineLobby_pulse 2s ease-in-out infinite",
            }}
          >
            Waiting for player...
          </div>
          {renderSpinner()}
        </div>
      )}

      {guestClass &&
        connectionState === "ready" &&
        btn("start", "Start Game", handleStartGame, {
          width: "240px",
          fontSize: "20px",
          padding: "16px 32px",
          borderColor: GOLD,
          color: GOLD,
          background: "rgba(255, 215, 0, 0.1)",
        })}

      {renderLatency()}

      <div style={{ marginTop: "32px" }}>
        {btn("cancel-host", "Cancel", handleBackFromLobby, {
          fontSize: "13px",
          padding: "8px 20px",
          letterSpacing: "2px",
          color: TEXT_DIM,
          borderColor: "rgba(255, 255, 255, 0.08)",
          background: "transparent",
        })}
      </div>

      {renderError()}
    </>
  );

  // ---------------------------------------------------------------------------
  // Mode: joining
  // ---------------------------------------------------------------------------

  const renderJoining = () => {
    const isConnectHovered = hoveredBtn === "connect";
    return (
      <>
        <div
          style={{
            fontSize: "14px",
            color: TEXT_DIM,
            letterSpacing: "3px",
            textTransform: "uppercase",
            marginBottom: "16px",
          }}
        >
          Enter Room Code
        </div>

        <input
          type="text"
          value={joinCode}
          onChange={handleJoinCodeChange}
          maxLength={6}
          autoFocus
          placeholder="------"
          style={{
            width: "280px",
            padding: "14px 20px",
            fontSize: "36px",
            fontFamily: "monospace",
            fontWeight: "bold",
            letterSpacing: "10px",
            textAlign: "center",
            textTransform: "uppercase",
            color: GOLD,
            background: "rgba(10, 10, 18, 0.9)",
            border: `2px solid ${BORDER_HIGHLIGHT}`,
            borderRadius: "6px",
            outline: "none",
            caretColor: GOLD,
            marginBottom: "24px",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConnect();
          }}
        />

        <div
          style={{
            fontSize: "13px",
            color: TEXT_DIM,
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: "16px",
          }}
        >
          Your Class: {CLASSES[selectedClass].name}
        </div>

        <div style={{ display: "flex", gap: "16px" }}>
          <button
            style={{
              ...baseButtonStyle,
              width: "180px",
              borderColor: isConnectHovered ? GOLD : BORDER_DIM,
              color: isConnectHovered ? GOLD : TEXT_PRIMARY,
              background: isConnectHovered
                ? "rgba(255, 215, 0, 0.12)"
                : "rgba(224, 208, 160, 0.06)",
              textShadow: isConnectHovered
                ? "0 0 12px rgba(255, 215, 0, 0.4)"
                : "none",
              opacity: joinCode.length < 6 ? 0.4 : 1,
              cursor: joinCode.length < 6 ? "default" : "pointer",
            }}
            onMouseEnter={() => setHoveredBtn("connect")}
            onMouseLeave={() => setHoveredBtn(null)}
            onClick={handleConnect}
            disabled={joinCode.length < 6}
          >
            Connect
          </button>

          {btn("cancel-join", "Back", handleBackFromLobby, {
            fontSize: "13px",
            padding: "14px 20px",
            letterSpacing: "2px",
            color: TEXT_DIM,
            borderColor: "rgba(255, 255, 255, 0.08)",
            background: "transparent",
          })}
        </div>

        {renderError()}
      </>
    );
  };

  // ---------------------------------------------------------------------------
  // Mode: waiting
  // ---------------------------------------------------------------------------

  const renderWaiting = () => (
    <>
      <div
        style={{
          fontSize: "18px",
          color: TEXT_PRIMARY,
          letterSpacing: "3px",
          textTransform: "uppercase",
          marginBottom: "24px",
        }}
      >
        Connected!
      </div>

      <div
        style={{
          fontSize: "14px",
          color: TEXT_DIM,
          letterSpacing: "2px",
          textTransform: "uppercase",
          marginBottom: "16px",
          animation: "onlineLobby_pulse 2s ease-in-out infinite",
        }}
      >
        Waiting for host to start...
      </div>

      {renderSpinner()}

      <div
        style={{
          fontSize: "13px",
          color: TEXT_DIM,
          letterSpacing: "2px",
          textTransform: "uppercase",
          marginTop: "24px",
        }}
      >
        Your Class: {CLASSES[selectedClass].name}
      </div>

      {renderLatency()}

      <div style={{ marginTop: "32px" }}>
        {btn("cancel-wait", "Disconnect", handleBackFromLobby, {
          fontSize: "13px",
          padding: "8px 20px",
          letterSpacing: "2px",
          color: TEXT_DIM,
          borderColor: "rgba(255, 255, 255, 0.08)",
          background: "transparent",
        })}
      </div>
    </>
  );

  // ---------------------------------------------------------------------------
  // Mode: ready
  // ---------------------------------------------------------------------------

  const renderReady = () => (
    <>
      <div
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          color: GOLD,
          letterSpacing: "4px",
          textTransform: "uppercase",
          textShadow: `0 0 16px rgba(255, 215, 0, 0.5)`,
          animation: "onlineLobby_pulse 1.5s ease-in-out infinite",
        }}
      >
        Game Starting...
      </div>

      {renderLatency()}
    </>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  let content: React.ReactNode;
  switch (mode) {
    case "choose":
      content = renderChoose();
      break;
    case "hosting":
      content = renderHosting();
      break;
    case "joining":
      content = renderJoining();
      break;
    case "waiting":
      content = renderWaiting();
      break;
    case "ready":
      content = renderReady();
      break;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: BACKGROUND,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "monospace",
        color: "white",
        zIndex: 100,
      }}
    >
      {content}
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { DailyChallenge, LocalLeaderboard } from "../systems/DailyChallenge";
import { RUN_MODIFIERS } from "../config/RunModifiers";
import { CLASSES } from "../config/ClassConfig";
import type { ClassType } from "../config/ClassConfig";
import type { LeaderboardEntry } from "../systems/DailyChallenge";

interface DailyChallengeScreenProps {
    onBack: () => void;
    onStartChallenge: (challengeData: { class: string; modifiers: string[]; seed: number }) => void;
}

const AMBER = "#f0a030";
const AMBER_DIM = "rgba(240, 160, 48, 0.6)";
const AMBER_BG = "rgba(240, 160, 48, 0.08)";
const AMBER_BORDER = "rgba(240, 160, 48, 0.25)";

function getModifierInfo(id: string): { name: string; description: string; icon: string } {
    const mod = RUN_MODIFIERS.find((m) => m.id === id);
    if (mod) return { name: mod.name, description: mod.description, icon: mod.icon };
    return { name: id, description: "", icon: "?" };
}

function getClassName(classType: string): string {
    const cls = CLASSES[classType as ClassType];
    return cls ? cls.name : classType;
}

function getClassColor(classType: string): string {
    const colorMap: Record<string, string> = {
        PALADIN: "#5577ff",
        MONK: "#ffaa00",
        PRIEST: "#ffffff",
    };
    return colorMap[classType] ?? "#e0d0a0";
}

export const DailyChallengeScreen: React.FC<DailyChallengeScreenProps> = ({
    onBack,
    onStartChallenge,
}) => {
    const [timeRemaining, setTimeRemaining] = useState(DailyChallenge.getTimeRemaining());
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);
    const [fadeIn, setFadeIn] = useState(false);

    const challenge = DailyChallenge.getCurrentChallenge();
    const bestRun = DailyChallenge.getBestRun();
    const history = DailyChallenge.getHistory();
    const leaderboard = LocalLeaderboard.getEntries();

    // Update timer every minute
    useEffect(() => {
        setFadeIn(true);
        const interval = setInterval(() => {
            setTimeRemaining(DailyChallenge.getTimeRemaining());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    if (!challenge) return null;

    const handleStart = () => {
        onStartChallenge({
            class: challenge.class,
            modifiers: challenge.modifiers,
            seed: challenge.seed,
        });
    };

    const recentHistory = history.slice(-7).reverse();

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
                overflow: "auto",
                opacity: fadeIn ? 1 : 0,
                transition: "opacity 0.5s ease",
            }}
        >
            {/* Background glow */}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background:
                        "radial-gradient(ellipse at 50% 20%, rgba(240, 160, 48, 0.06) 0%, transparent 60%), " +
                        "radial-gradient(ellipse at 30% 80%, rgba(240, 120, 20, 0.03) 0%, transparent 50%)",
                    pointerEvents: "none",
                }}
            />

            <style>{`
                @keyframes dailyGlow {
                    0% { text-shadow: 0 0 20px rgba(240, 160, 48, 0.4), 0 0 40px rgba(240, 160, 48, 0.2); }
                    50% { text-shadow: 0 0 30px rgba(240, 160, 48, 0.6), 0 0 60px rgba(240, 160, 48, 0.3); }
                    100% { text-shadow: 0 0 20px rgba(240, 160, 48, 0.4), 0 0 40px rgba(240, 160, 48, 0.2); }
                }
            `}</style>

            {/* Header */}
            <div style={{ marginTop: "40px", textAlign: "center" }}>
                <h1
                    style={{
                        fontSize: "48px",
                        fontWeight: "bold",
                        letterSpacing: "8px",
                        textTransform: "uppercase",
                        color: AMBER,
                        animation: "dailyGlow 4s ease-in-out infinite",
                        margin: 0,
                    }}
                >
                    Daily Challenge
                </h1>
                <p
                    style={{
                        fontSize: "16px",
                        color: AMBER_DIM,
                        letterSpacing: "4px",
                        marginTop: "8px",
                    }}
                >
                    {challenge.date}
                </p>
                <p
                    style={{
                        fontSize: "14px",
                        color: "rgba(200, 200, 220, 0.5)",
                        letterSpacing: "2px",
                        marginTop: "4px",
                    }}
                >
                    Resets in {timeRemaining}
                </p>
            </div>

            {/* Main content area */}
            <div
                style={{
                    display: "flex",
                    gap: "32px",
                    marginTop: "32px",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    maxWidth: "900px",
                    width: "100%",
                    padding: "0 24px",
                }}
            >
                {/* Challenge Details Panel */}
                <div
                    style={{
                        flex: "1 1 380px",
                        background: AMBER_BG,
                        border: `1px solid ${AMBER_BORDER}`,
                        borderRadius: "12px",
                        padding: "24px",
                        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
                    }}
                >
                    <h2
                        style={{
                            fontSize: "18px",
                            color: AMBER,
                            letterSpacing: "3px",
                            textTransform: "uppercase",
                            marginTop: 0,
                            marginBottom: "20px",
                            borderBottom: `1px solid ${AMBER_BORDER}`,
                            paddingBottom: "12px",
                        }}
                    >
                        Challenge Details
                    </h2>

                    {/* Required Class */}
                    <div style={{ marginBottom: "20px" }}>
                        <div
                            style={{
                                fontSize: "12px",
                                color: "rgba(200, 200, 220, 0.5)",
                                textTransform: "uppercase",
                                letterSpacing: "2px",
                                marginBottom: "6px",
                            }}
                        >
                            Required Class
                        </div>
                        <div
                            style={{
                                fontSize: "24px",
                                fontWeight: "bold",
                                color: getClassColor(challenge.class),
                                textShadow: `0 0 12px ${getClassColor(challenge.class)}40`,
                            }}
                        >
                            {getClassName(challenge.class)}
                        </div>
                    </div>

                    {/* Active Modifiers */}
                    <div style={{ marginBottom: "20px" }}>
                        <div
                            style={{
                                fontSize: "12px",
                                color: "rgba(200, 200, 220, 0.5)",
                                textTransform: "uppercase",
                                letterSpacing: "2px",
                                marginBottom: "8px",
                            }}
                        >
                            Active Modifiers
                        </div>
                        {challenge.modifiers.map((modId) => {
                            const mod = getModifierInfo(modId);
                            return (
                                <div
                                    key={modId}
                                    style={{
                                        background: "rgba(240, 160, 48, 0.06)",
                                        border: "1px solid rgba(240, 160, 48, 0.15)",
                                        borderRadius: "8px",
                                        padding: "10px 14px",
                                        marginBottom: "8px",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "16px",
                                            fontWeight: "bold",
                                            color: AMBER,
                                        }}
                                    >
                                        {mod.icon} {mod.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "12px",
                                            color: "rgba(200, 200, 220, 0.6)",
                                            marginTop: "4px",
                                        }}
                                    >
                                        {mod.description}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Seed */}
                    <div>
                        <div
                            style={{
                                fontSize: "12px",
                                color: "rgba(200, 200, 220, 0.5)",
                                textTransform: "uppercase",
                                letterSpacing: "2px",
                                marginBottom: "4px",
                            }}
                        >
                            Seed
                        </div>
                        <div
                            style={{
                                fontSize: "14px",
                                color: "rgba(200, 200, 220, 0.4)",
                                fontFamily: "monospace",
                            }}
                        >
                            #{challenge.seed}
                        </div>
                    </div>
                </div>

                {/* Right column: Best Run + Start */}
                <div
                    style={{
                        flex: "1 1 380px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "20px",
                    }}
                >
                    {/* Your Best Panel */}
                    <div
                        style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "12px",
                            padding: "24px",
                            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
                        }}
                    >
                        <h2
                            style={{
                                fontSize: "18px",
                                color: "rgba(224, 208, 160, 0.8)",
                                letterSpacing: "3px",
                                textTransform: "uppercase",
                                marginTop: 0,
                                marginBottom: "20px",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                                paddingBottom: "12px",
                            }}
                        >
                            Your Best Today
                        </h2>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                gap: "16px",
                                textAlign: "center",
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: "11px",
                                        color: "rgba(200, 200, 220, 0.4)",
                                        textTransform: "uppercase",
                                        letterSpacing: "1px",
                                        marginBottom: "4px",
                                    }}
                                >
                                    Altitude
                                </div>
                                <div
                                    style={{
                                        fontSize: "24px",
                                        fontWeight: "bold",
                                        color: bestRun.altitude > 0 ? "#fff" : "rgba(200, 200, 220, 0.3)",
                                    }}
                                >
                                    {bestRun.altitude > 0 ? `${bestRun.altitude}m` : "--"}
                                </div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: "11px",
                                        color: "rgba(200, 200, 220, 0.4)",
                                        textTransform: "uppercase",
                                        letterSpacing: "1px",
                                        marginBottom: "4px",
                                    }}
                                >
                                    Kills
                                </div>
                                <div
                                    style={{
                                        fontSize: "24px",
                                        fontWeight: "bold",
                                        color: bestRun.kills > 0 ? "#fff" : "rgba(200, 200, 220, 0.3)",
                                    }}
                                >
                                    {bestRun.kills > 0 ? bestRun.kills : "--"}
                                </div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: "11px",
                                        color: "rgba(200, 200, 220, 0.4)",
                                        textTransform: "uppercase",
                                        letterSpacing: "1px",
                                        marginBottom: "4px",
                                    }}
                                >
                                    Bosses
                                </div>
                                <div
                                    style={{
                                        fontSize: "24px",
                                        fontWeight: "bold",
                                        color: bestRun.bosses > 0 ? "#fff" : "rgba(200, 200, 220, 0.3)",
                                    }}
                                >
                                    {bestRun.bosses > 0 ? bestRun.bosses : "--"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Start Button */}
                    <button
                        style={{
                            width: "100%",
                            padding: "20px 36px",
                            fontSize: "22px",
                            fontFamily: "monospace",
                            fontWeight: "bold",
                            letterSpacing: "4px",
                            textTransform: "uppercase",
                            border: `2px solid ${hoveredButton === "start" ? AMBER : AMBER_BORDER}`,
                            borderRadius: "10px",
                            cursor: "pointer",
                            transition: "all 0.25s ease",
                            outline: "none",
                            background:
                                hoveredButton === "start"
                                    ? "rgba(240, 160, 48, 0.2)"
                                    : "rgba(240, 160, 48, 0.08)",
                            color: hoveredButton === "start" ? "#ffd700" : AMBER,
                            boxShadow:
                                hoveredButton === "start"
                                    ? "0 0 30px rgba(240, 160, 48, 0.3), inset 0 0 20px rgba(240, 160, 48, 0.05)"
                                    : "0 0 10px rgba(240, 160, 48, 0.1)",
                            transform: hoveredButton === "start" ? "scale(1.03)" : "scale(1)",
                        }}
                        onMouseEnter={() => setHoveredButton("start")}
                        onMouseLeave={() => setHoveredButton(null)}
                        onClick={handleStart}
                    >
                        Start Challenge
                    </button>

                    {/* Personal Records (Leaderboard) */}
                    <div
                        style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "12px",
                            padding: "20px",
                            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
                        }}
                    >
                        <h2
                            style={{
                                fontSize: "16px",
                                color: "rgba(224, 208, 160, 0.8)",
                                letterSpacing: "3px",
                                textTransform: "uppercase",
                                marginTop: 0,
                                marginBottom: "16px",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                                paddingBottom: "10px",
                            }}
                        >
                            Personal Records
                        </h2>
                        {leaderboard.length === 0 ? (
                            <div
                                style={{
                                    textAlign: "center",
                                    color: "rgba(200, 200, 220, 0.3)",
                                    fontSize: "13px",
                                    padding: "12px 0",
                                }}
                            >
                                No runs recorded yet
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table
                                    style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        fontSize: "13px",
                                    }}
                                >
                                    <thead>
                                        <tr
                                            style={{
                                                color: "rgba(200, 200, 220, 0.4)",
                                                textTransform: "uppercase",
                                                letterSpacing: "1px",
                                                fontSize: "10px",
                                            }}
                                        >
                                            <th style={{ textAlign: "left", padding: "6px 8px" }}>#</th>
                                            <th style={{ textAlign: "left", padding: "6px 8px" }}>Date</th>
                                            <th style={{ textAlign: "left", padding: "6px 8px" }}>Class</th>
                                            <th style={{ textAlign: "right", padding: "6px 8px" }}>Alt</th>
                                            <th style={{ textAlign: "right", padding: "6px 8px" }}>Kills</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((entry: LeaderboardEntry, idx: number) => (
                                            <tr
                                                key={idx}
                                                style={{
                                                    borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                                                    color:
                                                        idx === 0
                                                            ? AMBER
                                                            : idx < 3
                                                                ? "rgba(224, 208, 160, 0.7)"
                                                                : "rgba(200, 200, 220, 0.5)",
                                                }}
                                            >
                                                <td style={{ padding: "6px 8px", fontWeight: idx < 3 ? "bold" : "normal" }}>
                                                    {idx + 1}
                                                </td>
                                                <td style={{ padding: "6px 8px" }}>{entry.date}</td>
                                                <td
                                                    style={{
                                                        padding: "6px 8px",
                                                        color: getClassColor(entry.classType),
                                                    }}
                                                >
                                                    {getClassName(entry.classType)}
                                                </td>
                                                <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                                    {entry.altitude}m
                                                </td>
                                                <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                                    {entry.kills}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* History Section (collapsible) */}
            <div
                style={{
                    maxWidth: "900px",
                    width: "100%",
                    padding: "0 24px",
                    marginTop: "24px",
                    marginBottom: "24px",
                }}
            >
                <button
                    style={{
                        width: "100%",
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        borderRadius: historyExpanded ? "12px 12px 0 0" : "12px",
                        padding: "14px 20px",
                        fontFamily: "monospace",
                        fontSize: "14px",
                        color: "rgba(200, 200, 220, 0.5)",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "all 0.2s ease",
                        outline: "none",
                    }}
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                >
                    <span>Past Challenges ({history.length})</span>
                    <span style={{ fontSize: "12px" }}>{historyExpanded ? "▲" : "▼"}</span>
                </button>
                {historyExpanded && (
                    <div
                        style={{
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                            borderTop: "none",
                            borderRadius: "0 0 12px 12px",
                            padding: "16px 20px",
                        }}
                    >
                        {recentHistory.length === 0 ? (
                            <div
                                style={{
                                    textAlign: "center",
                                    color: "rgba(200, 200, 220, 0.3)",
                                    fontSize: "13px",
                                    padding: "8px 0",
                                }}
                            >
                                No history yet
                            </div>
                        ) : (
                            <table
                                style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    fontSize: "13px",
                                }}
                            >
                                <thead>
                                    <tr
                                        style={{
                                            color: "rgba(200, 200, 220, 0.4)",
                                            textTransform: "uppercase",
                                            letterSpacing: "1px",
                                            fontSize: "10px",
                                        }}
                                    >
                                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Date</th>
                                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Class</th>
                                        <th style={{ textAlign: "right", padding: "6px 8px" }}>Altitude</th>
                                        <th style={{ textAlign: "right", padding: "6px 8px" }}>Kills</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentHistory.map((entry, idx) => (
                                        <tr
                                            key={idx}
                                            style={{
                                                borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                                                color: "rgba(200, 200, 220, 0.5)",
                                            }}
                                        >
                                            <td style={{ padding: "6px 8px" }}>{entry.date}</td>
                                            <td
                                                style={{
                                                    padding: "6px 8px",
                                                    color: getClassColor(entry.class),
                                                }}
                                            >
                                                {getClassName(entry.class)}
                                            </td>
                                            <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                                {entry.altitude}m
                                            </td>
                                            <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                                {entry.kills}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Back Button */}
            <button
                style={{
                    padding: "12px 32px",
                    fontSize: "16px",
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    outline: "none",
                    background:
                        hoveredButton === "back"
                            ? "rgba(255, 255, 255, 0.1)"
                            : "rgba(255, 255, 255, 0.04)",
                    color:
                        hoveredButton === "back" ? "#fff" : "rgba(200, 200, 220, 0.6)",
                    transform: hoveredButton === "back" ? "scale(1.03)" : "scale(1)",
                    marginBottom: "40px",
                }}
                onMouseEnter={() => setHoveredButton("back")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={onBack}
            >
                Back
            </button>
        </div>
    );
};

export default DailyChallengeScreen;

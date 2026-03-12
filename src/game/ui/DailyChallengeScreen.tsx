import React, { useState, useEffect } from "react";
import { DailyChallenge, LocalLeaderboard, WeeklyLeaderboard, WEEKLY_RULES } from "../systems/DailyChallenge";
import { RUN_MODIFIERS } from "../config/RunModifiers";
import { CLASSES } from "../config/ClassConfig";
import type { ClassType } from "../config/ClassConfig";
import type { LeaderboardEntry, WeeklyChallengeData } from "../systems/DailyChallenge";

interface DailyChallengeScreenProps {
    onBack: () => void;
    onStartChallenge: (challengeData: { class: string; modifiers: string[]; seed: number }) => void;
    onStartWeeklyChallenge: (challengeData: { class: string; modifiers: string[]; seed: number; specialRule: string }) => void;
}

type ChallengeTab = "daily" | "weekly";

const AMBER = "#f0a030";
const AMBER_DIM = "rgba(240, 160, 48, 0.6)";
const AMBER_BG = "rgba(240, 160, 48, 0.08)";
const AMBER_BORDER = "rgba(240, 160, 48, 0.25)";

const ORANGE = "#e87020";
const ORANGE_DIM = "rgba(232, 112, 32, 0.6)";
const ORANGE_BG = "rgba(232, 112, 32, 0.10)";
const ORANGE_BORDER = "rgba(232, 112, 32, 0.30)";

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

function getWeeklyRuleName(ruleId: string): string {
    const rule = WEEKLY_RULES.find((r) => r.id === ruleId);
    return rule ? rule.name : ruleId;
}

// ---- Tab Button ----
const TabButton: React.FC<{
    label: string;
    active: boolean;
    onClick: () => void;
    accentColor: string;
}> = ({ label, active, onClick, accentColor }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            style={{
                flex: "1 1 0",
                padding: "14px 24px",
                fontSize: "16px",
                fontFamily: "monospace",
                fontWeight: "bold",
                letterSpacing: "4px",
                textTransform: "uppercase",
                border: "none",
                borderBottom: active ? `3px solid ${accentColor}` : "3px solid transparent",
                borderRadius: 0,
                cursor: "pointer",
                transition: "all 0.25s ease",
                outline: "none",
                background: active
                    ? "rgba(255, 255, 255, 0.04)"
                    : hovered
                        ? "rgba(255, 255, 255, 0.02)"
                        : "transparent",
                color: active ? accentColor : hovered ? "rgba(200, 200, 220, 0.7)" : "rgba(200, 200, 220, 0.4)",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onClick}
        >
            {label}
        </button>
    );
};

// ---- Daily Tab Content ----
const DailyTabContent: React.FC<{
    onStartChallenge: DailyChallengeScreenProps["onStartChallenge"];
}> = ({ onStartChallenge }) => {
    const [timeRemaining, setTimeRemaining] = useState(DailyChallenge.getTimeRemaining());
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);

    const challenge = DailyChallenge.getCurrentChallenge();
    const bestRun = DailyChallenge.getBestRun();
    const history = DailyChallenge.getHistory();
    const leaderboard = LocalLeaderboard.getEntries();

    useEffect(() => {
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
        <>
            {/* Subtitle */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <p style={{ fontSize: "16px", color: AMBER_DIM, letterSpacing: "4px", margin: 0 }}>
                    {challenge.date}
                </p>
                <p style={{ fontSize: "14px", color: "rgba(200, 200, 220, 0.5)", letterSpacing: "2px", marginTop: "4px" }}>
                    Resets in {timeRemaining}
                </p>
            </div>

            {/* Main content area */}
            <div
                style={{
                    display: "flex",
                    gap: "32px",
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
                        <div style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.5)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "6px" }}>
                            Required Class
                        </div>
                        <div style={{ fontSize: "24px", fontWeight: "bold", color: getClassColor(challenge.class), textShadow: `0 0 12px ${getClassColor(challenge.class)}40` }}>
                            {getClassName(challenge.class)}
                        </div>
                    </div>

                    {/* Active Modifiers */}
                    <div style={{ marginBottom: "20px" }}>
                        <div style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.5)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px" }}>
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
                                    <div style={{ fontSize: "16px", fontWeight: "bold", color: AMBER }}>
                                        {mod.icon} {mod.name}
                                    </div>
                                    <div style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.6)", marginTop: "4px" }}>
                                        {mod.description}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Seed */}
                    <div>
                        <div style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.5)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "4px" }}>
                            Seed
                        </div>
                        <div style={{ fontSize: "14px", color: "rgba(200, 200, 220, 0.4)", fontFamily: "monospace" }}>
                            #{challenge.seed}
                        </div>
                    </div>
                </div>

                {/* Right column: Best Run + Start */}
                <div style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", gap: "20px" }}>
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
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", textAlign: "center" }}>
                            <div>
                                <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Altitude</div>
                                <div style={{ fontSize: "24px", fontWeight: "bold", color: bestRun.altitude > 0 ? "#fff" : "rgba(200, 200, 220, 0.3)" }}>
                                    {bestRun.altitude > 0 ? `${bestRun.altitude}m` : "--"}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Kills</div>
                                <div style={{ fontSize: "24px", fontWeight: "bold", color: bestRun.kills > 0 ? "#fff" : "rgba(200, 200, 220, 0.3)" }}>
                                    {bestRun.kills > 0 ? bestRun.kills : "--"}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Bosses</div>
                                <div style={{ fontSize: "24px", fontWeight: "bold", color: bestRun.bosses > 0 ? "#fff" : "rgba(200, 200, 220, 0.3)" }}>
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
                            background: hoveredButton === "start" ? "rgba(240, 160, 48, 0.2)" : "rgba(240, 160, 48, 0.08)",
                            color: hoveredButton === "start" ? "#ffd700" : AMBER,
                            boxShadow: hoveredButton === "start"
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
                            <div style={{ textAlign: "center", color: "rgba(200, 200, 220, 0.3)", fontSize: "13px", padding: "12px 0" }}>
                                No runs recorded yet
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                    <thead>
                                        <tr style={{ color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px", fontSize: "10px" }}>
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
                                                    color: idx === 0 ? AMBER : idx < 3 ? "rgba(224, 208, 160, 0.7)" : "rgba(200, 200, 220, 0.5)",
                                                }}
                                            >
                                                <td style={{ padding: "6px 8px", fontWeight: idx < 3 ? "bold" : "normal" }}>{idx + 1}</td>
                                                <td style={{ padding: "6px 8px" }}>{entry.date}</td>
                                                <td style={{ padding: "6px 8px", color: getClassColor(entry.classType) }}>{getClassName(entry.classType)}</td>
                                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{entry.altitude}m</td>
                                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{entry.kills}</td>
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
            <div style={{ maxWidth: "900px", width: "100%", padding: "0 24px", marginTop: "24px", marginBottom: "24px" }}>
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
                    <span style={{ fontSize: "12px" }}>{historyExpanded ? "^" : "v"}</span>
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
                            <div style={{ textAlign: "center", color: "rgba(200, 200, 220, 0.3)", fontSize: "13px", padding: "8px 0" }}>
                                No history yet
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                <thead>
                                    <tr style={{ color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px", fontSize: "10px" }}>
                                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Date</th>
                                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Class</th>
                                        <th style={{ textAlign: "right", padding: "6px 8px" }}>Altitude</th>
                                        <th style={{ textAlign: "right", padding: "6px 8px" }}>Kills</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentHistory.map((entry, idx) => (
                                        <tr key={idx} style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)", color: "rgba(200, 200, 220, 0.5)" }}>
                                            <td style={{ padding: "6px 8px" }}>{entry.date}</td>
                                            <td style={{ padding: "6px 8px", color: getClassColor(entry.class) }}>{getClassName(entry.class)}</td>
                                            <td style={{ padding: "6px 8px", textAlign: "right" }}>{entry.altitude}m</td>
                                            <td style={{ padding: "6px 8px", textAlign: "right" }}>{entry.kills}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

// ---- Weekly Tab Content ----
const WeeklyTabContent: React.FC<{
    onStartWeeklyChallenge: DailyChallengeScreenProps["onStartWeeklyChallenge"];
}> = ({ onStartWeeklyChallenge }) => {
    const [timeRemaining, setTimeRemaining] = useState(DailyChallenge.getWeeklyTimeRemaining());
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);

    const weekly: WeeklyChallengeData | null = DailyChallenge.getWeeklyChallenge();
    const bestRun = DailyChallenge.getWeeklyBestRun();
    const leaderboard = WeeklyLeaderboard.getEntries();
    const dateRange = DailyChallenge.getWeeklyDateRange();

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeRemaining(DailyChallenge.getWeeklyTimeRemaining());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    if (!weekly) return null;

    const ruleName = getWeeklyRuleName(weekly.specialRule);

    const handleStart = () => {
        onStartWeeklyChallenge({
            class: weekly.class,
            modifiers: weekly.modifiers,
            seed: weekly.seed,
            specialRule: weekly.specialRule,
        });
    };

    const formatTime = (ms: number): string => {
        if (ms === 0) return "--";
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    return (
        <>
            {/* Subtitle */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <p style={{ fontSize: "16px", color: ORANGE_DIM, letterSpacing: "4px", margin: 0 }}>
                    Week of {dateRange}
                </p>
                <p style={{ fontSize: "14px", color: "rgba(200, 200, 220, 0.5)", letterSpacing: "2px", marginTop: "4px" }}>
                    Resets in {timeRemaining}
                </p>
            </div>

            {/* Main content area */}
            <div
                style={{
                    display: "flex",
                    gap: "32px",
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
                        background: ORANGE_BG,
                        border: `1px solid ${ORANGE_BORDER}`,
                        borderRadius: "12px",
                        padding: "24px",
                        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
                    }}
                >
                    <h2
                        style={{
                            fontSize: "18px",
                            color: ORANGE,
                            letterSpacing: "3px",
                            textTransform: "uppercase",
                            marginTop: 0,
                            marginBottom: "20px",
                            borderBottom: `1px solid ${ORANGE_BORDER}`,
                            paddingBottom: "12px",
                        }}
                    >
                        Challenge Details
                    </h2>

                    {/* Required Class */}
                    <div style={{ marginBottom: "20px" }}>
                        <div style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.5)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "6px" }}>
                            Required Class
                        </div>
                        <div style={{ fontSize: "24px", fontWeight: "bold", color: getClassColor(weekly.class), textShadow: `0 0 12px ${getClassColor(weekly.class)}40` }}>
                            {getClassName(weekly.class)}
                        </div>
                    </div>

                    {/* Special Rule - highlighted panel */}
                    <div style={{ marginBottom: "20px" }}>
                        <div style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.5)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px" }}>
                            Special Rule
                        </div>
                        <div
                            style={{
                                background: "rgba(232, 112, 32, 0.12)",
                                border: `2px solid ${ORANGE_BORDER}`,
                                borderRadius: "10px",
                                padding: "14px 16px",
                                marginBottom: "8px",
                                boxShadow: "0 0 16px rgba(232, 112, 32, 0.08)",
                            }}
                        >
                            <div style={{ fontSize: "18px", fontWeight: "bold", color: ORANGE, letterSpacing: "1px" }}>
                                {ruleName}
                            </div>
                            <div style={{ fontSize: "13px", color: "rgba(232, 160, 100, 0.8)", marginTop: "6px" }}>
                                {weekly.specialRuleDescription}
                            </div>
                        </div>
                    </div>

                    {/* Active Modifiers */}
                    <div style={{ marginBottom: "20px" }}>
                        <div style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.5)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px" }}>
                            Active Modifiers
                        </div>
                        {weekly.modifiers.map((modId) => {
                            const mod = getModifierInfo(modId);
                            return (
                                <div
                                    key={modId}
                                    style={{
                                        background: "rgba(232, 112, 32, 0.06)",
                                        border: "1px solid rgba(232, 112, 32, 0.15)",
                                        borderRadius: "8px",
                                        padding: "10px 14px",
                                        marginBottom: "8px",
                                    }}
                                >
                                    <div style={{ fontSize: "16px", fontWeight: "bold", color: ORANGE }}>
                                        {mod.icon} {mod.name}
                                    </div>
                                    <div style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.6)", marginTop: "4px" }}>
                                        {mod.description}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Seed */}
                    <div>
                        <div style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.5)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "4px" }}>
                            Seed
                        </div>
                        <div style={{ fontSize: "14px", color: "rgba(200, 200, 220, 0.4)", fontFamily: "monospace" }}>
                            #{weekly.seed}
                        </div>
                    </div>
                </div>

                {/* Right column: Best Run + Start */}
                <div style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Your Best This Week Panel */}
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
                            Your Best This Week
                        </h2>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", textAlign: "center" }}>
                            <div>
                                <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Altitude</div>
                                <div style={{ fontSize: "24px", fontWeight: "bold", color: bestRun.altitude > 0 ? "#fff" : "rgba(200, 200, 220, 0.3)" }}>
                                    {bestRun.altitude > 0 ? `${bestRun.altitude}m` : "--"}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Kills</div>
                                <div style={{ fontSize: "24px", fontWeight: "bold", color: bestRun.kills > 0 ? "#fff" : "rgba(200, 200, 220, 0.3)" }}>
                                    {bestRun.kills > 0 ? bestRun.kills : "--"}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Bosses</div>
                                <div style={{ fontSize: "24px", fontWeight: "bold", color: bestRun.bosses > 0 ? "#fff" : "rgba(200, 200, 220, 0.3)" }}>
                                    {bestRun.bosses > 0 ? bestRun.bosses : "--"}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Best Time</div>
                                <div style={{ fontSize: "24px", fontWeight: "bold", color: bestRun.time > 0 ? "#fff" : "rgba(200, 200, 220, 0.3)" }}>
                                    {formatTime(bestRun.time)}
                                </div>
                            </div>
                        </div>
                        {/* Attempts */}
                        <div style={{ textAlign: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                            <span style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>
                                Attempts this week:{" "}
                            </span>
                            <span style={{ fontSize: "14px", fontWeight: "bold", color: weekly.runsThisWeek > 0 ? ORANGE : "rgba(200, 200, 220, 0.3)" }}>
                                {weekly.runsThisWeek}
                            </span>
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
                            border: `2px solid ${hoveredButton === "start" ? ORANGE : ORANGE_BORDER}`,
                            borderRadius: "10px",
                            cursor: "pointer",
                            transition: "all 0.25s ease",
                            outline: "none",
                            background: hoveredButton === "start" ? "rgba(232, 112, 32, 0.2)" : "rgba(232, 112, 32, 0.08)",
                            color: hoveredButton === "start" ? "#ffb040" : ORANGE,
                            boxShadow: hoveredButton === "start"
                                ? "0 0 30px rgba(232, 112, 32, 0.3), inset 0 0 20px rgba(232, 112, 32, 0.05)"
                                : "0 0 10px rgba(232, 112, 32, 0.1)",
                            transform: hoveredButton === "start" ? "scale(1.03)" : "scale(1)",
                        }}
                        onMouseEnter={() => setHoveredButton("start")}
                        onMouseLeave={() => setHoveredButton(null)}
                        onClick={handleStart}
                    >
                        Start Weekly Challenge
                    </button>

                    {/* Weekly Leaderboard */}
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
                            Weekly Records
                        </h2>
                        {leaderboard.length === 0 ? (
                            <div style={{ textAlign: "center", color: "rgba(200, 200, 220, 0.3)", fontSize: "13px", padding: "12px 0" }}>
                                No weekly runs recorded yet
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                    <thead>
                                        <tr style={{ color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "1px", fontSize: "10px" }}>
                                            <th style={{ textAlign: "left", padding: "6px 8px" }}>#</th>
                                            <th style={{ textAlign: "left", padding: "6px 8px" }}>Week</th>
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
                                                    color: idx === 0 ? ORANGE : idx < 3 ? "rgba(224, 180, 140, 0.7)" : "rgba(200, 200, 220, 0.5)",
                                                }}
                                            >
                                                <td style={{ padding: "6px 8px", fontWeight: idx < 3 ? "bold" : "normal" }}>{idx + 1}</td>
                                                <td style={{ padding: "6px 8px" }}>{entry.date}</td>
                                                <td style={{ padding: "6px 8px", color: getClassColor(entry.classType) }}>{getClassName(entry.classType)}</td>
                                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{entry.altitude}m</td>
                                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{entry.kills}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

// ---- Main Screen ----
export const DailyChallengeScreen: React.FC<DailyChallengeScreenProps> = ({
    onBack,
    onStartChallenge,
    onStartWeeklyChallenge,
}) => {
    const [activeTab, setActiveTab] = useState<ChallengeTab>("daily");
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);
    const [fadeIn, setFadeIn] = useState(false);

    useEffect(() => {
        setFadeIn(true);
    }, []);

    const isDaily = activeTab === "daily";
    const accentColor = isDaily ? AMBER : ORANGE;

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
                    background: isDaily
                        ? "radial-gradient(ellipse at 50% 20%, rgba(240, 160, 48, 0.06) 0%, transparent 60%), " +
                          "radial-gradient(ellipse at 30% 80%, rgba(240, 120, 20, 0.03) 0%, transparent 50%)"
                        : "radial-gradient(ellipse at 50% 20%, rgba(232, 112, 32, 0.07) 0%, transparent 60%), " +
                          "radial-gradient(ellipse at 30% 80%, rgba(232, 80, 20, 0.04) 0%, transparent 50%)",
                    pointerEvents: "none",
                    transition: "background 0.5s ease",
                }}
            />

            <style>{`
                @keyframes challengeGlow {
                    0% { text-shadow: 0 0 20px ${accentColor}66, 0 0 40px ${accentColor}33; }
                    50% { text-shadow: 0 0 30px ${accentColor}99, 0 0 60px ${accentColor}4d; }
                    100% { text-shadow: 0 0 20px ${accentColor}66, 0 0 40px ${accentColor}33; }
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
                        color: accentColor,
                        animation: "challengeGlow 4s ease-in-out infinite",
                        margin: 0,
                        transition: "color 0.3s ease",
                    }}
                >
                    {isDaily ? "Daily Challenge" : "Weekly Challenge"}
                </h1>
            </div>

            {/* Tab Bar */}
            <div
                style={{
                    display: "flex",
                    maxWidth: "500px",
                    width: "100%",
                    marginTop: "20px",
                    marginBottom: "8px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                }}
            >
                <TabButton label="Daily" active={activeTab === "daily"} onClick={() => setActiveTab("daily")} accentColor={AMBER} />
                <TabButton label="Weekly" active={activeTab === "weekly"} onClick={() => setActiveTab("weekly")} accentColor={ORANGE} />
            </div>

            {/* Tab Content */}
            {activeTab === "daily" ? (
                <DailyTabContent onStartChallenge={onStartChallenge} />
            ) : (
                <WeeklyTabContent onStartWeeklyChallenge={onStartWeeklyChallenge} />
            )}

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
                    background: hoveredButton === "back" ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.04)",
                    color: hoveredButton === "back" ? "#fff" : "rgba(200, 200, 220, 0.6)",
                    transform: hoveredButton === "back" ? "scale(1.03)" : "scale(1)",
                    marginBottom: "40px",
                    marginTop: "8px",
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

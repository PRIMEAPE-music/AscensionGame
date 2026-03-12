import React, { useState, useEffect } from "react";
import { TutorialManager } from "../systems/TutorialManager";

interface TutorialOverlayProps {
    hint: { title: string; text: string } | null;
    onDismiss: () => void;
}

const FADE_DURATION = 300; // ms

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
    hint,
    onDismiss,
}) => {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const [dismissHover, setDismissHover] = useState(false);
    const [skipHover, setSkipHover] = useState(false);

    useEffect(() => {
        if (!hint) {
            setVisible(false);
            setExiting(false);
            return;
        }

        // Slide in after a brief delay
        const showTimer = setTimeout(() => setVisible(true), 50);

        return () => {
            clearTimeout(showTimer);
        };
    }, [hint]);

    const handleDismiss = () => {
        setExiting(true);
        setVisible(false);
        setTimeout(() => {
            setExiting(false);
            onDismiss();
        }, FADE_DURATION);
    };

    const handleSkipTutorial = () => {
        TutorialManager.completeTutorial();
        setExiting(true);
        setVisible(false);
        setTimeout(() => {
            setExiting(false);
            onDismiss();
        }, FADE_DURATION);
    };

    if (!hint && !exiting) return null;

    return (
        <div
            style={{
                position: "absolute",
                top: visible && !exiting ? "80px" : "-160px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 150,
                transition: `top ${FADE_DURATION}ms ease-out`,
                pointerEvents: "auto",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "16px 24px 12px",
                    background: "rgba(10, 10, 18, 0.92)",
                    border: "1px solid rgba(224, 208, 160, 0.4)",
                    borderRadius: "10px",
                    boxShadow:
                        "0 0 16px rgba(224, 208, 160, 0.15), 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
                    fontFamily: "monospace",
                    maxWidth: "420px",
                    minWidth: "300px",
                }}
            >
                {/* Title */}
                <div
                    style={{
                        fontSize: "11px",
                        fontWeight: "bold",
                        color: "#e0d0a0",
                        textTransform: "uppercase",
                        letterSpacing: "3px",
                    }}
                >
                    {hint?.title ?? ""}
                </div>

                {/* Body text */}
                <div
                    style={{
                        fontSize: "14px",
                        color: "rgba(220, 220, 235, 0.85)",
                        lineHeight: "1.5",
                        letterSpacing: "0.3px",
                    }}
                >
                    {hint?.text ?? ""}
                </div>

                {/* Bottom row: Got it + Skip Tutorial */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: "2px",
                    }}
                >
                    <button
                        onClick={handleDismiss}
                        onMouseEnter={() => setDismissHover(true)}
                        onMouseLeave={() => setDismissHover(false)}
                        style={{
                            padding: "5px 18px",
                            fontSize: "12px",
                            fontFamily: "monospace",
                            fontWeight: "bold",
                            letterSpacing: "1px",
                            textTransform: "uppercase",
                            background: dismissHover
                                ? "rgba(224, 208, 160, 0.2)"
                                : "rgba(224, 208, 160, 0.1)",
                            color: "#e0d0a0",
                            border: `1px solid ${dismissHover ? "rgba(224, 208, 160, 0.5)" : "rgba(224, 208, 160, 0.25)"}`,
                            borderRadius: "4px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            outline: "none",
                        }}
                    >
                        Got it
                    </button>

                    <button
                        onClick={handleSkipTutorial}
                        onMouseEnter={() => setSkipHover(true)}
                        onMouseLeave={() => setSkipHover(false)}
                        style={{
                            padding: "4px 10px",
                            fontSize: "10px",
                            fontFamily: "monospace",
                            letterSpacing: "0.5px",
                            background: "transparent",
                            color: skipHover
                                ? "rgba(200, 200, 220, 0.7)"
                                : "rgba(200, 200, 220, 0.35)",
                            border: "none",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            outline: "none",
                            textDecoration: skipHover ? "underline" : "none",
                        }}
                    >
                        Skip Tutorial
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TutorialOverlay;

import { useState, useEffect, useCallback, useRef } from "react";
import { GameSettings } from "../systems/GameSettings";

/**
 * Detect whether the current device supports touch.
 */
function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/**
 * Visual-only overlay for touch controls.
 *
 * The actual input processing lives in the Phaser-side `TouchControls` class.
 * This component renders semi-transparent button outlines so the player knows
 * where to tap.  Press feedback is handled via CSS transitions driven by the
 * EventBus (or simple pointer events on the overlay itself).
 */
export function TouchControlsOverlay() {
  const [visible, setVisible] = useState(false);
  const [pressedButtons, setPressedButtons] = useState<Set<string>>(
    () => new Set(),
  );
  const pressedRef = useRef(pressedButtons);
  pressedRef.current = pressedButtons;

  useEffect(() => {
    const settings = GameSettings.get();
    setVisible(settings.touchControlsEnabled && isTouchDevice());
  }, []);

  // Handle press feedback purely visually via pointer events on the overlay DOM
  const handlePointerDown = useCallback((btn: string) => {
    setPressedButtons((prev) => {
      const next = new Set(prev);
      next.add(btn);
      return next;
    });
  }, []);

  const handlePointerUp = useCallback((btn: string) => {
    setPressedButtons((prev) => {
      const next = new Set(prev);
      next.delete(btn);
      return next;
    });
  }, []);

  if (!visible) return null;

  const settings = GameSettings.get();
  const opacity = settings.touchButtonOpacity;
  const sizeMultiplier =
    settings.touchButtonSize === "SMALL"
      ? 0.75
      : settings.touchButtonSize === "LARGE"
        ? 1.25
        : 1.0;
  const btnSize = Math.round(56 * sizeMultiplier);
  const spacing = Math.round(btnSize * 1.2);
  const isLeftJoystick = settings.touchJoystickSide === "LEFT";

  // Button positions: diamond layout
  // Anchor to bottom-right (or bottom-left if joystick on right)
  const anchorRight = isLeftJoystick;
  const anchorStyle: React.CSSProperties = anchorRight
    ? { right: Math.round(60 * sizeMultiplier), bottom: Math.round(80 * sizeMultiplier) }
    : { left: Math.round(60 * sizeMultiplier), bottom: Math.round(80 * sizeMultiplier) };

  const buttons: {
    key: string;
    label: string;
    color: string;
    dx: number;
    dy: number;
  }[] = [
    { key: "Y", label: "Y", color: "#ccaa44", dx: 0, dy: -spacing },
    { key: "X", label: "X", color: "#4488cc", dx: -spacing, dy: 0 },
    { key: "B", label: "B", color: "#bb4444", dx: spacing, dy: 0 },
    { key: "A", label: "A", color: "#44bb44", dx: 0, dy: spacing },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {/* Joystick hint area */}
      <div
        style={{
          position: "absolute",
          [isLeftJoystick ? "left" : "right"]: 40,
          bottom: 120,
          width: 120,
          height: 120,
          borderRadius: "50%",
          border: `2px dashed rgba(255,255,255,${opacity * 0.3})`,
          pointerEvents: "none",
        }}
      />

      {/* Action buttons */}
      <div
        style={{
          position: "absolute",
          ...anchorStyle,
          pointerEvents: "none",
        }}
      >
        {buttons.map((btn) => {
          const isPressed = pressedButtons.has(btn.key);
          const scale = isPressed ? 0.85 : 1;
          const btnOpacity = isPressed ? opacity : opacity * 0.6;
          return (
            <div
              key={btn.key}
              onPointerDown={(e) => {
                e.stopPropagation();
                handlePointerDown(btn.key);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                handlePointerUp(btn.key);
              }}
              onPointerCancel={() => handlePointerUp(btn.key)}
              onPointerLeave={() => handlePointerUp(btn.key)}
              style={{
                position: "absolute",
                left: `calc(50% + ${btn.dx}px - ${btnSize / 2}px)`,
                top: `calc(50% + ${btn.dy}px - ${btnSize / 2}px)`,
                width: btnSize,
                height: btnSize,
                borderRadius: "50%",
                backgroundColor: btn.color,
                opacity: btnOpacity,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontFamily: "monospace",
                fontSize: Math.round(18 * sizeMultiplier),
                fontWeight: "bold",
                border: "2px solid rgba(255,255,255,0.5)",
                transform: `scale(${scale})`,
                transition: "transform 0.08s ease, opacity 0.08s ease",
                userSelect: "none",
                WebkitUserSelect: "none",
                touchAction: "none",
                pointerEvents: "auto",
              }}
            >
              {btn.label}
            </div>
          );
        })}
      </div>

      {/* Swipe hint text */}
      <div
        style={{
          position: "absolute",
          [isLeftJoystick ? "right" : "left"]: 20,
          top: "50%",
          transform: "translateY(-50%)",
          color: `rgba(255,255,255,${opacity * 0.25})`,
          fontFamily: "monospace",
          fontSize: 11,
          textAlign: "center",
          pointerEvents: "none",
          lineHeight: "1.6",
        }}
      >
        <div>swipe up: ultimate</div>
        <div>swipe down: drop</div>
        <div>2-finger tap: pause</div>
      </div>
    </div>
  );
}

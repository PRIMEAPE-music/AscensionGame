export interface CurvePoint {
  x: number;
  y: number;
  angle: number; // tangent angle at this point (radians)
}

export class CurveUtils {
  /**
   * Sample N+1 points along a circular arc.
   * Returns points from startAngle to endAngle (both in radians).
   * Tangent angle = perpendicular to the radius at each point.
   */
  static sampleArc(
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    segments: number,
  ): CurvePoint[] {
    const points: CurvePoint[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const theta = startAngle + (endAngle - startAngle) * t;
      const x = centerX + radius * Math.cos(theta);
      const y = centerY + radius * Math.sin(theta);
      // Tangent is perpendicular to radius: derivative of (cos(θ), sin(θ)) = (-sin(θ), cos(θ))
      // Direction depends on whether arc goes CW or CCW
      const tangentAngle = Math.atan2(
        Math.cos(theta) * Math.sign(endAngle - startAngle),
        -Math.sin(theta) * Math.sign(endAngle - startAngle),
      );
      points.push({ x, y, angle: tangentAngle });
    }
    return points;
  }

  /**
   * Sample N+1 points along a quadratic Bezier curve.
   * B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
   * Tangent from B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
   */
  static sampleBezier(
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    segments: number,
  ): CurvePoint[] {
    const points: CurvePoint[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      // Position
      const x = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
      const y = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
      // Derivative: B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
      const dx = 2 * mt * (cx - x0) + 2 * t * (x1 - cx);
      const dy = 2 * mt * (cy - y0) + 2 * t * (y1 - cy);
      const angle = Math.atan2(dy, dx);
      points.push({ x, y, angle });
    }
    return points;
  }
}

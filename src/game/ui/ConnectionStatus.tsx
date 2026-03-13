import React from 'react';

interface ConnectionStatusProps {
  latency: number;
  connectionState: string;
  role: string;
  roomCode: string;
}

const statusColors: Record<string, string> = {
  connected: '#22c55e',
  connecting: '#eab308',
  disconnected: '#ef4444',
  error: '#ef4444',
  idle: '#888888',
};

function getLatencyColor(latency: number): string {
  if (latency > 200) return '#ef4444';
  if (latency > 100) return '#eab308';
  return 'rgba(200, 200, 220, 0.8)';
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  latency,
  connectionState,
  role,
  roomCode,
}) => {
  const dotColor = statusColors[connectionState] || '#888888';
  const latencyColor = getLatencyColor(latency);

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(10, 10, 18, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        padding: '4px 12px',
        fontFamily: 'monospace',
        fontSize: 11,
        color: 'rgba(200, 200, 220, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        opacity: 1,
        transition: 'opacity 0.3s ease-in',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {/* Status dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
        }}
      />

      {/* Latency */}
      <span style={{ color: latencyColor, fontSize: 12 }}>
        {latency}ms
      </span>

      {/* Role label */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {role === 'host' ? 'HOST' : 'GUEST'}
      </span>

      {/* Room code */}
      <span style={{ fontSize: 11, opacity: 0.6 }}>
        {roomCode}
      </span>
    </div>
  );
};

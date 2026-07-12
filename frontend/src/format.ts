// Human-readable rendering of durations and timestamps (operator-ui spec:
// durations are never shown as raw milliseconds).

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms === 0) return '0m'; // genuinely zero reads differently from "a little"
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return '<1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

// Shared by the Machine List's table AND card renderings (add-responsive-ui
// design D3) so the two cannot drift.
export function formatTemperature(value: number | null): string {
  return value === null ? '—' : `${value} °C`;
}

export function formatTimestamp(iso: string | null): string {
  if (iso === null) return '—';
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : '—';
}

export function formatRelativeTime(iso: string): string {
  const deltaMs = Date.now() - Date.parse(iso);
  if (!Number.isFinite(deltaMs)) return '—';
  if (deltaMs < 60000) return 'just now';
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

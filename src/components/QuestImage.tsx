import { useState, type ReactNode } from 'react';
export function questAsset(path: string | null): string | null {
  if (!path || path === 'PLACEHOLDER') return null;
  try { const url = new URL(path, 'https://cdn.discordapp.com/');
    return url.protocol === 'https:' && ['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
export function QuestImage({ src, alt, className, fallback }: { src: string | null; alt: string; className?: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = src === '/orb-reward.svg' ? src : questAsset(src);
  return url && url !== failed ? <img className={className} src={url} alt={alt} loading="lazy" onError={() => setFailed(url)} /> : <>{fallback}</>;
}

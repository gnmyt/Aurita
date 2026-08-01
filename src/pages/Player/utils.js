import {trickplayTileUrl} from '@/common/utils/jellyfin';

const vttTime = (t) => {
    const p = t.trim().split(':');
    if (p.length === 3) return (+p[0]) * 3600 + (+p[1]) * 60 + parseFloat(p[2]);
    if (p.length === 2) return (+p[0]) * 60 + parseFloat(p[1]);
    return parseFloat(p[0]);
}

export const parseVtt = (text) => {
    const cues = [];
    for (const block of text.replace(/\r/g, '').split('\n\n')) {
        const lines = block.split('\n').filter(Boolean);
        const tline = lines.find((l) => l.includes('-->'));
        if (!tline) continue;
        const [s, e] = tline.split('-->');
        const start = vttTime(s);
        const end = vttTime(e.trim().split(' ')[0]);
        const txt = lines.slice(lines.indexOf(tline) + 1).join('\n').replace(/<[^>]+>/g, '');
        if (!isNaN(start) && !isNaN(end) && txt) cues.push({start, end, text: txt});
    }
    return cues;
}

export const UPNEXT_LEAD = 25;
export const SPEEDS = [
    {v: 0.5, label: '0.5x'},
    {v: 0.75, label: '0.75x'},
    {v: 1, labelKey: 'player.speed.normal'},
    {v: 1.25, label: '1.25x'},
    {v: 1.5, label: '1.5x'},
];
export const HLS_CONFIG = {
    enableWorker: true,
    lowLatencyMode: false,
    maxBufferLength: 60,
    maxMaxBufferLength: 1800,
    maxBufferSize: 400 * 1000 * 1000,
    backBufferLength: 90,
    fragLoadingMaxRetry: 8,
    fragLoadingRetryDelay: 500,
    fragLoadingMaxRetryTimeout: 64000,
    manifestLoadingMaxRetry: 6,
    manifestLoadingRetryDelay: 500,
    levelLoadingMaxRetry: 6,
    levelLoadingRetryDelay: 500,
    abrEwmaDefaultEstimate: 1000000,
    abrBandWidthFactor: 0.9,
    abrBandWidthUpFactor: 0.7,
    highBufferWatchdogPeriod: 1,
    nudgeMaxRetry: 8,
};

export const DIRECT_STALL_MS = 12000;

export const SYNC_TOLERANCE = 0.4;
export const UNPAUSE_DRIFT = 1.5;
export const SEEK_READY_TIMEOUT = 5000;

export const thumbStyle = (info, sec) => {
    if (!info) return null;
    const idx = Math.min(info.ThumbnailCount - 1, Math.max(0, Math.floor((sec * 1000) / info.Interval)));
    const per = info.TileWidth * info.TileHeight;
    const tile = Math.floor(idx / per);
    const within = idx % per;
    const col = within % info.TileWidth;
    const row = Math.floor(within / info.TileWidth);
    return {
        width: info.Width, height: info.Height,
        backgroundImage: `url(${trickplayTileUrl(info, tile)})`,
        backgroundPosition: `-${col * info.Width}px -${row * info.Height}px`,
        backgroundSize: `${info.TileWidth * info.Width}px ${info.TileHeight * info.Height}px`,
    };
}

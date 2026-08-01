import {getEpisodes, getItem, getPlaybackInfo, posterImage, resolveStream} from '@/common/utils/jellyfin';
import {bitrateForQuality} from '@/common/utils/jellyfin/playback';
import {getQuality} from '@/common/utils/prefs';

export const downloadsSupported = () => typeof window.AuritaNative?.downloadItem === 'function';

const listeners = new Set();
let cache = [];
let poll = null;

const read = () => {
    try {
        const raw = window.AuritaNative?.downloadStatus?.();
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

const emit = () => listeners.forEach((fn) => {
    try {
        fn(cache);
    } catch {
    }
});

const refresh = () => {
    cache = read().map((d) => ({
        ...d,
        item: d.item ? JSON.parse(d.item) : null,
    }));
    emit();
    const running = cache.some((d) => d.state === 0);
    clearTimeout(poll);
    if (running && listeners.size) poll = setTimeout(refresh, 1000);
}

export const onDownloads = (fn) => {
    listeners.add(fn);
    refresh();
    return () => {
        listeners.delete(fn);
        if (!listeners.size) clearTimeout(poll);
    };
}

export const getDownloads = () => cache;

export const downloadState = (itemId) => cache.find((d) => d.itemId === itemId) || null;

export const isDownloaded = (itemId) => downloadState(itemId)?.state === 1;

export const localPathFor = (itemId) => {
    const d = downloadState(itemId);
    return d?.state === 1 ? d.path : null;
}

const expand = async (item) => {
    if (item?.Type === 'Series') {
        const eps = await getEpisodes(item.Id).catch(() => []);
        return eps || [];
    }
    if (item?.Type === 'Season') {
        const eps = await getEpisodes(item.SeriesId, item.Id).catch(() => []);
        return eps || [];
    }
    return [item];
}

const queueOne = async (item) => {
    const info = await getPlaybackInfo(item.Id, {
        maxBitrate: bitrateForQuality(getQuality()),
    }).catch(() => null);
    if (!info) return;
    const stream = resolveStream(item, info);
    if (!stream?.url || stream.isHls) return;
    const container = stream.mediaSource?.Container || 'mp4';
    window.AuritaNative.downloadItem(
        item.Id,
        stream.url,
        posterImage(item, 400) || '',
        JSON.stringify(item),
        container,
    );
}

export const download = async (itemOrId) => {
    if (!downloadsSupported()) return 0;
    const item = typeof itemOrId === 'string' ? await getItem(itemOrId) : itemOrId;
    const targets = (await expand(item)).filter((i) => i && !isDownloaded(i.Id));
    for (const target of targets) {
        await queueOne(target);
    }
    refresh();
    return targets.length;
}

export const removeDownload = (itemId) => {
    window.AuritaNative?.downloadRemove?.(itemId);
    refresh();
}

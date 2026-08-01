import {useEffect, useRef, useState} from 'react';
import {bitrateForQuality, getPlaybackInfo, resolveStream, stopEncoding, TICKS_PER_SEC,} from '@/common/utils/jellyfin';

const PREVIEW_DELAY = 1200;

const PREVIEW_HLS = {
    enableWorker: true,
    lowLatencyMode: false,
    maxBufferLength: 10,
    maxMaxBufferLength: 20,
    maxBufferSize: 30 * 1000 * 1000,
    backBufferLength: 0,
    fragLoadingMaxRetry: 2,
    manifestLoadingMaxRetry: 2,
    levelLoadingMaxRetry: 2,
};

const previewStartSecs = (item) => {
    const ud = item?.UserData || {};
    if (ud.PlaybackPositionTicks > 0) return ud.PlaybackPositionTicks / TICKS_PER_SEC;
    const runtime = (item?.RunTimeTicks || 0) / TICKS_PER_SEC;
    if (!runtime) return 30;
    return Math.min(120, Math.max(30, runtime * 0.1));
}

export const useVideoPreview = ({item, focused, enabled}) => {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const sessionRef = useRef(null);
    const [ready, setReady] = useState(false);

    const itemRef = useRef(item);
    itemRef.current = item;

    useEffect(() => {
        if (!focused || !enabled) return undefined;
        let cancelled = false;
        setReady(false);

        const videoEl = videoRef.current;
        const item = itemRef.current;
        const timer = setTimeout(async () => {
            let resolved;
            let Hls;
            try {
                Hls = (await import('hls.js')).default;
                const info = await getPlaybackInfo(item.Id, {maxBitrate: bitrateForQuality('480')});
                resolved = resolveStream(item, info);
            } catch {
                return;
            }
            if (cancelled) {
                if (resolved?.playSessionId) stopEncoding(resolved.playSessionId);
                return;
            }

            sessionRef.current = resolved.playSessionId;
            const v = videoEl;
            if (!v) return;

            const begin = () => {
                const startAt = previewStartSecs(item);
                if (startAt > 0 && (!v.duration || startAt < v.duration - 5)) {
                    try {
                        v.currentTime = startAt;
                    } catch {
                    }
                }
                v.muted = true;
                v.play().catch(() => {
                });
            };
            v.addEventListener('playing', () => {
                if (!cancelled) setReady(true);
            }, {once: true});

            if (resolved.isHls && Hls.isSupported()) {
                const hls = new Hls(PREVIEW_HLS);
                hlsRef.current = hls;
                hls.loadSource(resolved.url);
                hls.attachMedia(v);
                hls.on(Hls.Events.MANIFEST_PARSED, begin);
                hls.on(Hls.Events.ERROR, (_e, data) => {
                    if (data?.fatal) {
                        try {
                            hls.destroy();
                        } catch {
                        }
                    }
                });
            } else {
                v.src = resolved.url;
                v.addEventListener('loadedmetadata', begin, {once: true});
            }
        }, PREVIEW_DELAY);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            setReady(false);
            if (hlsRef.current) {
                try {
                    hlsRef.current.destroy();
                } catch {
                }
                hlsRef.current = null;
            }
            if (videoEl) {
                try {
                    videoEl.pause();
                    videoEl.removeAttribute('src');
                    videoEl.load();
                } catch {
                }
            }
            if (sessionRef.current) {
                stopEncoding(sessionRef.current);
                sessionRef.current = null;
            }
        };
    }, [focused, enabled, item?.Id]);

    return {videoRef, ready};
}

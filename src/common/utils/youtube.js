import {useEffect, useRef} from 'react';

let ytPromise = null;

const loadYouTube = () => {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (ytPromise) return ytPromise;
    ytPromise = new Promise((resolve, reject) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (prev) prev();
            window.onYouTubeIframeAPIReady = prev;
            resolve(window.YT);
        };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.onerror = () => {
            ytPromise = null;
            window.onYouTubeIframeAPIReady = prev;
            s.remove();
            reject(new Error('YouTube IFrame API failed to load'));
        };
        document.head.appendChild(s);
    });
    return ytPromise;
}

export const youTubeId = (url) => {
    if (!url) return null;
    const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : null;
}

const BASE_PLAYER_VARS = {
    autoplay: 1, controls: 0, rel: 0, modestbranding: 1,
    playsinline: 1, fs: 0, iv_load_policy: 3, disablekb: 1,
};

export const useYouTubePlayer = (stageRef, {videoId, enabled = true, playerVars, onEnded, onError, onLoadFail}) => {
    const playerRef = useRef(null);
    const optsRef = useRef({});
    optsRef.current = {videoId, playerVars, onEnded, onError, onLoadFail};
    const videoKey = typeof videoId === 'function' ? null : videoId;

    useEffect(() => {
        if (!enabled || !stageRef.current) return undefined;
        let destroyed = false;
        const el = document.createElement('div');
        stageRef.current.appendChild(el);
        loadYouTube().catch(() => {
            optsRef.current.onLoadFail?.();
            return null;
        }).then((YT) => {
            if (destroyed || !YT) return;
            const {videoId: vid, playerVars: vars} = optsRef.current;
            playerRef.current = new YT.Player(el, {
                width: '100%',
                height: '100%',
                host: 'https://www.youtube-nocookie.com',
                videoId: typeof vid === 'function' ? vid() : vid,
                playerVars: {...BASE_PLAYER_VARS, ...vars},
                events: {
                    onReady: (e) => e.target.playVideo(),
                    onStateChange: (e) => {
                        if (e.data === YT.PlayerState.ENDED) optsRef.current.onEnded?.();
                    },
                    onError: () => optsRef.current.onError?.(),
                },
            });
        });
        return () => {
            destroyed = true;
            try {
                playerRef.current?.destroy();
            } catch {
            }
            playerRef.current = null;
            try {
                el.remove();
            } catch {
            }
        };
    }, [enabled, videoKey, stageRef]);

    return playerRef;
}

export const togglePlayerMute = (player) => {
    if (!player?.isMuted) return false;
    if (player.isMuted()) {
        player.unMute();
        return false;
    }
    player.mute();
    return true;
}

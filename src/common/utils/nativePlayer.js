import {getToken} from '@/common/utils/jellyfin/client';
import {hasNativePlayer} from '@/common/utils/jellyfin/capabilities';


export const isNativePlayerAvailable = () => {
    try {
        return hasNativePlayer() && typeof window.AuritaNative?.videoLoad === 'function';
    } catch {
        return false;
    }
}

const HAVE_ENOUGH_DATA = 4;
const HAVE_METADATA = 1;

class NativeVideoShim {
    constructor() {
        this._listeners = new Map();
        this._state = {currentTime: 0, duration: 0, paused: true, buffered: 0, ready: false};
        this._rate = 1;
        this._volume = 1;
        this._muted = false;
    }

    get currentTime() {
        return this._state.currentTime;
    }

    set currentTime(seconds) {
        this._state.currentTime = seconds;
        window.AuritaNative?.videoSeek?.(seconds);
    }

    get duration() {
        return this._state.duration;
    }

    get paused() {
        return this._state.paused;
    }

    get readyState() {
        return this._state.ready ? HAVE_ENOUGH_DATA : HAVE_METADATA;
    }

    get buffered() {
        const end = this._state.buffered;
        return {
            length: end > 0 ? 1 : 0,
            start: () => 0,
            end: () => end,
        };
    }

    get playbackRate() {
        return this._rate;
    }

    set playbackRate(rate) {
        this._rate = rate;
        window.AuritaNative?.videoRate?.(rate);
    }

    get volume() {
        return this._volume;
    }

    set volume(v) {
        this._volume = v;
        window.AuritaNative?.videoVolume?.(this._muted ? 0 : v);
    }

    get muted() {
        return this._muted;
    }

    set muted(m) {
        this._muted = m;
        window.AuritaNative?.videoVolume?.(m ? 0 : this._volume);
    }

    play() {
        window.AuritaNative?.videoPlay?.();
        return Promise.resolve();
    }

    pause() {
        window.AuritaNative?.videoPause?.();
    }

    load(url, {positionSeconds = 0, isHls = false} = {}) {
        this._state = {currentTime: positionSeconds, duration: 0, paused: false, buffered: 0, ready: false};
        window.AuritaNative?.videoLoad?.(url, positionSeconds, !!isHls, getToken() || '');
    }

    release() {
        window.AuritaNative?.videoRelease?.();
    }

    addEventListener(type, fn) {
        if (!this._listeners.has(type)) this._listeners.set(type, new Set());
        this._listeners.get(type).add(fn);
    }

    removeEventListener(type, fn) {
        this._listeners.get(type)?.delete(fn);
    }

    _dispatch(payload) {
        const {type} = payload;
        this._state = {
            currentTime: payload.currentTime ?? this._state.currentTime,
            duration: payload.duration || this._state.duration,
            paused: payload.paused ?? this._state.paused,
            buffered: payload.buffered ?? this._state.buffered,
            ready: payload.ready ?? this._state.ready,
        };
        this._listeners.get(type)?.forEach((fn) => {
            try {
                fn(payload);
            } catch {
            }
        });
    }
}

let shim = null;

export const getNativeVideo = () => {
    if (!isNativePlayerAvailable()) return null;
    if (!shim) {
        shim = new NativeVideoShim();
        window.__auritaNativeVideoEvent = (payload) => shim._dispatch(payload || {});
    }
    return shim;
}

export const releaseNativeVideo = () => {
    shim?.release();
}

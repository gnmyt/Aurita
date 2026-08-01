const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';

const match = (re) => {
    const m = re.exec(ua);
    return m ? Number(m[1]) : 0;
}

export const platform = (() => {
    const tizen = /Tizen/i.test(ua);
    const webos = /Web0S|webOS|LG Browser/i.test(ua);
    const android = /Android/i.test(ua);
    const androidTv = android && /TV|BRAVIA|AFT[A-Z]|SHIELD|Chromecast/i.test(ua);
    const chromium = /Chrome\/|CriOS\//i.test(ua);
    const safari = /Safari/i.test(ua) && !chromium;
    const firefox = /Firefox\//i.test(ua);
    const shell = typeof window !== 'undefined' && !!window.AuritaNative;
    return {
        tizen,
        tizenVersion: tizen ? match(/Tizen (\d+)/i) : 0,
        webos,
        webosVersion: webos ? match(/Chrome\/(\d+)/i) : 0,
        android,
        androidTv,
        chromium,
        chromeVersion: match(/Chrome\/(\d+)/i),
        safari,
        firefox,
        firefoxVersion: match(/Firefox\/(\d+)/i),
        shell,
        webview: shell && android,
        tv: tizen || webos || androidTv,
        desktop: !tizen && !webos && !android && !/iPhone|iPad|iPod/i.test(ua),
    };
})();

let _probe = null;

const testElement = () => {
    if (_probe !== null) return _probe;
    try {
        _probe = document.createElement('video');
    } catch {
        _probe = false;
    }
    return _probe;
}

export const canPlayNative = (type) => {
    const el = testElement();
    if (!el) return false;
    try {
        return el.canPlayType(type).replace(/no/, '') !== '';
    } catch {
        return false;
    }
}

export const canPlayMse = (type) => {
    try {
        return !!window.MediaSource?.isTypeSupported(type);
    } catch {
        return false;
    }
}

const canPlay = (type) => canPlayNative(type) || canPlayMse(type);

const VIDEO_CODECS = {
    h264: ['video/mp4; codecs="avc1.640029"', 'video/mp4; codecs="avc1.42E01E"'],
    hevc: ['video/mp4; codecs="hvc1.1.6.L93.B0"', 'video/mp4; codecs="hev1.1.6.L93.B0"'],
    hevc10: ['video/mp4; codecs="hvc1.2.4.L153.B0"', 'video/mp4; codecs="hev1.2.4.L153.B0"'],
    vp9: ['video/mp4; codecs="vp09.00.10.08"', 'video/webm; codecs="vp9"'],
    vp9_10bit: ['video/mp4; codecs="vp09.02.10.10.01.09.16.09.00"'],
    av1: ['video/mp4; codecs="av01.0.05M.08"'],
    av1_10bit: ['video/mp4; codecs="av01.0.05M.10"'],
    vp8: ['video/webm; codecs="vp8"'],
    mpeg2video: ['video/mp2t; codecs="mp2v"'],
    vc1: ['video/mp4; codecs="vc-1"'],
};

const AUDIO_CODECS = {
    aac: ['audio/mp4; codecs="mp4a.40.2"'],
    mp3: ['audio/mp4; codecs="mp4a.69"', 'audio/mpeg'],
    ac3: ['audio/mp4; codecs="ac-3"'],
    eac3: ['audio/mp4; codecs="ec-3"'],
    opus: ['audio/mp4; codecs="opus"', 'audio/webm; codecs="opus"'],
    flac: ['audio/mp4; codecs="flac"'],
    alac: ['audio/mp4; codecs="alac"'],
    vorbis: ['audio/webm; codecs="vorbis"'],
    dts: ['audio/mp4; codecs="dts-"', 'audio/mp4; codecs="dtsc"'],
    truehd: ['audio/mp4; codecs="mlpa"'],
    pcm: ['audio/mp4; codecs="lpcm"'],
};

const detectList = (table, tester) => Object.entries(table)
    .filter(([, types]) => types.some(tester))
    .map(([name]) => name);

const canPlayMkv = () => {
    if (platform.tizen || platform.webos) return true;
    if (platform.chromium && !platform.safari) return true;
    return canPlayNative('video/x-matroska') || canPlayNative('video/webm');
}

const canPlayTs = () => platform.tizen || platform.webos || platform.chromium
    || canPlayNative('video/mp2t; codecs="avc1.42E01E,mp4a.40.2"');

const detectHdr = (nativeCaps) => {
    if (nativeCaps) {
        return {
            hdr10: !!nativeCaps.hdr10,
            hlg: !!nativeCaps.hlg,
            dolbyVision: !!nativeCaps.dolbyVision,
        };
    }
    if (platform.webview) return {hdr10: false, hlg: false, dolbyVision: false};
    const hdr10 = platform.tizen || platform.webos
        || (platform.chromium && platform.desktop)
        || (platform.safari && platform.desktop);
    return {
        hdr10,
        hlg: hdr10,
        dolbyVision: platform.safari && platform.desktop,
    };
}

const detectAudio = (nativeCaps) => {
    if (nativeCaps?.audioCodecs?.length) {
        return {codecs: nativeCaps.audioCodecs, maxChannels: nativeCaps.maxAudioChannels || 2};
    }
    const codecs = detectList(AUDIO_CODECS, canPlay);
    if (!codecs.includes('aac')) codecs.push('aac');
    let maxChannels = 2;
    if (codecs.includes('ac3') || codecs.includes('eac3')) maxChannels = 6;
    if (platform.tizen || platform.webos || platform.androidTv) maxChannels = 6;
    return {codecs, maxChannels};
}

let _caps = null;

export const getCapabilities = () => {
    if (_caps) return _caps;

    let nativeCaps = null;
    try {
        const raw = window.AuritaNative?.getPlayerCapabilities?.();
        if (raw) nativeCaps = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        nativeCaps = null;
    }

    const video = nativeCaps?.videoCodecs?.length
        ? nativeCaps.videoCodecs
        : detectList(VIDEO_CODECS, canPlay);
    if (!video.includes('h264')) video.push('h264');

    const audio = detectAudio(nativeCaps);
    const hdr = detectHdr(nativeCaps);

    _caps = {
        native: !!nativeCaps,
        videoCodecs: video,
        audioCodecs: audio.codecs,
        maxAudioChannels: audio.maxChannels,
        hdr,
        tenBit: {
            hevc: !!nativeCaps?.hevc10 || VIDEO_CODECS.hevc10.some(canPlay),
            vp9: !!nativeCaps?.vp910 || VIDEO_CODECS.vp9_10bit.some(canPlay),
            av1: !!nativeCaps?.av110 || VIDEO_CODECS.av1_10bit.some(canPlay),
        },
        containers: {
            mkv: nativeCaps ? true : canPlayMkv(),
            ts: nativeCaps ? true : canPlayTs(),
            webm: nativeCaps ? true : canPlay('video/webm; codecs="vp8"'),
        },
        maxResolution: nativeCaps?.maxWidth || (platform.tv ? 3840 : 1920),
        mse: typeof window !== 'undefined' && !!window.MediaSource,
        nativeHls: canPlayNative('application/vnd.apple.mpegurl'),
    };
    return _caps;
}

export const resetCapabilities = () => {
    _caps = null;
}

export const hasNativePlayer = () => getCapabilities().native;

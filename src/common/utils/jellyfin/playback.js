import {api, authHeader, getDeviceId, getToken, getUserId, SERVER_URL} from './client';

export const streamUrl = (item, mediaSourceId) => {
    const u = new URL(`${SERVER_URL}/Videos/${item.Id}/stream`);
    u.searchParams.set('static', 'true');
    u.searchParams.set('mediaSourceId', mediaSourceId || item.Id);
    u.searchParams.set('api_key', getToken());
    u.searchParams.set('DeviceId', getDeviceId());
    return u.toString();
}

export const QUALITY_LEVELS = [
    {key: 'auto', label: 'Automatisch'},
    {key: 'original', label: 'Original'},
    {key: '1080', label: '1080p', bitrate: 8000000},
    {key: '720', label: '720p HD', bitrate: 4000000},
    {key: '480', label: '480p', bitrate: 1500000},
    {key: '360', label: '360p', bitrate: 800000},
];

let _bandwidth = Number(localStorage.getItem('jf_bandwidth')) || 0;

export const getBandwidth = () => {
    return _bandwidth;
}

const BANDWIDTH_TTL = 6 * 3600 * 1000;
let _measuring = null;

export const measureBandwidth = () => {
    const measuredAt = Number(localStorage.getItem('jf_bandwidth_t')) || 0;
    if (_bandwidth && Date.now() - measuredAt < BANDWIDTH_TTL) return Promise.resolve(_bandwidth);
    if (!_measuring) _measuring = doMeasure().finally(() => {
        _measuring = null;
    });
    return _measuring;
}

const doMeasure = async () => {
    try {
        await fetch(`${SERVER_URL}/Playback/BitrateTest?size=200000`, {
            headers: {'X-Emby-Token': getToken(), 'X-Emby-Authorization': authHeader(getToken())}, cache: 'no-store',
        }).then((r) => r.arrayBuffer());
        const size = 3000000;
        const t0 = performance.now();
        const buf = await fetch(`${SERVER_URL}/Playback/BitrateTest?size=${size}`, {
            headers: {'X-Emby-Token': getToken(), 'X-Emby-Authorization': authHeader(getToken())}, cache: 'no-store',
        }).then((r) => r.arrayBuffer());
        const secs = (performance.now() - t0) / 1000;
        if (secs > 0) {
            _bandwidth = Math.round((buf.byteLength * 8) / secs);
            localStorage.setItem('jf_bandwidth', String(_bandwidth));
            localStorage.setItem('jf_bandwidth_t', String(Date.now()));
        }
    } catch {
    }
    return _bandwidth;
}

export const bitrateForQuality = (qkey) => {
    if (qkey === 'original') return 200000000;
    if (qkey === 'auto') return _bandwidth ? Math.max(600000, Math.floor(_bandwidth * 0.85)) : 12000000;
    const lvl = QUALITY_LEVELS.find((q) => q.key === qkey);
    return lvl?.bitrate || 100000000;
}

const CODEC_TESTS = {
    video: [
        ['h264', ['video/mp4; codecs="avc1.640028"']],
        ['hevc', ['video/mp4; codecs="hvc1.1.6.L93.B0"', 'video/mp4; codecs="hev1.1.6.L93.B0"']],
        ['vp9', ['video/mp4; codecs="vp09.00.10.08"']],
        ['av1', ['video/mp4; codecs="av01.0.05M.08"']],
    ],
    audio: [
        ['aac', ['audio/mp4; codecs="mp4a.40.2"']],
        ['mp3', ['audio/mpeg']],
        ['ac3', ['audio/mp4; codecs="ac-3"', 'audio/mp4; codecs="mp4a.a5"']],
        ['eac3', ['audio/mp4; codecs="ec-3"', 'audio/mp4; codecs="mp4a.a6"']],
        ['opus', ['audio/mp4; codecs="opus"', 'audio/webm; codecs="opus"']],
        ['flac', ['audio/mp4; codecs="flac"', 'audio/ogg; codecs="flac"']],
    ],
    webmVideo: [
        ['vp8', ['video/webm; codecs="vp8"']],
        ['vp9', ['video/webm; codecs="vp9"']],
        ['av1', ['video/webm; codecs="av01.0.05M.08"']],
    ],
    webmAudio: [
        ['opus', ['audio/webm; codecs="opus"']],
        ['vorbis', ['audio/webm; codecs="vorbis"']],
    ],
};

let _codecCaps = null;

const detectCodecs = () => {
    if (_codecCaps) return _codecCaps;
    let probe;
    try {
        probe = document.createElement('video');
    } catch {
        probe = null;
    }
    const supports = (type) => {
        try {
            if (probe && probe.canPlayType(type) !== '') return true;
        } catch {
        }
        try {
            if (window.MediaSource?.isTypeSupported(type)) return true;
        } catch {
        }
        return false;
    };
    const detect = (tests) => tests.filter(([, types]) => types.some(supports)).map(([codec]) => codec);
    const caps = Object.fromEntries(Object.entries(CODEC_TESTS).map(([group, tests]) => [group, detect(tests)]));
    if (!caps.video.includes('h264')) caps.video.push('h264');
    if (!caps.audio.includes('aac')) caps.audio.push('aac');
    _codecCaps = caps;
    return _codecCaps;
}

const deviceProfile = (maxBitrate, {forceTranscode = false} = {}) => {
    const caps = detectCodecs();
    const directPlay = forceTranscode ? [] : [
        {Container: 'mp4,m4v,mov', Type: 'Video', VideoCodec: caps.video.join(','), AudioCodec: caps.audio.join(',')},
        ...(caps.webmVideo.length
            ? [{
                Container: 'webm',
                Type: 'Video',
                VideoCodec: caps.webmVideo.join(','),
                AudioCodec: (caps.webmAudio.join(',') || 'opus')
            }]
            : []),
    ];
    return {
        MaxStreamingBitrate: maxBitrate,
        MaxStaticBitrate: maxBitrate,
        DirectPlayProfiles: directPlay,
        TranscodingProfiles: [
            {
                Container: 'ts', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac,mp3',
                Protocol: 'hls', Context: 'Streaming', MinSegments: 1, BreakOnNonKeyFrames: true, MaxAudioChannels: '2',
            },
        ],
        SubtitleProfiles: [{Format: 'vtt', Method: 'External'}],
    };
}

export const getPlaybackInfo = async (itemId, {maxBitrate, mediaSourceId, audioStreamIndex, forceTranscode} = {}) => {
    const params = {userId: getUserId()};
    if (maxBitrate) params.maxStreamingBitrate = maxBitrate;
    if (mediaSourceId) params.mediaSourceId = mediaSourceId;
    if (audioStreamIndex != null) params.audioStreamIndex = audioStreamIndex;
    return api(`/Items/${itemId}/PlaybackInfo`, params, {
        method: 'POST',
        body: JSON.stringify({DeviceProfile: deviceProfile(maxBitrate || 200000000, {forceTranscode})}),
    });
}

export const resolveStream = (item, info) => {
    const ms = info?.MediaSources?.[0];
    const playSessionId = info?.PlaySessionId;
    if (!ms) return {url: streamUrl(item), isHls: false, mode: 'direct'};
    if (ms.SupportsDirectPlay) {
        return {url: streamUrl(item, ms.Id), isHls: false, mediaSource: ms, playSessionId, mode: 'direct'};
    }
    if (ms.TranscodingUrl) {
        const isHls = (ms.TranscodingSubProtocol || '').toLowerCase() === 'hls' || ms.TranscodingUrl.includes('m3u8');
        return {url: SERVER_URL + ms.TranscodingUrl, isHls, mediaSource: ms, playSessionId, mode: 'transcode'};
    }
    if (ms.SupportsDirectStream) {
        const u = new URL(`${SERVER_URL}/Videos/${item.Id}/stream.${ms.Container || 'mp4'}`);
        u.searchParams.set('static', 'true');
        u.searchParams.set('mediaSourceId', ms.Id);
        u.searchParams.set('api_key', getToken());
        return {url: u.toString(), isHls: false, mediaSource: ms, playSessionId, mode: 'directstream'};
    }
    return {url: streamUrl(item, ms.Id), isHls: false, mediaSource: ms, playSessionId, mode: 'direct'};
}

export const stopEncoding = (playSessionId) => {
    if (!playSessionId) return Promise.resolve();
    return api('/Videos/ActiveEncodings', {deviceId: getDeviceId(), playSessionId}, {method: 'DELETE'}).catch(() => {
    });
}

export const reportStart = (itemId, positionTicks = 0) => {
    return api('/Sessions/Playing', {}, {
        method: 'POST',
        body: JSON.stringify({ItemId: itemId, PositionTicks: positionTicks, PlayMethod: 'DirectPlay'}),
    }).catch(() => {
    });
}

export const reportProgress = (itemId, positionTicks, paused = false) => {
    return api('/Sessions/Playing/Progress', {}, {
        method: 'POST',
        body: JSON.stringify({
            ItemId: itemId,
            PositionTicks: positionTicks,
            IsPaused: paused,
            PlayMethod: 'DirectPlay'
        }),
    }).catch(() => {
    });
}

export const reportStop = (itemId, positionTicks) => {
    return api('/Sessions/Playing/Stopped', {}, {
        method: 'POST',
        body: JSON.stringify({ItemId: itemId, PositionTicks: positionTicks}),
    }).catch(() => {
    });
}

export {TICKS_PER_SEC} from '@/common/utils/time';

const LANG_NAMES = {
    deu: 'Deutsch', ger: 'Deutsch', eng: 'Englisch', jpn: 'Japanisch', kor: 'Koreanisch',
    fra: 'Französisch', fre: 'Französisch', spa: 'Spanisch', ita: 'Italienisch', rus: 'Russisch',
    ukr: 'Ukrainisch', zho: 'Chinesisch', chi: 'Chinesisch', por: 'Portugiesisch', nld: 'Niederländisch',
    dut: 'Niederländisch', pol: 'Polnisch', tur: 'Türkisch', ara: 'Arabisch', hin: 'Hindi',
    swe: 'Schwedisch', dan: 'Dänisch', nor: 'Norwegisch', fin: 'Finnisch', ces: 'Tschechisch',
    cze: 'Tschechisch', hun: 'Ungarisch', ell: 'Griechisch', gre: 'Griechisch', heb: 'Hebräisch',
    tha: 'Thai', vie: 'Vietnamesisch', ron: 'Rumänisch', rum: 'Rumänisch', bul: 'Bulgarisch',
};

const langName = (code) => {
    if (!code) return 'Unbekannt';
    return LANG_NAMES[code.toLowerCase()] || code.toUpperCase();
}

const channelDesc = (s) => {
    const cl = (s.ChannelLayout || '').toLowerCase();
    if (cl.includes('7.1')) return '7.1';
    if (cl.includes('5.1')) return '5.1';
    if (cl.includes('stereo')) return 'Stereo';
    if (cl.includes('mono')) return 'Mono';
    switch (s.Channels) {
        case 1:
            return 'Mono';
        case 2:
            return 'Stereo';
        case 6:
            return '5.1';
        case 8:
            return '7.1';
        default:
            return s.Channels ? `${s.Channels}.0` : '';
    }
}

const isAudioDescription = (s) => {
    const t = `${s.Title || ''} ${s.DisplayTitle || ''}`.toLowerCase();
    return t.includes('description') || t.includes('audiodeskription') || t.includes('audio descri');
}

const shortTitle = (s) => {
    let t = s.Title || '';
    if (!t) return '';
    t = t.replace(/\b(SUBRIP|SRT|PGS|ASS|SSA|VTT|SUP|TRUEHD|AAC|FLAC|ATMOS|IMAX|UHD)\b/ig, '')
        .replace(/\bDTS[-: ]?(HD|X)?( MA)?\b/ig, '')
        .replace(/\b(E?AC-?3|DD\+?|BLU-?RAY)\b/ig, '')
        .replace(/\b(Standard|Erzwungen|Forced|SDH|Hörgeschädigt|Hearing Impaired|CC)\b/ig, '')
        .replace(/\b\d(\.\d)?\b/g, '')
        .replace(/\(\s*\)|\[\s*\]/g, '')
        .replace(/[-–·|/]+/g, ' ')
        .replace(/\s+/g, ' ').trim();
    return t;
}

const disambiguate = (list) => {
    const count = {};
    list.forEach((t) => {
        count[t.label] = (count[t.label] || 0) + 1;
    });
    const seen = {};
    list.forEach((t) => {
        if (count[t.label] > 1) {
            const hint = shortTitle(t._s);
            seen[t.label] = (seen[t.label] || 0) + 1;
            t.label += hint ? ` · ${hint}` : ` (${seen[t.label]})`;
        }
        delete t._s;
    });
    return list;
}

export const audioTracks = (mediaSource) => {
    if (!mediaSource) return [];
    const streams = (mediaSource.MediaStreams || []).filter((s) => s.Type === 'Audio');
    const byLang = {};
    streams.forEach((s) => {
        byLang[s.Language || ''] = (byLang[s.Language || ''] || 0) + 1;
    });
    return disambiguate(streams.map((s) => {
        const lang = s.Language || '';
        const extra = [];
        if (isAudioDescription(s)) extra.push('Audiodeskription');
        else if (byLang[lang] > 1) {
            const ch = channelDesc(s);
            if (ch) extra.push(ch);
        }
        return {
            index: s.Index,
            label: langName(lang) + (extra.length ? ` · ${extra.join(' · ')}` : ''),
            lang,
            isDefault: !!s.IsDefault,
            _s: s,
        };
    }));
}

export const subtitleTracks = (mediaSource, itemId) => {
    if (!mediaSource) return [];
    return disambiguate((mediaSource.MediaStreams || [])
        .filter((s) => s.Type === 'Subtitle' && s.IsTextSubtitleStream)
        .map((s) => {
            const flags = [];
            if (s.IsForced) flags.push('Erzwungen');
            if (s.IsHearingImpaired) flags.push('SDH');
            return {
                index: s.Index,
                label: langName(s.Language) + (flags.length ? ` · ${flags.join(' · ')}` : ''),
                lang: s.Language || '',
                isDefault: !!s.IsDefault,
                url: `${SERVER_URL}/Videos/${itemId}/${mediaSource.Id}/Subtitles/${s.Index}/Stream.vtt?api_key=${getToken()}`,
                _s: s,
            };
        }));
}

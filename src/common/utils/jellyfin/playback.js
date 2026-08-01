import i18n from '@/i18n';
import {api, authHeader, getDeviceId, getToken, getUserId, SERVER_URL} from './client';
import {buildDeviceProfile} from './deviceProfile';

export const streamUrl = (item, mediaSourceId) => {
    const u = new URL(`${SERVER_URL}/Videos/${item.Id}/stream`);
    u.searchParams.set('static', 'true');
    u.searchParams.set('mediaSourceId', mediaSourceId || item.Id);
    u.searchParams.set('api_key', getToken());
    u.searchParams.set('DeviceId', getDeviceId());
    return u.toString();
}

export const QUALITY_LEVELS = [
    {key: 'auto', labelKey: 'media.quality.auto'},
    {key: 'original', labelKey: 'media.quality.original'},
    {key: '1080', labelKey: 'media.quality.1080', bitrate: 8000000},
    {key: '720', labelKey: 'media.quality.720', bitrate: 4000000},
    {key: '480', labelKey: 'media.quality.480', bitrate: 1500000},
    {key: '360', labelKey: 'media.quality.360', bitrate: 800000},
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

export const getPlaybackInfo = async (itemId, {
    maxBitrate, mediaSourceId, audioStreamIndex, subtitleStreamIndex, startTimeTicks, forceTranscode,
} = {}) => {
    const params = {userId: getUserId()};
    if (maxBitrate) params.maxStreamingBitrate = maxBitrate;
    if (mediaSourceId) params.mediaSourceId = mediaSourceId;
    if (audioStreamIndex != null) params.audioStreamIndex = audioStreamIndex;
    if (subtitleStreamIndex != null) params.subtitleStreamIndex = subtitleStreamIndex;
    if (startTimeTicks) params.startTimeTicks = startTimeTicks;
    params.autoOpenLiveStream = true;
    params.enableDirectPlay = !forceTranscode;
    params.enableDirectStream = !forceTranscode;
    params.enableTranscoding = true;
    params.allowVideoStreamCopy = !forceTranscode;
    params.allowAudioStreamCopy = !forceTranscode;
    return api(`/Items/${itemId}/PlaybackInfo`, params, {
        method: 'POST',
        body: JSON.stringify({DeviceProfile: buildDeviceProfile(maxBitrate || 200000000, {forceTranscode})}),
    });
}

export const resolveStream = (item, info) => {
    const ms = info?.MediaSources?.[0];
    const playSessionId = info?.PlaySessionId;
    if (!ms) return {url: streamUrl(item), isHls: false, mode: 'direct'};
    if (ms.SupportsDirectPlay) {
        const u = new URL(streamUrl(item, ms.Id));
        if (playSessionId) u.searchParams.set('PlaySessionId', playSessionId);
        return {url: u.toString(), isHls: false, mediaSource: ms, playSessionId, mode: 'direct'};
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

const PLAY_METHOD = {direct: 'DirectPlay', directstream: 'DirectStream', transcode: 'Transcode'};

const playbackBody = (itemId, positionTicks, stream, extra = {}) => ({
    ItemId: itemId,
    PositionTicks: Math.max(0, Math.floor(positionTicks || 0)),
    PlayMethod: PLAY_METHOD[stream?.mode] || 'DirectPlay',
    PlaySessionId: stream?.playSessionId,
    MediaSourceId: stream?.mediaSource?.Id || itemId,
    AudioStreamIndex: stream?.audioStreamIndex,
    SubtitleStreamIndex: stream?.subtitleStreamIndex,
    ...extra,
});

export const reportStart = (itemId, positionTicks = 0, stream = null) => {
    return api('/Sessions/Playing', {}, {
        method: 'POST',
        body: JSON.stringify(playbackBody(itemId, positionTicks, stream, {CanSeek: true})),
    }).catch(() => {
    });
}

export const reportProgress = (itemId, positionTicks, paused = false, stream = null) => {
    return api('/Sessions/Playing/Progress', {}, {
        method: 'POST',
        body: JSON.stringify(playbackBody(itemId, positionTicks, stream, {IsPaused: paused, CanSeek: true})),
    }).catch(() => {
    });
}

export const reportStop = (itemId, positionTicks, stream = null) => {
    return api('/Sessions/Playing/Stopped', {}, {
        method: 'POST',
        body: JSON.stringify(playbackBody(itemId, positionTicks, stream)),
    }).catch(() => {
    });
}

export {TICKS_PER_SEC} from '@/common/utils/time';

const LANG_KEYS = {
    deu: 'deu', ger: 'deu', eng: 'eng', jpn: 'jpn', kor: 'kor',
    fra: 'fra', fre: 'fra', spa: 'spa', ita: 'ita', rus: 'rus',
    ukr: 'ukr', zho: 'zho', chi: 'zho', por: 'por', nld: 'nld',
    dut: 'nld', pol: 'pol', tur: 'tur', ara: 'ara', hin: 'hin',
    swe: 'swe', dan: 'dan', nor: 'nor', fin: 'fin', ces: 'ces',
    cze: 'ces', hun: 'hun', ell: 'ell', gre: 'ell', heb: 'heb',
    tha: 'tha', vie: 'vie', ron: 'ron', rum: 'ron', bul: 'bul',
};

const langName = (code) => {
    if (!code) return i18n.t('media.language.unknown');
    const key = LANG_KEYS[code.toLowerCase()];
    return key ? i18n.t(`media.language.${key}`) : code.toUpperCase();
}

const channelDesc = (s) => {
    const cl = (s.ChannelLayout || '').toLowerCase();
    if (cl.includes('7.1')) return '7.1';
    if (cl.includes('5.1')) return '5.1';
    if (cl.includes('stereo')) return i18n.t('media.track.stereo');
    if (cl.includes('mono')) return i18n.t('media.track.mono');
    switch (s.Channels) {
        case 1:
            return i18n.t('media.track.mono');
        case 2:
            return i18n.t('media.track.stereo');
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
        if (isAudioDescription(s)) extra.push(i18n.t('media.track.audioDescription'));
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
            if (s.IsForced) flags.push(i18n.t('media.track.forced'));
            if (s.IsHearingImpaired) flags.push(i18n.t('media.track.sdh'));
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

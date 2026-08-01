import "./styles.sass";
import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import Hls from 'hls.js';
import {SkipForward} from 'lucide-react';
import {
    DIRECT_STALL_MS,
    HLS_CONFIG,
    parseVtt,
    SEEK_READY_TIMEOUT,
    SPEEDS,
    SYNC_TOLERANCE,
    UNPAUSE_DRIFT,
    UPNEXT_LEAD
} from './utils';
import {TrackMenu} from './components/TrackMenu';
import {SpeedPanel} from './components/SpeedPanel';
import {UpNext} from './components/UpNext';
import {PausedCard} from './components/PausedCard';
import {ScrubBar} from './components/ScrubBar';
import {ControlBar} from './components/ControlBar';
import {EpisodePanel} from './components/EpisodePanel';
import {
    audioTracks,
    bitrateForQuality,
    getBandwidth,
    getEpisodes,
    getItem,
    getMediaSegments,
    getNextEpisode,
    getSeasons,
    getPlaybackInfo,
    playbackQueueIds,
    QUALITY_LEVELS,
    reportProgress,
    reportStart,
    reportStop,
    resolveStream,
    stopEncoding,
    streamUrl,
    subtitleTracks,
    trickplayInfo,
} from '@/common/utils/jellyfin';
import {onRemote} from '@/common/utils/remote';
import {isBackKey} from '@/common/contexts/SpatialNav';
import {
    getAudioLang,
    getPref,
    getQuality,
    getSubLang,
    setAudioLang,
    setQuality as saveQuality,
    setSubLang
} from '@/common/utils/prefs';
import {TICKS_PER_SEC} from '@/common/utils/time';
import {BLANK_POSTER} from '@/common/utils/media';
import {
    getGroup,
    getPlaylistItemId,
    isInGroup,
    onSync,
    serverNowIso,
    serverToLocal,
    spBuffering,
    spPause,
    spReady,
    spSeek,
    spSetNewQueue,
    spUnpause,
    getQueue,
    getQueueItemId,
    getPlaylistItemIdFor,
    spSetPlaylistItem,
    spSetIgnoreWait,
} from '@/common/utils/syncplay';

const segmentAt = (segments, sec) => {
    return segments.find((s) => {
        const start = (s.StartTicks || 0) / TICKS_PER_SEC;
        const end = (s.EndTicks || 0) / TICKS_PER_SEC;
        return sec >= start + 0.2 && sec < end - 0.5;
    });
}

const chapterAt = (chapters, sec) => {
    let cur = null;
    for (const c of chapters) {
        if ((c.StartPositionTicks || 0) / TICKS_PER_SEC <= sec + 0.5) cur = c; else break;
    }
    return cur;
}

const versionLabels = (item, t) => {
    return (item?.MediaSources || []).map((ms, i) => ({
        label: ms.Name
            || [ms.Width && `${ms.Width}×${ms.Height}`, (ms.Container || '').toUpperCase()].filter(Boolean).join(' ')
            || t('player.versionNumbered', {number: i + 1}),
    }));
}

const applyVolumeCommand = (v, name, args) => {
    if (!v) return false;
    switch (name) {
        case 'SetVolume':
            if (args.Volume != null) v.volume = Math.max(0, Math.min(1, Number(args.Volume) / 100));
            return true;
        case 'Mute':
            v.muted = true;
            return true;
        case 'Unmute':
            v.muted = false;
            return true;
        case 'ToggleMute':
            v.muted = !v.muted;
            return true;
        case 'VolumeUp':
            v.volume = Math.min(1, v.volume + 0.1);
            return true;
        case 'VolumeDown':
            v.volume = Math.max(0, v.volume - 0.1);
            return true;
        default:
            return false;
    }
}

const buildMenuCols = ({
                           t, mode, versions, versionIdx, changeVersion, quality, changeQuality,
                           audios, audioIndex, changeAudio, subs, activeSub, chooseSub,
                       }) => {
    const cols = [];
    if (mode === 'quality') {
        if (versions.length > 1) {
            cols.push({
                key: 'version', title: t('player.version'),
                rows: versions.map((vv, i) => ({label: vv.label, on: i === versionIdx, sel: () => changeVersion(i)})),
            });
        }
        cols.push({
            key: 'quality', title: t('player.quality'),
            rows: QUALITY_LEVELS.map((q) => ({
                label: q.key === 'auto' && getBandwidth()
                    ? t('player.qualityWithBandwidth', {
                        label: t(q.labelKey), mbits: Math.round(getBandwidth() / 1e6),
                    })
                    : t(q.labelKey),
                on: quality === q.key, sel: () => changeQuality(q.key),
            })),
        });
        return cols;
    }
    if (audios.length > 1) {
        cols.push({
            key: 'audio', title: t('player.audio'),
            rows: audios.map((a) => ({label: a.label, on: a.index === audioIndex, sel: () => changeAudio(a.index)})),
        });
    }
    cols.push({
        key: 'subs', title: t('player.subtitles'),
        rows: [
            {label: t('player.subtitlesOff'), on: activeSub === -1, sel: () => chooseSub(-1)},
            ...subs.map((s, i) => ({label: s.label, on: activeSub === i, sel: () => chooseSub(i)})),
        ],
    });
    return cols;
}

const isUpNextActive = ({autoplayNext, nextEp, upNextDismissed, duration, time}) => {
    const left = duration - time;
    return autoplayNext && !!nextEp && !upNextDismissed && duration > 0 && left <= UPNEXT_LEAD && left > 0;
}

const episodeLine = (item, t) => {
    return item?.Type === 'Episode'
        ? t('player.episodeLine', {
            series: item.SeriesName, season: item.ParentIndexNumber, episode: item.IndexNumber,
        })
        : (item?.ProductionYear || '');
}

export const Player = () => {
    const {t} = useTranslation();
    const {id} = useParams();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const restart = params.get('restart') === '1';

    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const sessionRef = useRef(null);
    const seekRef = useRef(0);
    const bufferingRef = useRef(false);
    const bufTimerRef = useRef(null);
    const stallTimerRef = useRef(null);
    const audioRef = useRef(null);
    const triedTranscodeRef = useRef(false);
    const speedRef = useRef(1);
    const versionRef = useRef(0);
    const subStreamRef = useRef(null);
    const seekReadyRef = useRef(null);
    const readyPendingRef = useRef(null);
    const idRef = useRef(id);
    idRef.current = id;

    const [item, setItem] = useState(null);
    const [streamInfo, setStreamInfo] = useState(null);
    const [subs, setSubs] = useState([]);
    const [activeSub, setActiveSub] = useState(-1);
    const [subCues, setSubCues] = useState([]);
    const [audios, setAudios] = useState([]);
    const [audioIndex, setAudioIndex] = useState(null);
    const [quality, setQuality] = useState(getQuality);
    const [versionIdx, setVersionIdx] = useState(0);
    const [segments, setSegments] = useState([]);
    const [nextEp, setNextEp] = useState(null);
    const [trick, setTrick] = useState(null);
    const [group, setGroupState] = useState(getGroup());
    const [syncBusy, setSyncBusy] = useState(false);
    const [scrubbing, setScrubbing] = useState(false);
    const [scrubTime, setScrubTime] = useState(0);
    const scrubAccel = useRef({last: 0, step: 10});
    const scrubTimeRef = useRef(0);
    const scrubbingRef = useRef(false);

    const [playing, setPlaying] = useState(true);
    const [time, setTime] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffering, setBuffering] = useState(true);
    const [playbackError, setPlaybackError] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [pop, setPop] = useState(null);
    const [speed, setSpeed] = useState(1);
    const [speedIdx, setSpeedIdx] = useState(2);
    const [menuCol, setMenuCol] = useState(0);
    const [menuRow, setMenuRow] = useState(0);
    const [zone, setZone] = useState('controls');
    const [ctrlIdx, setCtrlIdx] = useState(0);
    const [upNextDismissed, setUpNextDismissed] = useState(false);
    const [seasons, setSeasons] = useState([]);
    const [seasonIdx, setSeasonIdx] = useState(0);
    const [episodes, setEpisodes] = useState([]);
    const [epIdx, setEpIdx] = useState(0);
    const epCache = useRef(new Map());
    const epReqRef = useRef(0);
    const openingRef = useRef(false);
    const seasonsSeriesRef = useRef(null);

    const hideTimer = useRef(null);

    const reveal = useCallback(() => {
        setShowControls(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowControls(false), 3500);
    }, []);

    const updateBuffered = useCallback(() => {
        const v = videoRef.current;
        const ranges = v?.buffered;
        if (!ranges?.length) {
            setBuffered(0);
            return;
        }
        const t = v.currentTime;
        let end = 0;
        for (let i = 0; i < ranges.length; i++) {
            if (ranges.start(i) <= t + 0.25 && ranges.end(i) >= t) {
                end = ranges.end(i);
                break;
            }
        }
        setBuffered(end);
    }, []);

    const reportReady = useCallback((isPlaying) => {
        if (getQueueItemId() !== idRef.current || !getPlaylistItemId()) {
            readyPendingRef.current = {isPlaying: !!isPlaying};
            return;
        }
        readyPendingRef.current = null;
        const v = videoRef.current;
        spReady({
            When: serverNowIso(),
            PositionTicks: Math.floor((v?.currentTime || 0) * TICKS_PER_SEC),
            IsPlaying: !!isPlaying,
            PlaylistItemId: getPlaylistItemId(),
        });
    }, []);

    const loadStream = useCallback(async (it, qkey, seekTo = 0, audioIdx = audioRef.current, applyPrefs = false, forceTranscode = false) => {
        if (!it) return;
        seekRef.current = seekTo;
        const ms0 = it.MediaSources?.[versionRef.current] || it.MediaSources?.[0];
        if (sessionRef.current) {
            stopEncoding(sessionRef.current);
            sessionRef.current = null;
        }
        try {
            const info = await getPlaybackInfo(it.Id, {
                maxBitrate: bitrateForQuality(qkey),
                mediaSourceId: ms0?.Id,
                audioStreamIndex: audioIdx ?? undefined,
                forceTranscode,
            });
            const resolved = resolveStream(it, info);
            sessionRef.current = resolved.playSessionId;
            const ms = resolved.mediaSource || ms0;
            const subList = subtitleTracks(ms, it.Id);
            setSubs(subList);
            if (applyPrefs) {
                const prefSub = getSubLang();
                const i = (!prefSub || prefSub === 'off') ? -1 : subList.findIndex((s) => s.lang === prefSub);
                subStreamRef.current = i >= 0 ? subList[i].index : null;
                setActiveSub(i >= 0 ? i : -1);
            } else {
                const pos = subStreamRef.current == null ? -1 : subList.findIndex((s) => s.index === subStreamRef.current);
                if (pos < 0) subStreamRef.current = null;
                setActiveSub(pos);
            }
            const auds = audioTracks(ms);
            setAudios(auds);
            const chosen = audioIdx ?? ms?.DefaultAudioStreamIndex
                ?? auds.find((a) => a.isDefault)?.index ?? auds[0]?.index ?? null;
            audioRef.current = chosen;
            setAudioIndex(chosen);
            setStreamInfo(resolved);
        } catch {
            setStreamInfo({url: streamUrl(it), isHls: false});
        }
    }, []);

    const fallbackRef = useRef(null);
    const fallbackToTranscode = useCallback(() => {
        if (!item || triedTranscodeRef.current || streamInfo?.mode === 'transcode') return false;
        triedTranscodeRef.current = true;
        const v = videoRef.current;
        setBuffering(true);
        loadStream(item, quality, v?.currentTime || seekRef.current || 0, audioRef.current, false, true);
        return true;
    }, [item, streamInfo, quality, loadStream]);
    fallbackRef.current = fallbackToTranscode;

    useEffect(() => {
        let alive = true;
        setUpNextDismissed(false);
        setStreamInfo(null);
        setPlaybackError(false);
        triedTranscodeRef.current = false;
        versionRef.current = 0;
        setVersionIdx(0);

        setPop(null);
        setEpisodes([]);
        epCache.current.clear();
        epReqRef.current++;
        (async () => {
            const it = await getItem(id);
            if (!alive) return;
            setItem(it);

            if (it.SeriesId !== seasonsSeriesRef.current) {
                seasonsSeriesRef.current = it.SeriesId;
                setSeasons([]);
            }
            setTrick(trickplayInfo(it, it.MediaSources?.[0]?.Id));
            let resumeSecs = restart ? 0 : (it.UserData?.PlaybackPositionTicks || 0) / TICKS_PER_SEC;
            if (isInGroup()) {
                const q = getQueue();
                if (getQueueItemId() === it.Id) {
                    resumeSecs = (q.StartPositionTicks || 0) / TICKS_PER_SEC;
                } else {
                    readyPendingRef.current = null;
                    setSyncBusy(true);
                    const queued = getPlaylistItemIdFor(it.Id);
                    if (queued) spSetPlaylistItem(queued);
                    else {
                        const ids = await playbackQueueIds(it);
                        if (!alive) return;
                        spSetNewQueue(ids, 0, restart ? 0 : (it.UserData?.PlaybackPositionTicks || 0));
                    }
                }
            }
            reportStart(it.Id, restart ? 0 : (it.UserData?.PlaybackPositionTicks || 0));
            getMediaSegments(it.Id).then((s) => {
                if (alive) setSegments(s);
            });
            if (it.Type === 'Episode') getNextEpisode(it.SeriesId, it.Id).then((n) => {
                if (alive) setNextEp(n);
            });
            else setNextEp(null);
            const prefAudio = getAudioLang();
            const auds0 = audioTracks(it.MediaSources?.[0]);
            const initialAudio = prefAudio ? auds0.find((a) => a.lang === prefAudio)?.index : undefined;
            audioRef.current = initialAudio ?? null;
            loadStream(it, getQuality(), resumeSecs, initialAudio, true);
        })();
        return () => {
            alive = false;
        };
    }, [id, restart, loadStream]);

    useEffect(() => {
        if (!streamInfo?.url || !videoRef.current) return;
        const v = videoRef.current;
        const seekTo = seekRef.current;
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const onReady = () => {
            v.playbackRate = speedRef.current;
            if (isInGroup()) {
                v.pause();
                reportReady(false);
            } else {
                v.play().catch(() => {
                });
            }
        };

        if (streamInfo.isHls && Hls.isSupported()) {
            const hls = new Hls(HLS_CONFIG);
            hlsRef.current = hls;
            hls.loadSource(streamInfo.url);
            hls.attachMedia(v);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (seekTo > 0) v.currentTime = seekTo;
                onReady();
            });
            let netRetry = 0, mediaRetry = 0;
            const giveUp = () => {
                if (fallbackRef.current()) return;
                hls.destroy();
                hlsRef.current = null;
                setBuffering(false);
                setPlaybackError(true);
            };
            hls.on(Hls.Events.ERROR, (_evt, data) => {
                if (!data?.fatal) return;
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    if (netRetry++ < 5) {
                        setBuffering(true);
                        setTimeout(() => hls.startLoad(), Math.min(4000, 500 * netRetry));
                    } else giveUp();
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    if (mediaRetry++ < 3) {
                        setBuffering(true);
                        hls.recoverMediaError();
                    } else giveUp();
                } else {
                    giveUp();
                }
            });
        } else {
            v.src = streamInfo.url;
            const onMeta = () => {
                if (seekTo > 0 && seekTo < (v.duration || Infinity) - 5) v.currentTime = seekTo;
                onReady();
                v.removeEventListener('loadedmetadata', onMeta);
            };
            v.addEventListener('loadedmetadata', onMeta);
        }
        return () => {
            clearTimeout(stallTimerRef.current);
            seekReadyRef.current?.();
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [streamInfo]);

    useEffect(() => {
        if (!item) return;
        const iv = setInterval(() => {
            const v = videoRef.current;
            if (v && !v.paused) reportProgress(item.Id, Math.floor(v.currentTime * TICKS_PER_SEC), false);
        }, 10000);
        return () => {
            clearInterval(iv);
            const v = videoRef.current;
            if (v) reportStop(item.Id, Math.floor(v.currentTime * TICKS_PER_SEC));
            if (sessionRef.current) {
                stopEncoding(sessionRef.current);
                sessionRef.current = null;
            }
        };
    }, [item]);

    useEffect(() => () => {
        clearTimeout(bufTimerRef.current);
        clearTimeout(stallTimerRef.current);
    }, []);

    useEffect(() => {
        if (activeSub < 0 || !subs[activeSub]) {
            setSubCues([]);
            return;
        }
        let alive = true;
        fetch(subs[activeSub].url)
            .then((r) => r.text())
            .then((t) => {
                if (alive) setSubCues(parseVtt(t));
            })
            .catch(() => {
                if (alive) setSubCues([]);
            });
        return () => {
            alive = false;
        };
    }, [activeSub, subs]);

    const changeSpeed = useCallback((val) => {
        speedRef.current = val;
        setSpeed(val);
        const v = videoRef.current;
        if (v) v.playbackRate = val;
    }, []);


    const pickSpeed = useCallback((i) => {
        const n = Math.max(0, Math.min(SPEEDS.length - 1, i));
        setSpeedIdx(n);
        changeSpeed(SPEEDS[n].v);
        reveal();
    }, [changeSpeed, reveal]);

    const loadSeason = useCallback(async (seriesId, season, focusId) => {
        if (!season) return;
        const apply = (eps) => {
            setEpisodes(eps);
            setEpIdx(Math.max(0, eps.findIndex((e) => e.Id === focusId)));
        };
        const cached = epCache.current.get(season.Id);
        if (cached) {
            apply(cached);
            return;
        }
        const token = ++epReqRef.current;
        const eps = (await getEpisodes(seriesId, season.Id).catch(() => [])) || [];
        epCache.current.set(season.Id, eps);
        if (token === epReqRef.current) apply(eps);
    }, []);

    const openEpisodes = useCallback(async () => {
        if (item?.Type !== 'Episode' || !item.SeriesId || openingRef.current) return;
        openingRef.current = true;
        reveal();
        try {
            let list = seasons;
            if (!list.length) {
                list = (await getSeasons(item.SeriesId).catch(() => [])) || [];
                setSeasons(list);
            }
            const idx = Math.max(0, list.findIndex((s) => s.Id === item.SeasonId));
            setSeasonIdx(idx);
            await loadSeason(item.SeriesId, list[idx], item.Id);
            setPop('episodes');
            reveal();
        } finally {
            openingRef.current = false;
        }
    }, [item, seasons, reveal, loadSeason]);

    const pickSeason = useCallback((i) => {
        if (!item?.SeriesId || i === seasonIdx || i < 0 || i >= seasons.length) return;
        setSeasonIdx(i);
        loadSeason(item.SeriesId, seasons[i], null);
        reveal();
    }, [item, seasons, seasonIdx, loadSeason, reveal]);

    const playEpisode = useCallback((i) => {
        const ep = episodes[i];
        if (!ep) return;
        setPop(null);
        if (ep.Id !== item?.Id) navigate(`/play/${ep.Id}`, {replace: true});
    }, [episodes, item, navigate]);

    const openSpeed = useCallback(() => {
        const i = SPEEDS.findIndex((s) => s.v === speedRef.current);
        setSpeedIdx(i < 0 ? 2 : i);
        setPop('speed');
        reveal();
    }, [reveal]);

    const syncSeek = useCallback((posSec) => {
        const v = videoRef.current;
        if (!v) return;
        clearTimeout(bufTimerRef.current);
        seekReadyRef.current?.();
        bufferingRef.current = false;
        setSyncBusy(true);
        v.pause();
        if (Math.abs(v.currentTime - posSec) < SYNC_TOLERANCE) {
            reportReady(false);
            return;
        }
        let timer = null;
        const done = () => {
            clearTimeout(timer);
            v.removeEventListener('seeked', done);
            seekReadyRef.current = null;
            v.pause();
            reportReady(false);
        };
        seekReadyRef.current = () => {
            clearTimeout(timer);
            v.removeEventListener('seeked', done);
            seekReadyRef.current = null;
        };
        v.addEventListener('seeked', done);
        timer = setTimeout(done, SEEK_READY_TIMEOUT);
        v.currentTime = posSec;
    }, [reportReady]);

    const togglePlay = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        if (isInGroup()) {
            if (v.paused) spUnpause(); else spPause();
        } else if (v.paused) {
            v.play().catch(() => {
            });
        } else {
            v.pause();
        }
        reveal();
    }, [reveal]);

    const seek = useCallback((delta) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.max(0, Math.min((v.duration || 0), v.currentTime + delta));
        reveal();
    }, [reveal]);

    const scrubBy = useCallback((dir) => {
        const v = videoRef.current;
        const dur = v?.duration || duration || 0;
        const now = Date.now();
        const acc = scrubAccel.current;
        acc.step = (now - acc.last < 450) ? Math.min(acc.step * 1.6, 300) : 10;
        acc.last = now;
        const base = scrubbingRef.current ? scrubTimeRef.current : (v?.currentTime || 0);
        const next = Math.max(0, Math.min(dur, base + dir * acc.step));
        scrubTimeRef.current = next;
        scrubbingRef.current = true;
        setScrubTime(next);
        setScrubbing(true);
        setShowControls(true);
        clearTimeout(hideTimer.current);
    }, [duration]);

    const endScrub = () => {
        scrubbingRef.current = false;
        scrubAccel.current = {last: 0, step: 10};
        setScrubbing(false);
    };
    const commitScrub = useCallback(() => {
        if (isInGroup()) spSeek(scrubTimeRef.current * TICKS_PER_SEC);
        else {
            const v = videoRef.current;
            if (v) {
                v.currentTime = scrubTimeRef.current;
                v.play().catch(() => {
                });
            }
        }
        endScrub();
        reveal();
    }, [reveal]);
    const cancelScrub = useCallback(() => {
        endScrub();
        reveal();
    }, [reveal]);

    const exit = useCallback(() => navigate(-1), [navigate]);

    const goNext = useCallback(() => {
        if (nextEp) navigate(`/play/${nextEp.Id}`, {replace: true});
        else exit();
    }, [nextEp, navigate, exit]);

    const changeQuality = useCallback((qkey) => {
        setQuality(qkey);
        saveQuality(qkey);
        const v = videoRef.current;
        loadStream(item, qkey, v?.currentTime || 0);
    }, [item, loadStream]);

    const changeVersion = useCallback((idx) => {
        versionRef.current = idx;
        setVersionIdx(idx);
        audioRef.current = null;
        triedTranscodeRef.current = false;
        const v = videoRef.current;
        loadStream(item, quality, v?.currentTime || 0, null);
    }, [item, quality, loadStream]);

    const changeAudio = useCallback((idx) => {
        audioRef.current = idx;
        setAudioIndex(idx);
        setAudioLang(audios.find((a) => a.index === idx)?.lang);
        const v = videoRef.current;
        loadStream(item, quality, v?.currentTime || 0, idx);
    }, [item, quality, audios, loadStream]);

    const chooseSub = useCallback((i) => {
        setActiveSub(i);
        subStreamRef.current = i < 0 ? null : (subs[i]?.index ?? null);
        setSubLang(i < 0 ? 'off' : (subs[i]?.lang || 'off'));
    }, [subs]);

    const activeSegment = segmentAt(segments, time);
    const skipSegment = () => {
        const v = videoRef.current;
        if (v && activeSegment) {
            v.currentTime = (activeSegment.EndTicks / TICKS_PER_SEC) - 0.2;
            reveal();
        }
    };

    const autoplayNext = getPref('autoplayNext');
    const upNextActive = isUpNextActive({autoplayNext, nextEp, upNextDismissed, duration, time});

    const versions = versionLabels(item, t);
    const chapters = (item?.Chapters && item.Chapters.length > 1 && item.Chapters.length <= 100)
        ? item.Chapters : [];

    const cols = buildMenuCols({
        t, mode: pop, versions, versionIdx, changeVersion, quality, changeQuality,
        audios, audioIndex, changeAudio, subs, activeSub, chooseSub,
    });

    const openMenu = (mode = 'tracks') => {
        const next = mode === 'quality'
            ? [...(versions.length > 1 ? [{rows: versions.map((_, i) => ({on: i === versionIdx}))}] : []),
                {rows: QUALITY_LEVELS.map((q) => ({on: quality === q.key}))}]
            : [...(audios.length > 1 ? [{rows: audios.map((a) => ({on: a.index === audioIndex}))}] : []),
                {rows: [{on: activeSub === -1}, ...subs.map((_, i) => ({on: activeSub === i}))]}];
        setPop(mode);
        setMenuCol(0);
        setMenuRow(Math.max(0, next[0].rows.findIndex((r) => r.on)));
    };

    const controls = [
        {key: 'play', act: togglePlay},
        {key: 'rew', act: () => seek(-10)},
        {key: 'fwd', act: () => seek(10)},
        ...(nextEp ? [{key: 'next', act: goNext}] : []),
        ...(item?.Type === 'Episode' ? [{key: 'eps', act: openEpisodes}] : []),
        {key: 'cc', act: () => openMenu('tracks')},
        {key: 'speed', act: openSpeed},
        {key: 'gear', act: () => openMenu('quality')},
    ];

    const onKeyRef = useRef(null);
    useEffect(() => {
        const stepMenuCol = (nc) => {
            setMenuCol(nc);
            setMenuRow((r) => Math.min(r, cols[nc].rows.length - 1));
        };
        const handleMenuKey = (e, stop) => {
            const col = cols[menuCol] || cols[0];
            if (e.key === 'ArrowUp') {
                stop();
                setMenuRow((r) => Math.max(0, r - 1));
            } else if (e.key === 'ArrowDown') {
                stop();
                setMenuRow((r) => Math.min(col.rows.length - 1, r + 1));
            } else if (e.key === 'ArrowLeft') {
                stop();
                if (menuCol > 0) stepMenuCol(menuCol - 1);
            } else if (e.key === 'ArrowRight') {
                stop();
                if (menuCol < cols.length - 1) stepMenuCol(menuCol + 1);
            } else if (e.key === 'Enter' || e.key === ' ') {
                stop();
                col.rows[menuRow]?.sel();
            } else if (isBackKey(e)) {
                stop();
                setPop(null);
            }
        };

        const handleEpisodesKey = (e, stop) => {
            if (e.key === 'ArrowUp') {
                stop();
                setEpIdx((i) => Math.max(0, i - 1));
            } else if (e.key === 'ArrowDown') {
                stop();
                setEpIdx((i) => Math.max(0, Math.min(episodes.length - 1, i + 1)));
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                stop();
                pickSeason(seasonIdx + (e.key === 'ArrowLeft' ? -1 : 1));
            } else if (e.key === 'Enter' || e.key === ' ') {
                stop();
                playEpisode(epIdx);
            } else if (isBackKey(e)) {
                stop();
                setPop(null);
            }
            reveal();
        };

        const stepSpeed = (dir) => {
            setSpeedIdx((i) => {
                const n = Math.max(0, Math.min(SPEEDS.length - 1, i + dir));
                changeSpeed(SPEEDS[n].v);
                return n;
            });
            reveal();
        };
        const handleSpeedKey = (e, stop) => {
            if (e.key === 'ArrowLeft') {
                stop();
                stepSpeed(-1);
            } else if (e.key === 'ArrowRight') {
                stop();
                stepSpeed(1);
            } else if (['Enter', ' ', 'k', 'ArrowDown', 'Escape', 'Backspace', 'GoBack'].includes(e.key)) {
                stop();
                setPop(null);
            }
        };

        const primaryAction = () => {
            if (upNextActive) goNext();
            else if (activeSegment) skipSegment();
            else togglePlay();
        };

        const handleControlsZoneKey = (e, stop) => {
            switch (e.key) {
                case 'ArrowLeft':
                    stop();
                    setCtrlIdx((i) => Math.max(0, i - 1));
                    reveal();
                    break;
                case 'ArrowRight':
                    stop();
                    setCtrlIdx((i) => Math.min(controls.length - 1, i + 1));
                    reveal();
                    break;
                case 'ArrowUp':
                    stop();
                    setZone('scrub');
                    reveal();
                    break;
                case 'ArrowDown':
                    stop();
                    reveal();
                    break;
                case 'Enter':
                case ' ':
                case 'k':
                    stop();
                    controls[ctrlIdx]?.act();
                    break;
                case 'Escape':
                case 'Backspace':
                case 'GoBack':
                    stop();
                    setZone('scrub');
                    setShowControls(false);
                    clearTimeout(hideTimer.current);
                    break;
                default:
                    break;
            }
        };

        const handleScrubZoneKey = (e, stop) => {
            switch (e.key) {
                case 'Enter':
                case ' ':
                case 'k':
                    stop();
                    if (scrubbing) commitScrub();
                    else primaryAction();
                    break;
                case 'ArrowLeft':
                    stop();
                    scrubBy(-1);
                    break;
                case 'ArrowRight':
                    stop();
                    scrubBy(1);
                    break;
                case 'ArrowUp':
                    stop();
                    reveal();
                    break;
                case 'ArrowDown':
                    stop();
                    if (scrubbing) cancelScrub();
                    if (upNextActive) setUpNextDismissed(true);
                    setZone('controls');
                    setCtrlIdx(0);
                    reveal();
                    break;
                case 'Escape':
                case 'Backspace':
                case 'GoBack':
                    stop();
                    if (scrubbing) cancelScrub();
                    else if (showControls) {
                        setShowControls(false);
                        clearTimeout(hideTimer.current);
                    } else exit();
                    break;
                default:
                    break;
            }
        };

        onKeyRef.current = (e) => {
            const stop = () => {
                e.preventDefault();
                e.stopPropagation();
            };
            if (pop === 'tracks' || pop === 'quality') {
                handleMenuKey(e, stop);
                return;
            }
            if (pop === 'speed') {
                handleSpeedKey(e, stop);
                return;
            }
            if (pop === 'episodes') {
                handleEpisodesKey(e, stop);
                return;
            }

            const navKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'k'].includes(e.key);
            if (!showControls && !scrubbing && navKey) {
                stop();
                reveal();
                setZone('controls');
                setCtrlIdx(0);
                if (['Enter', ' ', 'k'].includes(e.key)) primaryAction();
                return;
            }

            if (zone === 'controls') handleControlsZoneKey(e, stop);
            else handleScrubZoneKey(e, stop);
        };
    });
    useEffect(() => {
        const h = (e) => onKeyRef.current?.(e);
        window.addEventListener('keydown', h, true);
        return () => window.removeEventListener('keydown', h, true);
    }, []);

    useEffect(() => {
        reveal();
        return () => clearTimeout(hideTimer.current);
    }, [reveal]);
    useEffect(() => {
        if (!isInGroup()) return undefined;
        spSetIgnoreWait(false);
        return () => {
            if (isInGroup()) spSetIgnoreWait(true);
        };
    }, []);

    useEffect(() => onSync('group', (g) => {
        setGroupState(g);
        if (!g || g.State !== 'Waiting') setSyncBusy(false);
    }), []);

    useEffect(() => {
        const offPs = onRemote('playstate', (d) => {
            const v = videoRef.current;
            switch (d.Command) {
                case 'Pause':
                    v?.pause();
                    break;
                case 'Unpause':
                    v?.play().catch(() => {
                    });
                    break;
                case 'PlayPause':
                    togglePlay();
                    break;
                case 'Stop':
                    exit();
                    break;
                case 'Seek':
                    if (v && d.SeekPositionTicks != null) {
                        v.currentTime = d.SeekPositionTicks / TICKS_PER_SEC;
                        reveal();
                    }
                    break;
                case 'NextTrack':
                    goNext();
                    break;
                case 'Rewind':
                    seek(-10);
                    break;
                case 'FastForward':
                    seek(10);
                    break;
                default:
                    break;
            }
        });
        const offGen = onRemote('general', (d) => {
            const v = videoRef.current;
            const a = d.Arguments || {};
            if (applyVolumeCommand(v, d.Name, a)) return;
            if (d.Name === 'SetAudioStreamIndex') {
                if (a.Index != null) changeAudio(Number(a.Index));
            } else if (d.Name === 'SetSubtitleStreamIndex') {
                const idx = Number(a.Index);
                if (idx < 0) chooseSub(-1);
                else {
                    const pos = subs.findIndex((s) => s.index === idx);
                    if (pos >= 0) chooseSub(pos);
                }
            }
        });
        return () => {
            offPs();
            offGen();
        };
    }, [togglePlay, seek, exit, goNext, changeAudio, chooseSub, subs, reveal]);

    useEffect(() => {
        const offCmd = onSync('command', (cmd) => {
            const v = videoRef.current;
            if (!v) return;
            const localWhen = serverToLocal(cmd.When);
            const apply = () => {
                const lateSec = Math.max(0, (Date.now() - localWhen) / 1000);
                const posSec = (cmd.PositionTicks || 0) / TICKS_PER_SEC;
                switch (cmd.Command) {
                    case 'Unpause': {
                        setSyncBusy(false);
                        const want = posSec + lateSec;
                        if (Math.abs(v.currentTime - want) > UNPAUSE_DRIFT) v.currentTime = want;
                        v.play().catch(() => {
                        });
                        break;
                    }
                    case 'Pause':
                        v.pause();
                        if (Math.abs(v.currentTime - posSec) > SYNC_TOLERANCE) v.currentTime = posSec;
                        break;
                    case 'Seek':
                        syncSeek(posSec);
                        break;
                    case 'Stop':
                        exit();
                        break;
                    default:
                        break;
                }
                reveal();
            };
            const delay = localWhen - Date.now();
            if (delay > 30) setTimeout(apply, delay); else apply();
        });
        const offQueue = onSync('queue', (q) => {
            const cur = q.Playlist?.[q.PlayingItemIndex] || q.Playlist?.[0];
            if (!cur) return;
            if (cur.ItemId !== id) {
                navigate(`/play/${cur.ItemId}`, {replace: true});
                return;
            }
            if (readyPendingRef.current) reportReady(readyPendingRef.current.isPlaying);
        });
        return () => {
            offCmd();
            offQueue();
        };
    }, [id, navigate, exit, reveal, syncSeek, reportReady]);

    const segLabel = activeSegment?.Type === 'Outro' ? t('player.skipOutro') : t('player.skipIntro');
    const qualityKey = QUALITY_LEVELS.find((q) => q.key === quality)?.labelKey || 'media.quality.auto';
    const modeBadge = streamInfo?.mode === 'transcode' ? t(qualityKey) : t('player.original');
    const currentCue = subCues.find((c) => time >= c.start && time <= c.end)?.text || '';
    const epLine = episodeLine(item, t);
    const syncWaiting = !!group && (group.State === 'Waiting' || syncBusy);
    const showPausedCard = !playing && !pop && !scrubbing && !buffering && !syncWaiting;

    return (
        <div className="player-root" onMouseMove={reveal}>
            <video
                ref={videoRef}
                crossOrigin="anonymous"
                preload="auto"
                poster={BLANK_POSTER}
                onTimeUpdate={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    setTime(v.currentTime || 0);
                    updateBuffered();
                    if (getPref('autoSkipSegments')) {
                        const seg = segmentAt(segments, v.currentTime);
                        if (seg) v.currentTime = (seg.EndTicks / TICKS_PER_SEC) - 0.2;
                    }
                }}
                onProgress={updateBuffered}
                onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                onWaiting={() => {
                    setBuffering(true);
                    if (streamInfo?.mode !== 'transcode') {
                        clearTimeout(stallTimerRef.current);
                        stallTimerRef.current = setTimeout(() => {
                            const v = videoRef.current;
                            if (v && !v.paused && v.readyState < 3) fallbackToTranscode();
                        }, DIRECT_STALL_MS);
                    }
                    if (!isInGroup()) return;
                    clearTimeout(bufTimerRef.current);
                    bufTimerRef.current = setTimeout(() => {
                        const v = videoRef.current;
                        if (v && !v.paused && v.readyState < 3 && !bufferingRef.current) {
                            bufferingRef.current = true;
                            spBuffering({
                                When: serverNowIso(),
                                PositionTicks: Math.floor(v.currentTime * TICKS_PER_SEC),
                                IsPlaying: true,
                                PlaylistItemId: getPlaylistItemId()
                            });
                        }
                    }, 800);
                }}
                onPlaying={() => {
                    setBuffering(false);
                    setPlaying(true);
                    setSyncBusy(false);
                    clearTimeout(bufTimerRef.current);
                    clearTimeout(stallTimerRef.current);
                    if (isInGroup() && bufferingRef.current) {
                        bufferingRef.current = false;
                        reportReady(true);
                    }
                }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                    if (autoplayNext) goNext(); else exit();
                }}
                onError={() => {
                    if (!streamInfo) return;
                    if (!fallbackToTranscode()) {
                        setBuffering(false);
                        setPlaybackError(true);
                    }
                }}
            />
            {buffering && !playbackError && <div className="player-spinner"/>}

            {playbackError && (
                <div className="player-error">
                    <div className="player-error-title">{t('player.errorTitle')}</div>
                    <div className="player-error-sub">{t('player.errorSubtitle')}</div>
                    <button type="button" className="btn primary"
                            onClick={exit}>{t('common.actions.back')}</button>
                </div>
            )}

            {showPausedCard && <PausedCard item={item} epLine={epLine}/>}

            {currentCue && (
                <div className={`sub-overlay${showControls && !pop ? ' raised' : ''}`}>
                    <div>{currentCue}</div>
                </div>
            )}

            {activeSegment && !pop && (
                <button type="button" className="skip-btn" onClick={skipSegment}>
                    <SkipForward size={20}/> {segLabel}
                </button>
            )}

            {upNextActive && !pop && <UpNext nextEp={nextEp} secondsLeft={Math.ceil(duration - time)}/>}

            {pop === 'speed' && <SpeedPanel anchor="speed" speedIdx={speedIdx} onPick={pickSpeed}/>}

            {(pop === 'tracks' || pop === 'quality') && (
                <TrackMenu anchor={pop === 'quality' ? 'gear' : 'cc'} cols={cols}
                           menuCol={menuCol} menuRow={menuRow}/>
            )}

            {pop === 'episodes' && (
                <EpisodePanel anchor="eps" seasons={seasons} seasonIdx={seasonIdx} episodes={episodes} epIdx={epIdx}
                              currentId={item?.Id}
                              onPickSeason={pickSeason} onPickEpisode={playEpisode}/>
            )}

            <div
                className={`player-overlay${showControls || scrubbing || syncWaiting || zone === 'controls' || pop ? '' : ' hidden'}`}>
                <ScrubBar zone={zone} duration={duration} time={time} buffered={buffered}
                          scrubbing={scrubbing} scrubTime={scrubTime}
                          chapters={chapters} chapterAt={(sec) => chapterAt(chapters, sec)} trick={trick}
                          syncWaiting={syncWaiting}/>

                <ControlBar controls={controls} zone={zone} ctrlIdx={ctrlIdx}
                            playing={playing} speed={speed} item={item} group={group} nextEp={nextEp}
                            modeBadge={modeBadge}
                            onTogglePlay={togglePlay} onSeek={seek} onNext={goNext} onOpenMenu={openMenu}
                            onOpenSpeed={openSpeed} onOpenEpisodes={openEpisodes}/>
            </div>
        </div>
    );
}

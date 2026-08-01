import "./styles.sass";
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ChevronDown, ChevronUp, Play, Star, Volume2, VolumeX} from 'lucide-react';
import {useCached} from '@/common/utils/cache';
import Loader from '@/common/components/Loader';
import {togglePlayerMute, useYouTubePlayer} from '@/common/utils/youtube';
import {getTrailerMovies} from '@/common/utils/jellyfin';

const BATCH = 60;

export const Shorts = () => {
    const navigate = useNavigate();
    const {data: initial} = useCached('shorts', () => getTrailerMovies(BATCH));
    const [extra, setExtra] = useState([]);
    const [idx, setIdx] = useState(0);
    const [muted, setMuted] = useState(false);

    const list = useMemo(() => {
        const out = [];
        const seen = new Set();
        for (const t of [...(initial || []), ...extra]) {
            if (!seen.has(t.id)) {
                seen.add(t.id);
                out.push(t);
            }
        }
        return out;
    }, [initial, extra]);

    const stageRef = useRef(null);
    const idxRef = useRef(0);
    const listRef = useRef([]);
    const loadingMoreRef = useRef(false);
    useEffect(() => {
        idxRef.current = idx;
        listRef.current = list;
    });

    const loadMore = useCallback(async () => {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        const more = await getTrailerMovies(BATCH);
        setExtra((prev) => [...prev, ...more]);
        loadingMoreRef.current = false;
    }, []);

    const ready = list.length > 0;
    const goRef = useRef(null);
    const playerRef = useYouTubePlayer(stageRef, {
        enabled: ready,
        videoId: () => listRef.current[idxRef.current]?.youtubeId,
        playerVars: {showinfo: 0, cc_load_policy: 0, color: 'white', enablejsapi: 1},
        onEnded: () => goRef.current(1),
        onError: () => goRef.current(1),
    });

    const go = useCallback((dir) => {
        const cur = listRef.current;
        if (!cur.length) return;
        let next = idxRef.current + dir;
        if (next < 0) next = 0;
        if (next > cur.length - 1) {
            loadMore();
            next = cur.length - 1;
        }
        if (next === idxRef.current) return;
        idxRef.current = next;
        setIdx(next);
        const p = playerRef.current;
        if (p?.loadVideoById) p.loadVideoById(cur[next].youtubeId);
        if (next > cur.length - 6) loadMore();
    }, [loadMore, playerRef]);
    goRef.current = go;

    useEffect(() => {
        const onKey = (e) => {
            const stop = () => {
                e.preventDefault();
                e.stopPropagation();
            };
            switch (e.key) {
                case 'ArrowDown':
                case 'ArrowRight':
                    stop();
                    go(1);
                    break;
                case 'ArrowUp':
                case 'ArrowLeft':
                    stop();
                    go(-1);
                    break;
                case 'Enter':
                case ' ': {
                    stop();
                    const t = listRef.current[idxRef.current];
                    if (t) navigate(`/detail/${t.id}`);
                    break;
                }
                case 'm':
                case 'M':
                    stop();
                    setMuted(togglePlayerMute(playerRef.current));
                    break;
                case 'Escape':
                case 'Backspace':
                case 'GoBack':
                    stop();
                    navigate(-1);
                    break;
                default:
                    break;
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [go, navigate, playerRef]);

    if (!ready) {
        return initial && !initial.length
            ? <div className="page">
                <div className="empty">Keine Trailer gefunden.</div>
            </div>
            : <div className="page"><Loader label="Trailer werden geladen…"/></div>;
    }

    const cur = list[idx];
    const meta = [cur.year, (cur.genres || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ');

    return (
        <div className="page shorts-page">
            <div className="shorts-billboard">
                {cur.backdrop &&
                    <div className="shorts-glow" style={{backgroundImage: `url(${cur.backdrop})`}} key={`g${cur.id}`}/>}
                <div className="shorts-card">
                    <div className="shorts-stage" ref={stageRef}/>
                    <div className="shorts-scrim"/>
                    <div className="shorts-overlay">
                        <div className="shorts-meta">
                            <div className="shorts-title">{cur.name}</div>
                            <div className="shorts-sub">
                                {meta}
                                {cur.rating && <span className="shorts-rating"><Star className="inline-ico" size={13}
                                                                                     fill="currentColor"
                                                                                     strokeWidth={0}/> {cur.rating.toFixed(1)}</span>}
                            </div>
                            {cur.overview && <div className="shorts-overview">{cur.overview}</div>}
                            <div className="shorts-hint">
                                <span><Play className="inline-ico" size={15} fill="currentColor"/> OK = Ansehen</span>
                                <span><ChevronUp className="inline-ico" size={15}/><ChevronDown className="inline-ico"
                                                                                                size={15}/> Wechseln</span>
                                <span>{muted ? <VolumeX className="inline-ico" size={15}/> :
                                    <Volume2 className="inline-ico" size={15}/>} M = Ton</span>
                            </div>
                        </div>
                    </div>
                    <div className="shorts-progress">{idx + 1}</div>
                </div>
            </div>
        </div>
    );
}

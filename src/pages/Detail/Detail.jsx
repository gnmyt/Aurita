import "./styles.sass";
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate, useParams} from 'react-router-dom';
import {Check, Clapperboard, Heart, Play, Plus, RotateCcw, Star} from 'lucide-react';
import Card from '@/common/components/Card';
import PersonCard from '@/common/components/PersonCard';
import TrailerOverlay from '@/common/components/TrailerOverlay';
import Loader from '@/common/components/Loader';
import {toast} from '@/common/utils/toast';
import {useAutoFocusFirst, useFocusable} from '@/common/contexts/SpatialNav';
import {getCache, setCache} from '@/common/utils/cache';
import {youTubeId} from '@/common/utils/youtube';
import {itemMetaLine} from '@/common/utils/media';
import {useOpenItem} from '@/common/utils/navigation';
import {
    backdropUrl,
    getEpisodes,
    getItem,
    getMovieExtras,
    getSeasons,
    getSimilar,
    logoUrl,
    setFavorite,
    setPlayed,
} from '@/common/utils/jellyfin';

const extraLabel = (extra, base, fallback) => {
    const name = extra.Name || '';
    if (name.length > base.length && name.toLowerCase().startsWith(base.toLowerCase())) {
        return name.slice(base.length).replace(/^[\s\-–—:·]+/, '') || fallback;
    }
    return name === base ? fallback : name;
}

const FILLABLE_ICONS = new Set([Play, Heart]);

const Button = ({label, Icon, primary, active, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    const filled = FILLABLE_ICONS.has(Icon) && (primary || active);
    return (
        <div className={`btn${primary ? ' primary' : ''}${active ? ' active' : ''}`} {...handlers}>
            {Icon && <Icon size={22} strokeWidth={2.5} fill={filled ? 'currentColor' : 'none'}/>}
            <span>{label}</span>
        </div>
    );
}

const SeasonTab = ({season, active, onSelect}) => {
    const {handlers} = useFocusable({onSelect});
    return (
        <div className={`season-tab${active ? ' active' : ''}`} {...handlers}>
            {season.Name}
        </div>
    );
}

export const Detail = () => {
    const {t} = useTranslation();
    const {id} = useParams();
    const navigate = useNavigate();
    const openItem = useOpenItem();
    const [item, setItem] = useState(() => getCache(`item:${id}`) || null);
    const [seasons, setSeasons] = useState(() => getCache(`seasons:${id}`) || []);
    const [activeSeason, setActiveSeason] = useState(() => {
        const s = getCache(`seasons:${id}`);
        return s?.length ? s[0] : null;
    });
    const [episodes, setEpisodes] = useState([]);
    const [extras, setExtras] = useState([]);
    const [similar, setSimilar] = useState(() => getCache(`similar:${id}`) || []);
    const [played, setPlayedState] = useState(() => !!getCache(`item:${id}`)?.UserData?.Played);
    const [fav, setFavState] = useState(() => !!getCache(`item:${id}`)?.UserData?.IsFavorite);
    const [showTrailer, setShowTrailer] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let alive = true;
        setLoadError(false);
        const cachedItem = getCache(`item:${id}`) || null;
        setItem(cachedItem);
        setPlayedState(!!cachedItem?.UserData?.Played);
        setFavState(!!cachedItem?.UserData?.IsFavorite);
        const cachedSeasons = getCache(`seasons:${id}`) || [];
        setSeasons(cachedSeasons);
        setActiveSeason(cachedSeasons.length ? cachedSeasons[0] : null);
        setEpisodes([]);
        setExtras([]);
        setSimilar(getCache(`similar:${id}`) || []);
        setShowTrailer(false);
        (async () => {
            const it = await getItem(id).catch(() => null);
            if (!alive) return;
            if (!it) {
                if (!cachedItem) setLoadError(true);
                return;
            }
            setCache(`item:${id}`, it);
            setItem(it);
            setPlayedState(!!it.UserData?.Played);
            setFavState(!!it.UserData?.IsFavorite);
            if (!cachedItem) window.scrollTo?.(0, 0);
            getSimilar(it.Id, 16).then((s) => {
                if (alive) {
                    setSimilar(s);
                    setCache(`similar:${id}`, s);
                }
            });
            if (it.Type === 'Movie') getMovieExtras(it).then((ex) => {
                if (alive) setExtras(ex || []);
            });
            if (it.Type === 'Series') {
                const ss = await getSeasons(it.Id);
                if (!alive) return;
                setSeasons(ss);
                setCache(`seasons:${id}`, ss);
                if (ss.length) setActiveSeason((cur) => cur || ss[0]);
            } else if (it.Type === 'Season') {
                const eps = await getEpisodes(it.SeriesId, it.Id);
                if (!alive) return;
                setEpisodes(eps);
            }
        })();
        return () => {
            alive = false;
        };
    }, [id, reloadKey]);

    useEffect(() => {
        if (!activeSeason || !item) return;
        let alive = true;
        const cached = getCache(`episodes:${activeSeason.Id}`);
        if (cached) setEpisodes(cached);
        getEpisodes(item.Id, activeSeason.Id).then((eps) => {
            if (!alive) return;
            setEpisodes(eps);
            setCache(`episodes:${activeSeason.Id}`, eps);
        });
        return () => {
            alive = false;
        };
    }, [activeSeason, item]);

    useAutoFocusFirst(!!item || loadError);

    if (!item) {
        if (loadError) {
            return (
                <div className="page">
                    <div className="page-error">
                        <div className="page-error-title">{t('detail.errorTitle')}</div>
                        <div className="page-error-sub">{t('detail.errorSubtitle')}</div>
                        <div className="page-error-actions">
                            <Button primary focusKey="detail-retry" Icon={RotateCcw} label={t('common.actions.retry')}
                                    onSelect={() => {
                                        setLoadError(false);
                                        setReloadKey((k) => k + 1);
                                    }}/>
                            <Button label={t('common.actions.back')} onSelect={() => navigate(-1)}/>
                        </div>
                    </div>
                </div>
            );
        }
        return <div className="page"><Loader/></div>;
    }

    const bg = backdropUrl(item, 1920);
    const logo = logoUrl(item, 600);
    const isPlayable = item.Type === 'Movie';
    const ud = item.UserData || {};
    const hasResume = (ud.PlaybackPositionTicks || 0) > 0;

    const meta = itemMetaLine(item, {maxGenres: 3, runtime: true});

    const cast = (item.People || []).filter((p) => p.Type === 'Actor' || p.Type === 'Director' || p.Type === 'Writer').slice(0, 20);
    const trailerId = youTubeId(item.RemoteTrailers?.[0]?.Url);

    const openEpisode = (ep) => navigate(`/play/${ep.Id}`);
    const playSeries = () => {
        const target = episodes.find((e) => !e.UserData?.Played) || episodes[0];
        if (target) navigate(`/play/${target.Id}`);
    };
    const toggleWatched = async () => {
        const next = !played;
        setPlayedState(next);
        toast(next ? t('detail.toast.markedWatched') : t('detail.toast.markedUnwatched'));
        try {
            await setPlayed(item.Id, next);
        } catch {
            setPlayedState(!next);
        }
    };
    const toggleFav = async () => {
        const next = !fav;
        setFavState(next);
        toast(next ? t('detail.toast.addedToWatchlist') : t('detail.toast.removedFromWatchlist'));
        try {
            await setFavorite(item.Id, next);
        } catch {
            setFavState(!next);
        }
    };

    return (
        <div className="page" style={{padding: 0}}>
            <div className="detail-hero">
                {bg && <div className="bg" style={{backgroundImage: `url(${bg})`}}/>}
                <div className="detail-content">
                    {logo
                        ? <img className="detail-logo" src={logo} alt={item.Name}/>
                        : <div className="detail-title">{item.Name}</div>}
                    <div className="detail-meta">
                        {meta.map((m) => <span key={m}>{m}</span>)}
                        {item.CommunityRating && (
                            <span className="pill"><Star className="inline-ico" size={13} fill="currentColor"
                                                         strokeWidth={0}/> {item.CommunityRating.toFixed(1)}</span>
                        )}
                    </div>
                    {item.Overview && <div className="detail-overview">{item.Overview}</div>}
                    <div className="detail-actions">
                        {isPlayable && (
                            <Button primary focusKey="detail-play" Icon={Play}
                                    label={hasResume ? t('detail.resume') : t('detail.play')}
                                    onSelect={() => navigate(`/play/${item.Id}`)}/>
                        )}
                        {isPlayable && hasResume && (
                            <Button focusKey="detail-restart" Icon={RotateCcw} label={t('detail.restart')}
                                    onSelect={() => navigate(`/play/${item.Id}?restart=1`)}/>
                        )}
                        {item.Type === 'Series' && (
                            <Button primary focusKey="detail-play" Icon={Play} label={t('detail.playSeries')}
                                    onSelect={playSeries}/>
                        )}
                        {trailerId && (
                            <Button focusKey="detail-trailer" Icon={Clapperboard} label={t('detail.trailer')}
                                    onSelect={() => setShowTrailer(true)}/>
                        )}
                        <Button Icon={played ? Check : Plus} active={played}
                                label={played ? t('detail.watched') : t('detail.markWatched')} onSelect={toggleWatched}/>
                        <Button Icon={Heart} active={fav}
                                label={fav ? t('detail.onWatchlist') : t('detail.watchlist')} onSelect={toggleFav}/>
                    </div>
                </div>
            </div>

            {seasons.length > 0 && (
                <div className="season-tabs">
                    {seasons.map((s) => (
                        <SeasonTab key={s.Id} season={s} active={activeSeason?.Id === s.Id}
                                   onSelect={() => setActiveSeason(s)}/>
                    ))}
                </div>
            )}

            {episodes.length > 0 && (
                <div className="row" style={{marginTop: 16}}>
                    <div className="row-track">
                        {episodes.map((ep) => (
                            <Card key={ep.Id} item={ep} onSelect={() => openEpisode(ep)}/>
                        ))}
                    </div>
                </div>
            )}

            {cast.length > 0 && (
                <div className="row" style={{marginTop: 28}}>
                    <div className="row-title">{t('detail.castAndCrew')}</div>
                    <div className="row-track">
                        {cast.map((p) => (
                            <PersonCard key={p.Id + (p.Role || '')} person={p}
                                        onSelect={() => navigate(`/person/${p.Id}/${encodeURIComponent(p.Name)}`)}/>
                        ))}
                    </div>
                </div>
            )}

            {extras.length > 0 && (
                <div className="row" style={{marginTop: 24}}>
                    <div className="row-title">{t('detail.extras')}</div>
                    <div className="row-track">
                        {extras.map((ex) => (
                            <Card key={ex.Id} item={ex} poster={false} title={extraLabel(ex, item.Name || '', t('detail.otherVersion'))}
                                  onSelect={() => navigate(`/play/${ex.Id}`)}/>
                        ))}
                    </div>
                </div>
            )}

            {similar.length > 0 && (
                <div className="row" style={{marginTop: 12}}>
                    <div className="row-title">{t('detail.similar')}</div>
                    <div className="row-track">
                        {similar.map((s) => (
                            <Card key={s.Id} item={s} onSelect={() => openItem(s)}/>
                        ))}
                    </div>
                </div>
            )}

            {showTrailer && trailerId && (
                <TrailerOverlay youtubeId={trailerId} onClose={() => setShowTrailer(false)}/>
            )}
        </div>
    );
}

import {useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {Check, Play} from 'lucide-react';
import {wideImage} from '@/common/utils/jellyfin';
import {fmtRuntime, TICKS_PER_SEC} from '@/common/utils/time';
import {Popover} from './Popover';
import {useScrollIntoView} from '../hooks';

const progressPct = (ep) => {
    const pos = ep.UserData?.PlaybackPositionTicks || 0;
    if (!pos || !ep.RunTimeTicks) return 0;
    return Math.min(100, (pos / ep.RunTimeTicks) * 100);
}

const minutesLeft = (ep) => {
    const ticks = ep.RunTimeTicks - (ep.UserData?.PlaybackPositionTicks || 0);
    return Math.max(1, Math.round(ticks / TICKS_PER_SEC / 60));
}

export const EpisodePanel = ({
                                 anchor, seasons, seasonIdx, episodes, epIdx, currentId,
                                 onPickSeason, onPickEpisode,
                             }) => {
    const {t} = useTranslation();

    const rowRef = useScrollIntoView([epIdx, episodes]);
    const seasonRef = useRef(null);

    useEffect(() => {
        seasonRef.current?.scrollIntoView({block: 'nearest', inline: 'nearest'});
    }, [seasonIdx]);

    return (
        <Popover anchor={anchor} variant="episodes" title={t('player.episodes.title')}>
            <div className="ep-seasons">
                {seasons.map((s, i) => (
                    <button key={s.Id} type="button" onClick={() => onPickSeason(i)}
                            ref={i === seasonIdx ? seasonRef : null}
                            className={`ep-season${i === seasonIdx ? ' active' : ''}`}>
                        {s.Name}
                    </button>
                ))}
            </div>

            <div className="ep-list">
                {episodes.length === 0 && <div className="ep-empty">{t('player.episodes.empty')}</div>}
                {episodes.map((ep, i) => {
                    const pct = progressPct(ep);
                    const isCurrent = ep.Id === currentId;
                    const thumb = wideImage(ep, 320);
                    return (
                        <div key={ep.Id}
                             ref={i === epIdx ? rowRef : null}
                             onClick={() => onPickEpisode(i)}
                             className={`ep-row${i === epIdx ? ' focused' : ''}${isCurrent ? ' current' : ''}`}>
                            <div className="ep-thumb">
                                {thumb
                                    ? <img src={thumb} alt="" loading="lazy"/>
                                    : <div className="ep-thumb-blank"/>}
                                {isCurrent &&
                                    <div className="ep-thumb-badge"><Play size={16} fill="currentColor"/></div>}
                                {!isCurrent && ep.UserData?.Played && (
                                    <div className="ep-thumb-badge played"><Check size={16} strokeWidth={3}/></div>
                                )}
                                {pct > 0 && <div className="ep-thumb-progress"><div style={{width: `${pct}%`}}/></div>}
                            </div>
                            <div className="ep-info">
                                <div className="ep-row-title">
                                    <span className="ep-num">{ep.IndexNumber}</span>
                                    <span className="ep-name">{ep.Name}</span>
                                </div>
                                <div className="ep-meta">
                                    {fmtRuntime(ep.RunTimeTicks)}
                                    {pct > 0 && !ep.UserData?.Played && (
                                        <span className="ep-left">
                                            {t('player.episodes.remaining', {minutes: minutesLeft(ep)})}
                                        </span>
                                    )}
                                </div>
                                {ep.Overview && <div className="ep-overview">{ep.Overview}</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Popover>
    );
}

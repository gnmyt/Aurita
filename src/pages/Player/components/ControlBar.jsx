import {useTranslation} from 'react-i18next';
import {Gauge, Pause, Play, RotateCcw, RotateCw, Settings, SkipForward, Subtitles, Users} from 'lucide-react';

export const ControlBar = ({
                               controls, zone, ctrlIdx, playing, speed, item, group, nextEp, modeBadge,
                               onTogglePlay, onSeek, onNext, onOpenMenu, onOpenSpeed,
                           }) => {
    const {t} = useTranslation();
    const idxOf = (k) => controls.findIndex((c) => c.key === k);
    const cf = (k) => (zone === 'controls' && ctrlIdx === idxOf(k) ? ' focused' : '');
    return (
        <div className="nf-controls">
            <div className="nf-left">
                <button className={`nf-btn play${cf('play')}`} onClick={onTogglePlay}>
                    {playing ? <Pause size={30} fill="currentColor"/> : <Play size={30} fill="currentColor"/>}
                </button>
                <button className={`nf-btn${cf('rew')}`} onClick={() => onSeek(-10)}><RotateCcw size={26}/><span
                    className="nf-skipnum">10</span></button>
                <button className={`nf-btn${cf('fwd')}`} onClick={() => onSeek(10)}><RotateCw size={26}/><span
                    className="nf-skipnum">10</span></button>
            </div>

            <div className="nf-center">
                <span
                    className="nf-now">{item?.Type === 'Episode'
                    ? `${item.SeriesName} · ${t('common.card.episodeCode', {season: item.ParentIndexNumber, episode: item.IndexNumber})}`
                    : (item?.Name || '')}</span>
                {item?.Type === 'Episode' && <span className="nf-now-sub">{item.Name}</span>}
                {group && <span className="player-group"><Users size={14}/> {group.GroupName}</span>}
            </div>

            <div className="nf-right">
                {nextEp && <button className={`nf-btn${cf('next')}`} onClick={onNext} title={t('player.controls.nextEpisode')}><SkipForward
                    size={26} fill="currentColor"/></button>}
                <button className={`nf-btn${cf('cc')}`} onClick={() => onOpenMenu('tracks')} title={t('player.controls.audioAndSubtitles')}>
                    <Subtitles size={26}/></button>
                <button className={`nf-btn${cf('speed')}`} onClick={onOpenSpeed} title={t('player.controls.playbackSpeed')}>
                    <Gauge size={26}/>{speed !== 1 && <span className="nf-skipnum">{speed}x</span>}
                </button>
                <button className={`nf-btn${cf('gear')}`} onClick={() => onOpenMenu('quality')} title={t('player.controls.quality')}>
                    <Settings size={24}/></button>
                <span className="nf-mode">{modeBadge}</span>
            </div>
        </div>
    );
}

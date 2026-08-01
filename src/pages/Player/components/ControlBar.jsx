import {useTranslation} from 'react-i18next';
import {
    Captions,
    Gauge,
    ListVideo,
    Proportions,
    Pause,
    PictureInPicture,
    Play,
    RotateCcw,
    RotateCw,
    Settings,
    SkipForward,
    Subtitles,
    Users
} from 'lucide-react';

export const ControlBar = ({
                               controls, zone, ctrlIdx, playing, speed, item, group, nextEp, modeBadge,
                               aspectFill, canPip, canFill,
                               onTogglePlay, onSeek, onNext, onOpenMenu, onOpenSpeed, onOpenEpisodes,
                               onOpenOffset, onToggleAspect, onPip,
                           }) => {
    const {t} = useTranslation();
    const idxOf = (k) => controls.findIndex((c) => c.key === k);
    const cf = (k) => (zone === 'controls' && ctrlIdx === idxOf(k) ? ' focused' : '');
    return (
        <div className="nf-controls">
            <div className="nf-left">
                <button data-ctrl="play" className={`nf-btn play${cf('play')}`} onClick={onTogglePlay}>
                    {playing ? <Pause size={30} fill="currentColor"/> : <Play size={30} fill="currentColor"/>}
                </button>
                <button data-ctrl="rew" className={`nf-btn${cf('rew')}`} onClick={() => onSeek(-10)}><RotateCcw
                    size={26}/><span
                    className="nf-skipnum">10</span></button>
                <button data-ctrl="fwd" className={`nf-btn${cf('fwd')}`} onClick={() => onSeek(10)}><RotateCw
                    size={26}/><span
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
                {nextEp &&
                    <button data-ctrl="next" className={`nf-btn${cf('next')}`} onClick={onNext}
                            title={t('player.controls.nextEpisode')}><SkipForward
                        size={26} fill="currentColor"/></button>}
                {item?.Type === 'Episode' && (
                    <button data-ctrl="eps" className={`nf-btn${cf('eps')}`} onClick={onOpenEpisodes}
                            title={t('player.controls.episodes')}><ListVideo size={26}/></button>
                )}
                <button data-ctrl="cc" className={`nf-btn${cf('cc')}`} onClick={() => onOpenMenu('tracks')}
                        title={t('player.controls.audioAndSubtitles')}>
                    <Subtitles size={26}/></button>
                <button data-ctrl="offset" className={`nf-btn${cf('offset')}`} onClick={onOpenOffset}
                        title={t('player.controls.subtitleOffset')}><Captions size={26}/></button>
                {canFill && (
                    <button data-ctrl="aspect" className={`nf-btn${cf('aspect')}${aspectFill ? ' on' : ''}`}
                            onClick={onToggleAspect} title={t('player.controls.aspect')}>
                        <Proportions size={24}/></button>
                )}
                {canPip && (
                    <button data-ctrl="pip" className={`nf-btn${cf('pip')}`} onClick={onPip}
                            title={t('player.controls.pip')}><PictureInPicture size={24}/></button>
                )}
                <button data-ctrl="speed" className={`nf-btn${cf('speed')}`} onClick={onOpenSpeed}
                        title={t('player.controls.playbackSpeed')}>
                    {speed === 1 ? <Gauge size={26}/> : <span className="nf-speedval">{speed}x</span>}
                </button>
                <button data-ctrl="gear" className={`nf-btn${cf('gear')}`} onClick={() => onOpenMenu('quality')}
                        title={t('player.controls.quality')}>
                    <Settings size={24}/></button>
                <span className="nf-mode">{modeBadge}</span>
            </div>
        </div>
    );
}

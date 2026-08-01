import {useTranslation} from 'react-i18next';

export const PausedCard = ({item, epLine}) => {
    const {t} = useTranslation();
    return (
        <>
            <div className="player-pausedim"/>
            <div className="player-paused">
                <div className="pp-eyebrow">{t('player.watching')}</div>
                {item?.Name && <div className="pp-title">{item.Type === 'Episode' ? item.SeriesName : item.Name}</div>}
                {epLine && <div className="pp-line">{epLine}</div>}
                {item?.Type === 'Episode' && item?.Name && <div className="pp-chapter">{item.Name}</div>}
                {item?.Overview && <div className="pp-overview">{item.Overview}</div>}
            </div>
        </>
    );
}

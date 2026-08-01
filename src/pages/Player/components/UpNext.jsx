import {Trans, useTranslation} from 'react-i18next';
import {ChevronDown} from 'lucide-react';

export const UpNext = ({nextEp, secondsLeft}) => {
    const {t} = useTranslation();
    return (
        <div className="upnext">
            <div className="upnext-label">{t('player.upNext.label', {seconds: secondsLeft})}</div>
            <div className="upnext-title">{nextEp.SeriesName}</div>
            <div className="upnext-sub">
                {t('common.card.episodeCode', {season: nextEp.ParentIndexNumber, episode: nextEp.IndexNumber})} · {nextEp.Name}
            </div>
            <div className="upnext-actions">
        <span className="upnext-hint">
          <Trans i18nKey="player.upNext.hint" components={{1: <ChevronDown className="inline-ico" size={15}/>}}/>
        </span>
            </div>
        </div>
    );
}

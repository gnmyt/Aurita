import "./styles.sass";
import {memo} from 'react';
import {useTranslation} from 'react-i18next';
import {Check, Heart} from 'lucide-react';
import {useFocusable} from '@/common/contexts/SpatialNav';
import {useCardOptions} from '@/common/contexts/CardOptions';
import {useVideoPreview} from './utils/useVideoPreview';
import {useSettledFocus} from './utils/useSettledFocus';
import {logoUrl, posterImage, wideImage} from '@/common/utils/jellyfin';
import {getPref} from '@/common/utils/prefs';
import {fmtDuration} from '@/common/utils/time';
import {BLANK_POSTER} from '@/common/utils/media';

const CardInner = ({item, onSelect, poster, focusKey, title: titleOverride}) => {
    const {t} = useTranslation();
    const cardOpts = useCardOptions();
    const canOptions = cardOpts && ['Movie', 'Series', 'Episode', 'Season'].includes(item?.Type);
    const {focused, handlers} = useFocusable({
        onSelect, focusKey, restoreKey: item?.Id,
        onLongPress: canOptions ? () => cardOpts.open(item) : undefined,
    });
    const canPreview = ['Movie', 'Episode'].includes(item?.Type);
    const {videoRef, ready: previewReady} = useVideoPreview({
        item, focused, enabled: canPreview && getPref('autoplayPreviews'),
    });
    const isPoster = poster ?? (item.Type !== 'Episode');
    const img = isPoster ? posterImage(item, 400) : wideImage(item, 500);
    const expanded = useSettledFocus(focused);
    const wide = isPoster && expanded ? wideImage(item, 800) : null;
    const logo = isPoster && expanded ? logoUrl(item, 360) : null;

    const ud = item.UserData || {};
    const pct = ud.PlayedPercentage || (ud.PlaybackPositionTicks && item.RunTimeTicks
        ? (ud.PlaybackPositionTicks / item.RunTimeTicks) * 100 : 0);

    let title = item.Name;
    let sub = '';
    if (item.Type === 'Episode') {
        title = item.SeriesName || item.Name;
        const se = item.ParentIndexNumber != null && item.IndexNumber != null
            ? `${t('common.card.episodeCode', {season: item.ParentIndexNumber, episode: item.IndexNumber})} · ` : '';
        sub = `${se}${item.Name}`;
    } else if (item.Type === 'Movie') {
        sub = item.ProductionYear ? String(item.ProductionYear) : t('common.card.movie');
    } else if (item.Type === 'Series') {
        sub = item.ProductionYear
            ? t('common.card.seriesWithYear', {year: item.ProductionYear})
            : t('common.card.series');
    } else if (item.Type === 'Season') {
        sub = item.ChildCount ? t('common.card.seasonEpisodes', {count: item.ChildCount}) : '';
    } else if (item.IsFolder) {
        sub = t('common.card.folder');
    }

    if (titleOverride != null) title = titleOverride;

    const dur = item.Type === 'Episode' || item.Type === 'Movie' ? fmtDuration(item.RunTimeTicks) : null;
    const played = ud.Played;
    const unplayed = ud.UnplayedItemCount || 0;
    const favorite = ud.IsFavorite;

    return (
        <div className={`card${isPoster ? ' poster' : ''}`} {...handlers}>
            <div className="card-thumb">
                {img
                    ? <img className="card-poster-img" src={img} alt="" loading="lazy"/>
                    : <div className="placeholder">{title}</div>}
                {focused && canPreview && (
                    <video
                        ref={videoRef}
                        className={`card-preview-video${previewReady ? ' ready' : ''}`}
                        muted
                        playsInline
                        loop
                        preload="none"
                        poster={BLANK_POSTER}
                    />
                )}
                {isPoster && wide && (
                    <>
                        <img className="card-wide-img" src={wide} alt="" decoding="async"/>
                        <div className="card-expand">
                            {logo
                                ? <img className="card-expand-logo" src={logo} alt={title} decoding="async"/>
                                : <div className="card-expand-title">{title}</div>}
                            {sub && <div className="card-expand-sub">{sub}</div>}
                        </div>
                    </>
                )}
                {favorite && <div className="card-badge fav"><Heart size={14} fill="currentColor"/></div>}
                {played && item.Type !== 'Series' &&
                    <div className="card-badge played"><Check size={15} strokeWidth={3}/></div>}
                {unplayed > 0 && <div className="card-badge count">{unplayed}</div>}
                {dur && <div className="card-duration">{dur}</div>}
                {isPoster && item.Type === 'Episode' && item.ParentIndexNumber != null && item.IndexNumber != null && (
                    <div className="card-se">
                        {t('common.card.episodeCode', {season: item.ParentIndexNumber, episode: item.IndexNumber})}
                    </div>
                )}
                {pct > 1 && pct < 99 && (
                    <div className="card-progress">
                        <div style={{width: `${pct}%`}}/>
                    </div>
                )}
            </div>
            {!isPoster && (
                <div className="card-meta">
                    <div className="card-title">{title}</div>
                    {sub && <div className="card-sub">{sub}</div>}
                </div>
            )}
        </div>
    );
}

export const Card = memo(CardInner);

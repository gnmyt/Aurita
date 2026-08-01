import {useTranslation} from 'react-i18next';
import Row from '@/common/components/Row';
import Spotlight from '@/common/components/Spotlight';
import Loader from '@/common/components/Loader';
import {useAutoFocusFirst} from '@/common/contexts/SpatialNav';
import {useCached} from '@/common/utils/cache';
import {useOpenItem} from '@/common/utils/navigation';
import {
    getFavorites,
    getLatest,
    getNextUp,
    getResume,
    getSimilar,
    getSpotlight,
    getSuggestions,
    getViews,
} from '@/common/utils/jellyfin';

export const Home = () => {
    const {t} = useTranslation();
    const openItem = useOpenItem();

    const {data, loading} = useCached('home', async () => {
        const [resume, nextUp, views, spotlight, favorites, suggestions] = await Promise.all([
            getResume(), getNextUp(), getViews(), getSpotlight(6), getFavorites(), getSuggestions(),
        ]);
        const latestEntries = await Promise.all(
            (views || []).map((v) => getLatest(v.Id, 20).then((items) => [v.Id, items || []]))
        );
        const seed = [...(favorites || []), ...(resume || []), ...(nextUp || [])].find(Boolean);
        let because = [];
        let becauseName = '';
        if (seed) {
            const seedId = seed.Type === 'Episode' ? seed.SeriesId : seed.Id;
            becauseName = seed.Type === 'Episode' ? (seed.SeriesName || seed.Name) : seed.Name;
            if (seedId) because = (await getSimilar(seedId, 16)) || [];
        }
        return {
            resume: resume || [], nextUp: nextUp || [], views: views || [],
            spotlight: spotlight || [], favorites: favorites || [], suggestions: suggestions || [],
            latest: Object.fromEntries(latestEntries),
            because, becauseName,
        };
    });

    useAutoFocusFirst(!!data);

    if (!data) {
        return loading ? <div className="page"><Loader/></div> : null;
    }
    const {resume, nextUp, views, spotlight, favorites, suggestions, latest, because, becauseName} = data;

    return (
        <div className="page" style={{paddingTop: 0}}>
            <Spotlight items={spotlight}/>
            <Row title={t('home.continueWatching')} items={resume} onSelect={openItem} poster/>
            <Row title={t('home.nextUp')} items={nextUp} onSelect={openItem} poster/>
            <Row title={t('home.watchlist')} items={favorites} onSelect={openItem}/>
            {becauseName && because.length > 0 && (
                <Row title={t('home.because', {name: becauseName})} items={because} onSelect={openItem}/>
            )}
            {views.map((v) => (
                <Row key={v.Id} title={t('home.latestIn', {library: v.Name})} items={latest[v.Id]} onSelect={openItem}/>
            ))}
            <Row title={t('home.suggestions')} items={suggestions} onSelect={openItem}/>
        </div>
    );
}

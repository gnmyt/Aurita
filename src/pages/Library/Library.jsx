import './styles.sass';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate, useParams} from 'react-router-dom';
import {ArrowDownUp, Building2, CalendarRange, Filter, ShieldCheck} from 'lucide-react';
import ItemGrid from '@/common/components/ItemGrid';
import {useAutoFocusFirst, useFocusable} from '@/common/contexts/SpatialNav';
import {useCached} from '@/common/utils/cache';
import {useOpenItem} from '@/common/utils/navigation';
import {getGenres, getItem, getItems, getLibraryFilters, getStudios} from '@/common/utils/jellyfin';
import {AlphaPicker} from './components/AlphaPicker';
import {FilterPicker} from './components/FilterPicker';

const SORTS = [
    {key: 'name', labelKey: 'library.sort.name', SortBy: 'SortName', SortOrder: 'Ascending'},
    {key: 'added', labelKey: 'library.sort.added', SortBy: 'DateCreated', SortOrder: 'Descending'},
    {key: 'year', labelKey: 'library.sort.year', SortBy: 'PremiereDate,ProductionYear', SortOrder: 'Descending'},
    {key: 'rating', labelKey: 'library.sort.rating', SortBy: 'CommunityRating', SortOrder: 'Descending'},
    {key: 'random', labelKey: 'library.sort.random', SortBy: 'Random'},
];
const FILTERS = [
    {key: 'all', labelKey: 'library.filter.all'},
    {key: 'unplayed', labelKey: 'library.filter.unplayed', Filters: 'IsUnplayed'},
    {key: 'fav', labelKey: 'library.filter.fav', Filters: 'IsFavorite'},
];

const Pill = ({label, Icon, onSelect, focusKey, active}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className={`lib-pill${active ? ' active' : ''}`} {...handlers}>
            {Icon && <Icon size={16}/>}<span>{label}</span>
        </div>
    );
}

export const Library = () => {
    const {t} = useTranslation();
    const {id} = useParams();
    const navigate = useNavigate();
    const openItem = useOpenItem();
    const [sortIdx, setSortIdx] = useState(0);
    const [filterIdx, setFilterIdx] = useState(0);
    const [letter, setLetter] = useState(null);
    const [year, setYear] = useState(null);
    const [rating, setRating] = useState(null);
    const [studio, setStudio] = useState(null);
    const [picker, setPicker] = useState(null);

    useEffect(() => {
        setSortIdx(0);
        setFilterIdx(0);
        setLetter(null);
        setYear(null);
        setRating(null);
        setStudio(null);
    }, [id]);

    const {data: meta} = useCached(`libmeta:${id}`, async () => {
        const [parent, genres, filters, studios] = await Promise.all([
            getItem(id).catch(() => null),
            getGenres(id).catch(() => []),
            getLibraryFilters(id),
            getStudios(id).catch(() => []),
        ]);
        return {parent, genres: genres || [], filters, studios: studios || []};
    });
    const parent = meta?.parent;
    const genres = meta?.genres || [];
    const years = meta?.filters?.years || [];
    const ratings = meta?.filters?.officialRatings || [];
    const studios = meta?.studios || [];

    const {data: items, loading} = useCached(
        `lib:${id}:${SORTS[sortIdx].key}:${FILTERS[filterIdx].key}:${letter || ''}:${year || ''}:${rating || ''}:${studio?.Id || ''}`,
        () => {
            const sort = SORTS[sortIdx];
            const filter = FILTERS[filterIdx];
            return getItems({
                ParentId: id, SortBy: sort.SortBy, SortOrder: sort.SortOrder,
                Filters: filter.Filters, Limit: 400,
                NameStartsWith: letter && letter !== '#' ? letter : undefined,
                NameLessThan: letter === '#' ? 'A' : undefined,
                Years: year || undefined,
                OfficialRatings: rating || undefined,
                StudioIds: studio?.Id || undefined,
            }).then((d) => d?.Items || []);
        },
    );

    useAutoFocusFirst(!!items && items.length > 0);

    return (
        <div className="page">
            <div className="page-title">{parent?.Name || t('library.fallbackTitle')}</div>

            <div className="lib-toolbar">
                <Pill focusKey="lib-sort" Icon={ArrowDownUp} label={t(SORTS[sortIdx].labelKey)}
                      onSelect={() => setSortIdx((i) => (i + 1) % SORTS.length)}/>
                <Pill focusKey="lib-filter" Icon={Filter} label={t(FILTERS[filterIdx].labelKey)}
                      active={filterIdx !== 0}
                      onSelect={() => setFilterIdx((i) => (i + 1) % FILTERS.length)}/>
                {years.length > 0 && (
                    <Pill focusKey="lib-year" Icon={CalendarRange} active={!!year}
                          label={year ? String(year) : t('library.filter.year')}
                          onSelect={() => setPicker('year')}/>
                )}
                {ratings.length > 0 && (
                    <Pill focusKey="lib-rating" Icon={ShieldCheck} active={!!rating}
                          label={rating || t('library.filter.rating')}
                          onSelect={() => setPicker('rating')}/>
                )}
                {studios.length > 0 && (
                    <Pill focusKey="lib-studio" Icon={Building2} active={!!studio}
                          label={studio?.Name || t('library.filter.studio')}
                          onSelect={() => setPicker('studio')}/>
                )}
                {genres.slice(0, 12).map((g) => (
                    <Pill key={g.Id} label={g.Name}
                          onSelect={() => navigate(`/genre/${g.Id}/${encodeURIComponent(g.Name)}?parent=${id}`)}/>
                ))}
            </div>

            <AlphaPicker value={letter} onChange={setLetter}/>

            <ItemGrid items={items} loading={loading} onSelect={openItem}/>

            {picker === 'year' && (
                <FilterPicker
                    title={t('library.filter.year')} value={year}
                    options={years.map((y) => ({key: y, value: y, label: String(y)}))}
                    onPick={(v) => {
                        setYear(v);
                        setPicker(null);
                    }}
                    onClose={() => setPicker(null)}/>
            )}
            {picker === 'rating' && (
                <FilterPicker
                    title={t('library.filter.rating')} value={rating}
                    options={ratings.map((r) => ({key: r, value: r, label: r}))}
                    onPick={(v) => {
                        setRating(v);
                        setPicker(null);
                    }}
                    onClose={() => setPicker(null)}/>
            )}
            {picker === 'studio' && (
                <FilterPicker
                    title={t('library.filter.studio')} value={studio?.Id ?? null}
                    options={studios.map((sv) => ({key: sv.Id, value: sv.Id, label: sv.Name}))}
                    onPick={(v) => {
                        setStudio(v ? studios.find((sv) => sv.Id === v) : null);
                        setPicker(null);
                    }}
                    onClose={() => setPicker(null)}/>
            )}
        </div>
    );
}

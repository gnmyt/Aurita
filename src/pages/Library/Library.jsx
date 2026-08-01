import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {ArrowDownUp, Filter} from 'lucide-react';
import ItemGrid from '@/common/components/ItemGrid';
import {useAutoFocusFirst, useFocusable} from '@/common/contexts/SpatialNav';
import {useCached} from '@/common/utils/cache';
import {useOpenItem} from '@/common/utils/navigation';
import {getGenres, getItem, getItems} from '@/common/utils/jellyfin';

const SORTS = [
    {key: 'name', label: 'Name (A–Z)', SortBy: 'SortName', SortOrder: 'Ascending'},
    {key: 'added', label: 'Zuletzt hinzugefügt', SortBy: 'DateCreated', SortOrder: 'Descending'},
    {key: 'year', label: 'Erscheinungsjahr', SortBy: 'PremiereDate,ProductionYear', SortOrder: 'Descending'},
    {key: 'rating', label: 'Bewertung', SortBy: 'CommunityRating', SortOrder: 'Descending'},
    {key: 'random', label: 'Zufällig', SortBy: 'Random'},
];
const FILTERS = [
    {key: 'all', label: 'Alle'},
    {key: 'unplayed', label: 'Ungesehen', Filters: 'IsUnplayed'},
    {key: 'fav', label: 'Favoriten', Filters: 'IsFavorite'},
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
    const {id} = useParams();
    const navigate = useNavigate();
    const openItem = useOpenItem();
    const [sortIdx, setSortIdx] = useState(0);
    const [filterIdx, setFilterIdx] = useState(0);

    useEffect(() => {
        setSortIdx(0);
        setFilterIdx(0);
    }, [id]);

    const {data: meta} = useCached(`libmeta:${id}`, async () => {
        const [parent, genres] = await Promise.all([getItem(id).catch(() => null), getGenres(id).catch(() => [])]);
        return {parent, genres: genres || []};
    });
    const parent = meta?.parent;
    const genres = meta?.genres || [];

    const {data: items, loading} = useCached(
        `lib:${id}:${SORTS[sortIdx].key}:${FILTERS[filterIdx].key}`,
        () => {
            const sort = SORTS[sortIdx];
            const filter = FILTERS[filterIdx];
            return getItems({
                ParentId: id, SortBy: sort.SortBy, SortOrder: sort.SortOrder,
                Filters: filter.Filters, Limit: 400,
            }).then((d) => d?.Items || []);
        },
    );

    useAutoFocusFirst(!!items && items.length > 0);

    return (
        <div className="page">
            <div className="page-title">{parent?.Name || 'Bibliothek'}</div>

            <div className="lib-toolbar">
                <Pill focusKey="lib-sort" Icon={ArrowDownUp} label={SORTS[sortIdx].label}
                      onSelect={() => setSortIdx((i) => (i + 1) % SORTS.length)}/>
                <Pill focusKey="lib-filter" Icon={Filter} label={FILTERS[filterIdx].label}
                      active={filterIdx !== 0}
                      onSelect={() => setFilterIdx((i) => (i + 1) % FILTERS.length)}/>
                {genres.slice(0, 12).map((g) => (
                    <Pill key={g.Id} label={g.Name}
                          onSelect={() => navigate(`/genre/${g.Id}/${encodeURIComponent(g.Name)}?parent=${id}`)}/>
                ))}
            </div>

            <ItemGrid items={items} loading={loading} onSelect={openItem}/>
        </div>
    );
}

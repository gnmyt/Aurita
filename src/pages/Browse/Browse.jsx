import {useParams, useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import ItemGrid from '@/common/components/ItemGrid';
import {useAutoFocusFirst} from '@/common/contexts/SpatialNav';
import {useCached} from '@/common/utils/cache';
import {useOpenItem} from '@/common/utils/navigation';
import {getItems} from '@/common/utils/jellyfin';

export const Browse = ({mode}) => {
    const {t} = useTranslation();
    const {id, name} = useParams();
    const [params] = useSearchParams();
    const parent = params.get('parent');
    const openItem = useOpenItem();

    const {data: items, loading} = useCached(`browse:${mode}:${id}:${parent || ''}`, () => {
        const filter = mode === 'person'
            ? {PersonIds: id, SortBy: 'PremiereDate', SortOrder: 'Descending'}
            : {GenreIds: id, SortBy: 'SortName', SortOrder: 'Ascending', ...(parent ? {ParentId: parent} : {})};
        return getItems({...filter, Recursive: true, IncludeItemTypes: 'Movie,Series', Limit: 300})
            .then((d) => d?.Items || []);
    }, [id, mode, parent]);

    useAutoFocusFirst(!!items && items.length > 0);

    const title = mode === 'person'
        ? (name ? decodeURIComponent(name) : t('browse.person'))
        : t('browse.genre', {name: decodeURIComponent(name || '')});

    return (
        <div className="page">
            <div className="page-title">{title}</div>
            <ItemGrid items={items} loading={loading} onSelect={openItem}/>
        </div>
    );
}

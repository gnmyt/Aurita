import {useTranslation} from 'react-i18next';
import Card from '@/common/components/Card';
import Loader from '@/common/components/Loader';

export const ItemGrid = ({items, loading, onSelect, empty}) => {
    const {t} = useTranslation();
    if (!items) return loading ? <Loader/> : null;
    if (items.length === 0) return <div className="empty">{empty || t('common.itemGrid.empty')}</div>;
    return (
        <div className="grid">
            {items.map((item) => (
                <Card key={item.Id} item={item} onSelect={() => onSelect(item)}/>
            ))}
        </div>
    );
}

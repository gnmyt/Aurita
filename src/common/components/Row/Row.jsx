import "./styles.sass";
import Card from '@/common/components/Card';

export const Row = ({title, items, onSelect, poster}) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="row">
            {title && <div className="row-title">{title}</div>}
            <div className="row-track">
                {items.map((item) => (
                    <Card
                        key={item.Id}
                        item={item}
                        poster={poster}
                        onSelect={() => onSelect(item)}
                    />
                ))}
            </div>
        </div>
    );
}

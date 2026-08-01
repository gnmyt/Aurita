import {useFocusable} from '@/common/contexts/SpatialNav';
import {personImage} from '@/common/utils/jellyfin';

export const PersonCard = ({person, onSelect}) => {
    const {handlers} = useFocusable({onSelect});
    const img = personImage(person, 240);
    return (
        <div className="person-card" {...handlers}>
            <div className="person-avatar">
                {img ? <img src={img} alt="" loading="lazy"/> : <span>{person.Name?.[0] || '?'}</span>}
            </div>
            <div className="person-name">{person.Name}</div>
            {person.Role && <div className="person-role">{person.Role}</div>}
        </div>
    );
}

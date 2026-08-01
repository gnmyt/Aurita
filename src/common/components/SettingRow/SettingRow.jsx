import {ChevronRight} from 'lucide-react';
import {useFocusable} from '@/common/contexts/SpatialNav';

export const SettingRow = ({icon, leading, title, subtitle, value, chevron, onSelect, focusKey, danger}) => {
    const {handlers} = useFocusable(onSelect ? {onSelect, focusKey} : {});
    const cls = `set-row${onSelect ? ' actionable' : ''}${danger ? ' danger' : ''}`;
    return (
        <div className={cls} {...(onSelect ? handlers : {})}>
            <div className="set-row-lead">{leading || icon}</div>
            <div className="set-row-text">
                <div className="set-row-title">{title}</div>
                {subtitle && <div className="set-row-sub">{subtitle}</div>}
            </div>
            {value != null && <div className="set-row-value">{value}</div>}
            {chevron && <ChevronRight className="set-row-chev" size={24}/>}
        </div>
    );
}

import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Check} from 'lucide-react';
import {isBackKey, useFocusable, useKeyTrap, useSpatial} from '@/common/contexts/SpatialNav';

const Option = ({label, active, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className="lang-opt" {...handlers}>
            <span className="lang-opt-check">{active && <Check size={20} strokeWidth={3}/>}</span>
            <span className="lang-opt-name">{label}</span>
        </div>
    );
}

export const FilterPicker = ({title, options, value, onPick, onClose}) => {
    const {t} = useTranslation();
    const spatial = useSpatial();

    useEffect(() => {
        const active = options.findIndex((o) => o.value === value);
        const timer = setTimeout(() => spatial.focusId(`filt-${Math.max(0, active + 1)}`), 0);
        return () => clearTimeout(timer);
    }, [spatial, options, value]);

    useKeyTrap((e) => {
        if (isBackKey(e)) {
            e.preventDefault();
            e.stopPropagation();
            onClose();
        }
    });

    return (
        <div className="langpicker" data-modal>
            <div className="lang-panel">
                <div className="lang-title">{title}</div>
                <div className="lang-list">
                    <Option
                        label={t('library.filter.any')}
                        active={value == null}
                        focusKey="filt-0"
                        onSelect={() => onPick(null)}
                    />
                    {options.map((o, i) => (
                        <Option
                            key={o.key}
                            label={o.label}
                            active={o.value === value}
                            focusKey={`filt-${i + 1}`}
                            onSelect={() => onPick(o.value)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

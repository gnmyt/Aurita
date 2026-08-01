import {useTranslation} from 'react-i18next';
import {useFocusable} from '@/common/contexts/SpatialNav';

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

const Letter = ({label, active, onSelect}) => {
    const {handlers} = useFocusable({onSelect});
    return (
        <div className={`alpha-letter${active ? ' active' : ''}`} {...handlers}>{label}</div>
    );
}

export const AlphaPicker = ({value, onChange}) => {
    const {t} = useTranslation();
    return (
        <div className="alpha-picker">
            <Letter label={t('library.alphaAll')} active={!value} onSelect={() => onChange(null)}/>
            {LETTERS.map((l) => (
                <Letter key={l} label={l} active={value === l} onSelect={() => onChange(l)}/>
            ))}
        </div>
    );
}

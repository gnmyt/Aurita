import {useTranslation} from 'react-i18next';
import {Minus, Plus, RotateCcw} from 'lucide-react';
import {Popover} from './Popover';
import {SUB_OFFSET_MAX, SUB_OFFSET_STEP} from '../utils';

export const SubtitleOffsetPanel = ({anchor, offset, onChange}) => {
    const {t} = useTranslation();
    const clamp = (v) => Math.max(-SUB_OFFSET_MAX, Math.min(SUB_OFFSET_MAX, Math.round(v * 10) / 10));
    const label = offset === 0
        ? t('player.offsetNone')
        : `${offset > 0 ? '+' : ''}${offset.toFixed(1)}s`;

    return (
        <Popover anchor={anchor} variant="offset" title={t('player.subtitleOffset')}>
            <div className="offset-row">
                <button type="button" className="offset-btn" data-focus-row="0"
                        onClick={() => onChange(clamp(offset - SUB_OFFSET_STEP))}>
                    <Minus size={26}/>
                </button>
                <div className="offset-value">{label}</div>
                <button type="button" className="offset-btn" data-focus-row="1"
                        onClick={() => onChange(clamp(offset + SUB_OFFSET_STEP))}>
                    <Plus size={26}/>
                </button>
                <button type="button" className="offset-btn reset" data-focus-row="2"
                        onClick={() => onChange(0)} title={t('player.offsetReset')}>
                    <RotateCcw size={22}/>
                </button>
            </div>
            <div className="offset-hint">{t('player.subtitleOffsetHint')}</div>
        </Popover>
    );
}

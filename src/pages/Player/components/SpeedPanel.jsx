import {useTranslation} from 'react-i18next';
import {SPEEDS} from '../utils';
import {Popover} from './Popover';

export const SpeedPanel = ({anchor, speedIdx, onPick}) => {
    const {t} = useTranslation();
    return (
        <Popover anchor={anchor} variant="speed" title={t('player.speedTitle')}>
            <div className="speed-track">
                <div className="speed-line"/>
                {SPEEDS.map((s, i) => (
                    <div key={s.v} onClick={() => onPick(i)}
                         className={`speed-stop${i === speedIdx ? ' active' : ''}`}>
                        <div className="speed-dotwrap">
                            <div className="speed-dot"/>
                        </div>
                        <div className="speed-label">{s.labelKey ? t(s.labelKey) : s.label}</div>
                    </div>
                ))}
            </div>
        </Popover>
    );
}

import {useTranslation} from 'react-i18next';
import {SPEEDS} from '../utils';

export const SpeedPanel = ({speedIdx}) => {
    const {t} = useTranslation();
    return (
        <div className="speed-panel">
            <div className="speed-title">{t('player.speedTitle')}</div>
            <div className="speed-track">
                <div className="speed-line"/>
                {SPEEDS.map((s, i) => (
                    <div key={s.v} className={`speed-stop${i === speedIdx ? ' active' : ''}`}>
                        <div className="speed-dotwrap">
                            <div className="speed-dot"/>
                        </div>
                        <div className="speed-label">{s.labelKey ? t(s.labelKey) : s.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

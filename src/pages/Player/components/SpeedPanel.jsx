import {SPEEDS} from '../utils';

export const SpeedPanel = ({speedIdx}) => {
    return (
        <div className="speed-panel">
            <div className="speed-title">Playback Speed</div>
            <div className="speed-track">
                <div className="speed-line"/>
                {SPEEDS.map((s, i) => (
                    <div key={s.v} className={`speed-stop${i === speedIdx ? ' active' : ''}`}>
                        <div className="speed-dotwrap">
                            <div className="speed-dot"/>
                        </div>
                        <div className="speed-label">{s.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

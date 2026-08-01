import "./styles.sass";
import {useRef} from 'react';
import {CornerUpLeft} from 'lucide-react';
import {ARROW_KEYS, isBackKey, isOkKey, useKeyTrap} from '@/common/contexts/SpatialNav';
import {togglePlayerMute, useYouTubePlayer} from '@/common/utils/youtube';

export const TrailerOverlay = ({youtubeId, onClose}) => {
    const stageRef = useRef(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    const playerRef = useYouTubePlayer(stageRef, {
        videoId: youtubeId,
        onEnded: () => closeRef.current?.(),
        onError: () => closeRef.current?.(),
        onLoadFail: () => closeRef.current?.(),
    });

    useKeyTrap((e) => {
        const stop = () => {
            e.preventDefault();
            e.stopPropagation();
        };
        if (isBackKey(e) || isOkKey(e)) {
            stop();
            closeRef.current?.();
        } else if (ARROW_KEYS.includes(e.key)) {
            stop();
        } else if (e.key === 'm' || e.key === 'M') {
            stop();
            togglePlayerMute(playerRef.current);
        }
    });

    return (
        <div className="trailer-overlay">
            <div className="trailer-stage" ref={stageRef}/>
            <div className="trailer-hint"><CornerUpLeft className="inline-ico" size={15}/> Zurück zum Schließen</div>
        </div>
    );
}

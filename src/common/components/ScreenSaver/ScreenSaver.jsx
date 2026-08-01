import "./styles.sass";
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';
import {useCached} from '@/common/utils/cache';
import {backdropUrl, getSpotlight} from '@/common/utils/jellyfin';
import {getPref} from '@/common/utils/prefs';

const IDLE_MS = 5 * 60 * 1000;
const SLIDE_MS = 9000;

export const ScreenSaver = () => {
    const {t} = useTranslation();
    const location = useLocation();
    const [active, setActive] = useState(false);
    const [idx, setIdx] = useState(0);
    const [now, setNow] = useState(() => new Date());

    const immersive = location.pathname.startsWith('/play') || location.pathname.startsWith('/shorts');
    const showing = active && !immersive;
    const {data: items} = useCached(active ? 'screensaver' : null, () => getSpotlight(12));

    const stateRef = useRef({immersive, showing});
    useEffect(() => {
        stateRef.current = {immersive, showing};
    });

    useEffect(() => {
        let t;
        const arm = () => {
            clearTimeout(t);
            if (!getPref('screensaver')) return;
            t = setTimeout(() => {
                if (!stateRef.current.immersive) setActive(true);
            }, IDLE_MS);
        };
        const onActivity = (e) => {
            setActive(false);
            if (stateRef.current.showing && e.type === 'keydown') {
                e.preventDefault();
                e.stopPropagation();
            }
            arm();
        };
        window.addEventListener('keydown', onActivity, true);
        window.addEventListener('mousemove', onActivity, true);
        window.addEventListener('click', onActivity, true);
        arm();
        return () => {
            clearTimeout(t);
            window.removeEventListener('keydown', onActivity, true);
            window.removeEventListener('mousemove', onActivity, true);
            window.removeEventListener('click', onActivity, true);
        };
    }, []);

    useEffect(() => {
        if (!active) return undefined;
        setNow(new Date());
        const clock = setInterval(() => setNow(new Date()), 15000);
        const slide = setInterval(() => setIdx((i) => i + 1), SLIDE_MS);
        return () => {
            clearInterval(clock);
            clearInterval(slide);
        };
    }, [active]);

    if (!showing || !items || !items.length) return null;

    const item = items[idx % items.length];
    const bg = backdropUrl(item, 1920);
    const locale = t('common.screenSaver.locale');
    const time = now.toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'});
    const date = now.toLocaleDateString(locale, {weekday: 'long', day: 'numeric', month: 'long'});

    return (
        <div className="screensaver">
            {bg && <div className="screensaver-bg" style={{backgroundImage: `url(${bg})`}} key={item.Id}/>}
            <div className="screensaver-clock">
                <div className="screensaver-time">{time}</div>
                <div className="screensaver-date">{date}</div>
            </div>
            {item?.Name && <div className="screensaver-title">{item.Name}</div>}
        </div>
    );
}

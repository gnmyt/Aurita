import "./styles.sass";
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Info, Play} from 'lucide-react';
import {useFocusable, useSpatialFocus} from '@/common/contexts/SpatialNav';
import {backdropUrl, logoUrl} from '@/common/utils/jellyfin';
import {itemMetaLine} from '@/common/utils/media';
import {getPref} from '@/common/utils/prefs';

const HeroButton = ({label, Icon, primary, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className={`btn${primary ? ' primary' : ''}`} {...handlers}>
            {Icon && <Icon size={22} strokeWidth={2.5} fill={primary ? 'currentColor' : 'none'}/>}
            <span>{label}</span>
        </div>
    );
}

export const Spotlight = ({items}) => {
    const navigate = useNavigate();
    const cur = useSpatialFocus();
    const [idx, setIdx] = useState(0);

    const focusedHere = typeof cur === 'string' && cur.startsWith('spot-');

    useEffect(() => {
        if (!items?.length || focusedHere || !getPref('autoplayPreviews')) return;
        const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 9000);
        return () => clearInterval(t);
    }, [items, focusedHere]);

    if (!items?.length) return null;
    const item = items[idx % items.length];
    const bg = backdropUrl(item, 1920);
    const logo = logoUrl(item, 500);

    const meta = itemMetaLine(item);

    const play = () => navigate(item.Type === 'Movie' ? `/play/${item.Id}` : `/detail/${item.Id}`);
    const info = () => navigate(`/detail/${item.Id}`);

    return (
        <div className="spotlight">
            {bg && <div className="spotlight-glow" style={{backgroundImage: `url(${bg})`}} key={`g${item.Id}`}/>}
            <div className="spotlight-card">
                {bg && <div className="spotlight-bg" style={{backgroundImage: `url(${bg})`}} key={item.Id}/>}
                <div className="spotlight-scrim"/>
            </div>
            <div className="spotlight-content">
                {logo
                    ? <img className="spotlight-logo" src={logo} alt={item.Name}/>
                    : <div className="spotlight-title">{item.Name}</div>}
                <div className="spotlight-meta">{meta.map((m) => <span key={m}>{m}</span>)}</div>
                {item.Overview && <div className="spotlight-overview">{item.Overview}</div>}
                <div className="spotlight-actions">
                    <HeroButton primary focusKey="spot-play" Icon={Play}
                                label={item.Type === 'Movie' ? 'Abspielen' : 'Ansehen'} onSelect={play}/>
                    <HeroButton focusKey="spot-info" Icon={Info} label="Mehr Infos" onSelect={info}/>
                </div>
            </div>
            <div className="spotlight-dots">
                {items.map((it, i) => <span key={it.Id} className={i === idx ? 'on' : ''}/>)}
            </div>
        </div>
    );
}

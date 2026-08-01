import "./styles.sass";
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Check, Heart, Info, Play, Plus, X} from 'lucide-react';
import {isBackKey, useFocusable, useKeyTrap, useSpatial} from '@/common/contexts/SpatialNav';
import {removeFromResume, setFavorite, setPlayed} from '@/common/utils/jellyfin';
import {revalidate} from '@/common/utils/cache';
import {toast} from '@/common/utils/toast';
import {CardOptionsContext} from './context';

const Opt = ({icon, label, onSelect, focusKey, danger}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className={`co-opt${danger ? ' danger' : ''}`} {...handlers}>
            <span className="co-opt-ic">{icon}</span>
            <span>{label}</span>
        </div>
    );
}

export const CardOptionsProvider = ({children}) => {
    const navigate = useNavigate();
    const spatial = useSpatial();
    const [item, setItem] = useState(null);
    const [returnId, setReturnId] = useState(null);

    const open = useCallback((it) => {
        setReturnId(spatial.getCurrentId());
        setItem(it);
    }, [spatial]);

    const close = useCallback(() => {
        setItem(null);
        if (returnId) setTimeout(() => spatial.focusId(returnId), 0);
    }, [returnId, spatial]);

    useEffect(() => {
        if (!item) return undefined;
        const t = setTimeout(() => spatial.focusId('co-0'), 0);
        return () => clearTimeout(t);
    }, [item, spatial]);
    useKeyTrap((e) => {
        if (isBackKey(e)) {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    }, !!item);

    const act = (fn, key, msg) => {
        close();
        if (msg) toast(msg);
        Promise.resolve(fn()).catch(() => {
        }).then(() => revalidate(key));
    };
    const go = (path) => {
        close();
        navigate(path);
    };

    let opts = [];
    if (item) {
        const ud = item.UserData || {};
        const inProgress = (ud.PlaybackPositionTicks || 0) > 0 && (item.RunTimeTicks || 0) > 0;
        const isEpisode = item.Type === 'Episode';
        const played = !!ud.Played;
        const fav = !!ud.IsFavorite;

        if (isEpisode || item.Type === 'Movie') {
            opts.push({
                id: 'play',
                icon: <Play size={24}/>,
                label: inProgress ? 'Fortsetzen' : 'Abspielen',
                sel: () => go(`/play/${item.Id}`)
            });
        }
        opts.push({
            id: 'details',
            icon: <Info size={24}/>,
            label: 'Details ansehen',
            sel: () => go(isEpisode && item.SeriesId ? `/detail/${item.SeriesId}` : `/detail/${item.Id}`)
        });
        opts.push({
            id: 'played',
            icon: played ? <Check size={24}/> : <Plus size={24}/>,
            label: played ? 'Als ungesehen markieren' : 'Als gesehen markieren',
            sel: () => act(() => setPlayed(item.Id, !played), 'home', played ? 'Als ungesehen markiert' : 'Als gesehen markiert')
        });
        opts.push({
            id: 'fav',
            icon: <Heart size={24} fill={fav ? 'currentColor' : 'none'}/>,
            label: fav ? 'Aus Merkliste entfernen' : 'Zur Merkliste',
            sel: () => act(() => setFavorite(item.Id, !fav), 'home', fav ? 'Aus Merkliste entfernt' : 'Zur Merkliste hinzugefügt')
        });
        if (inProgress) {
            opts.push({
                id: 'remove',
                icon: <X size={24}/>,
                label: 'Aus „Weiterschauen" entfernen',
                danger: true,
                sel: () => act(() => removeFromResume(item.Id), 'home', 'Aus „Weiterschauen" entfernt')
            });
        }
    }

    const ctx = useMemo(() => ({open}), [open]);
    return (
        <CardOptionsContext.Provider value={ctx}>
            {children}
            {item && (
                <div className="cardopts">
                    <div className="co-panel">
                        <div
                            className="co-title">{item.Type === 'Episode' ? (item.SeriesName || item.Name) : item.Name}</div>
                        {item.Type === 'Episode' && item.IndexNumber != null && (
                            <div className="co-sub">S{item.ParentIndexNumber}:E{item.IndexNumber} · {item.Name}</div>
                        )}
                        <div className="co-list">
                            {opts.map((o, i) => (
                                <Opt key={o.id} icon={o.icon} label={o.label} danger={o.danger}
                                     focusKey={`co-${i}`} onSelect={o.sel}/>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </CardOptionsContext.Provider>
    );
}

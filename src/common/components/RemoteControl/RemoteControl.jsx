import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {connectRemote, onRemote} from '@/common/utils/remote';
import {initSyncPlay, onSync} from '@/common/utils/syncplay';
import {toast} from '@/common/utils/toast';

export const RemoteControl = () => {
    const navigate = useNavigate();

    useEffect(() => {
        connectRemote();
        initSyncPlay();

        const offPlay = onRemote('play', (d) => {
            const id = d.ItemIds?.[d.StartIndex || 0] || d.ItemIds?.[0];
            if (id) navigate(`/play/${id}`);
        });

        const offGen = onRemote('general', (d) => {
            const a = d.Arguments || {};
            switch (d.Name) {
                case 'DisplayMessage':
                    toast(a.Text, {header: a.Header, duration: Number(a.TimeoutMs) || 5000});
                    break;
                case 'DisplayContent':
                    if (a.ItemId) navigate(`/detail/${a.ItemId}`);
                    break;
                case 'GoHome':
                    navigate('/');
                    break;
                case 'GoToSearch':
                    navigate('/search');
                    break;
                case 'GoToSettings':
                    navigate('/settings');
                    break;
                default:
                    break;
            }
        });

        const offQueue = onSync('queue', (q) => {
            const cur = q.Playlist?.[q.PlayingItemIndex] || q.Playlist?.[0];
            if (cur && !window.location.pathname.endsWith(`/play/${cur.ItemId}`)) navigate(`/play/${cur.ItemId}`);
        });

        return () => {
            offPlay();
            offGen();
            offQueue();
        };
    }, [navigate]);

    return null;
}

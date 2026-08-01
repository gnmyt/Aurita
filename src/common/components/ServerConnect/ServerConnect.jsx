import "./styles.sass";
import {useEffect, useRef, useState} from 'react';
import {ArrowRight, Delete, Globe, X} from 'lucide-react';
import AuritaLogo from '@/common/components/AuritaLogo';
import {useAutoFocusFirst, useFocusable} from '@/common/contexts/SpatialNav';
import {addServer} from '@/common/utils/jellyfin';

const KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789.-:/'.split('');

const Key = ({label, Icon, wide, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className={`key${wide ? ' wide' : ''}`} {...handlers}>
            {Icon && <Icon size={20} strokeWidth={2}/>}
            {label && <span>{label}</span>}
        </div>
    );
}

const ConnectButton = ({label, Icon, primary, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className={`btn${primary ? ' primary' : ''}`} {...handlers}>
            {Icon && <Icon size={22} strokeWidth={2.5}/>}
            <span>{label}</span>
        </div>
    );
}

export const ServerConnect = ({onDone, onCancel}) => {
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const urlRef = useRef(url);
    urlRef.current = url;

    useAutoFocusFirst(true);

    useEffect(() => {
        const onKey = (e) => {
            if (/^[a-zA-Z0-9.\-_:/]$/.test(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                setUrl((u) => u + e.key.toLowerCase());
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                e.stopPropagation();
                if (urlRef.current) setUrl((u) => u.slice(0, -1));
                else onCancel?.();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onCancel]);

    const connect = async () => {
        if (!url.trim() || status === 'checking') return;
        setStatus('checking');
        setError('');
        try {
            const server = await addServer(url);
            onDone(server);
        } catch (e) {
            setStatus('idle');
            setError(e.name === 'TimeoutError' || e.name === 'TypeError'
                ? 'Server nicht erreichbar. Prüfe die Adresse, bei Installationen in einem Unterordner den vollständigen Pfad angeben (z. B. jellyfin.example.com/jellyfin).'
                : `Verbindung fehlgeschlagen: ${e.message}`);
        }
    };

    return (
        <div className="wizard server-connect" data-modal>
            <div className="wizard-bg"/>
            <div className="wizard-card connect">
                <div className="connect-left">
                    <div className="wizard-logo"><AuritaLogo size={72}/></div>
                    <h1 className="wizard-title">Mit deinem Server verbinden</h1>
                    <p className="wizard-sub">
                        Gib die Adresse deines Jellyfin-Servers ein,
                        z.&thinsp;B. <strong>jellyfin.example.com</strong>.
                    </p>
                    <div className="search-box connect-input">
                        <Globe size={22} className="connect-input-icon"/>
                        {url
                            ? <span><bdi>{url}</bdi></span>
                            : <span className="ph">jellyfin.example.com</span>}
                        <span className="cursor"/>
                    </div>
                    <div className="connect-status">
                        {status === 'checking' && <><span className="spinner small"/> Verbinde…</>}
                        {error && <span className="status-warn">{error}</span>}
                    </div>
                    <div className="wizard-actions">
                        <ConnectButton
                            primary
                            focusKey="server-connect"
                            Icon={ArrowRight}
                            label={status === 'checking' ? 'Verbinde…' : 'Verbinden'}
                            onSelect={connect}
                        />
                        {onCancel && <ConnectButton label="Abbrechen" onSelect={onCancel}/>}
                    </div>
                </div>
                <div className="connect-right">
                    <div className="kb-grid">
                        {KEYS.map((k, i) => (
                            <Key key={k} label={k} focusKey={i === 0 ? 'server-kb-first' : undefined}
                                 onSelect={() => setUrl((u) => u + k)}/>
                        ))}
                        <Key Icon={Delete} onSelect={() => setUrl((u) => u.slice(0, -1))}/>
                        <Key Icon={X} onSelect={() => setUrl('')}/>
                    </div>
                </div>
            </div>
        </div>
    );
}

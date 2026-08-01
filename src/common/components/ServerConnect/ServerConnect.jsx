import "./styles.sass";
import {useEffect, useRef, useState} from 'react';
import {Trans, useTranslation} from 'react-i18next';
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
    const {t} = useTranslation();
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
                ? t('common.serverConnect.unreachable')
                : t('common.serverConnect.failed', {message: e.message}));
        }
    };

    return (
        <div className="wizard server-connect" data-modal>
            <div className="wizard-bg"/>
            <div className="wizard-card connect">
                <div className="connect-left">
                    <div className="wizard-logo"><AuritaLogo size={72}/></div>
                    <h1 className="wizard-title">{t('common.serverConnect.title')}</h1>
                    <p className="wizard-sub">
                        <Trans i18nKey="common.serverConnect.subtitle" components={{1: <strong/>}}/>
                    </p>
                    <div className="search-box connect-input">
                        <Globe size={22} className="connect-input-icon"/>
                        {url
                            ? <span><bdi>{url}</bdi></span>
                            : <span className="ph">{t('common.serverConnect.placeholder')}</span>}
                        <span className="cursor"/>
                    </div>
                    <div className="connect-status">
                        {status === 'checking' && <><span className="spinner small"/> {t('common.serverConnect.connecting')}</>}
                        {error && <span className="status-warn">{error}</span>}
                    </div>
                    <div className="wizard-actions">
                        <ConnectButton
                            primary
                            focusKey="server-connect"
                            Icon={ArrowRight}
                            label={status === 'checking' ? t('common.serverConnect.connecting') : t('common.serverConnect.connect')}
                            onSelect={connect}
                        />
                        {onCancel && <ConnectButton label={t('common.actions.cancel')} onSelect={onCancel}/>}
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

import "./styles.sass";
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate} from 'react-router-dom';
import {ChevronDown, Search} from 'lucide-react';
import {useFocusable} from '@/common/contexts/SpatialNav';
import AuritaLogo from '@/common/components/AuritaLogo';
import Avatar from '@/common/components/Avatar';
import {getActiveAccount} from '@/common/utils/jellyfin';
import {getPref} from '@/common/utils/prefs';
import {downloadsSupported} from '@/common/utils/downloads';

const NavItem = ({label, icon, active, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className={`tn-item${active ? ' active' : ''}${icon ? ' icon-only' : ''}`} {...handlers}>
            {icon || <span>{label}</span>}
        </div>
    );
}

const ProfileButton = ({account, onSelect}) => {
    const {handlers} = useFocusable({onSelect, focusKey: 'nav-profile'});
    return (
        <div className="tn-profile" {...handlers}>
            <Avatar account={account} size={38} className="tn-avatar"/>
            <ChevronDown size={16} strokeWidth={2.5}/>
        </div>
    );
}

const Clock = () => {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        let interval;
        const timeout = setTimeout(() => {
            setNow(new Date());
            interval = setInterval(() => setNow(new Date()), 60000);
        }, (60 - new Date().getSeconds()) * 1000);
        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, []);
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return <div className="tn-clock">{`${hh}:${mm}`}</div>;
}

export const TopNav = ({views, onOpenProfiles}) => {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;

    const items = [
        {icon: <Search size={23} strokeWidth={2.5}/>, to: '/search', match: '/search'},
        {label: t('common.topNav.home'), to: '/', match: '/'},
        {label: t('common.topNav.shorts'), to: '/shorts', match: '/shorts'},
        ...(views || []).map((v) => ({label: v.Name, to: `/library/${v.Id}`, match: `/library/${v.Id}`})),
        {label: t('common.topNav.syncPlay'), to: '/syncplay', match: '/syncplay'},
        ...(downloadsSupported()
            ? [{label: t('downloads.title'), to: '/downloads', match: '/downloads'}]
            : []),
    ];

    const itemsRef = useRef(null);
    const [overflow, setOverflow] = useState(false);
    useEffect(() => {
        const el = itemsRef.current;
        if (!el) return undefined;
        const check = () => setOverflow(el.scrollWidth > el.clientWidth + 4);
        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => ro.disconnect();
    }, [views]);

    return (
        <div className="topnav">
            <ProfileButton account={getActiveAccount()} onSelect={onOpenProfiles}/>
            <nav className={`tn-items${overflow ? ' scrollable' : ''}`} ref={itemsRef}>
                {items.map((it) => (
                    <NavItem
                        key={it.to}
                        focusKey={`nav-${it.to}`}
                        label={it.label}
                        icon={it.icon}
                        active={it.match === '/' ? path === '/' : path.startsWith(it.match)}
                        onSelect={() => navigate(it.to)}
                    />
                ))}
            </nav>
            <div className="tn-brand">
                {getPref('showClock') && <Clock/>}
                <AuritaLogo size={36}/>
            </div>
        </div>
    );
}

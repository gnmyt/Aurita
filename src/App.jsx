import {useEffect, useRef, useState} from 'react';
import {Route, Routes, useLocation, useNavigate} from 'react-router-dom';
import i18n from '@/i18n';
import {SpatialProvider, useSpatial} from '@/common/contexts/SpatialNav';
import TopNav from '@/common/components/TopNav';
import Home from '@/pages/Home';
import Library from '@/pages/Library';
import Downloads from '@/pages/Downloads';
import Detail from '@/pages/Detail';
import Player from '@/pages/Player';
import Search from '@/pages/Search';
import Browse from '@/pages/Browse';
import Settings from '@/pages/Settings';
import SyncPlay from '@/pages/SyncPlay';
import Shorts from '@/pages/Shorts';
import RemoteControl from '@/common/components/RemoteControl';
import ScreenSaver from '@/common/components/ScreenSaver';
import AuritaLogo from '@/common/components/AuritaLogo';
import SetupWizard from '@/common/components/SetupWizard';
import ProfilePicker from '@/common/components/ProfilePicker';
import {CardOptionsProvider} from '@/common/contexts/CardOptions';
import Toaster from '@/common/components/Toaster';
import PinPad from '@/common/components/PinPad';
import {useCached} from '@/common/utils/cache';
import {
  accountHasPin,
  clearProfilePicked,
  getAccountPin,
  getAccounts,
  getActiveAccount,
  getViews,
  isProfileUnlocked,
  markProfilePicked,
  markProfileUnlocked,
  measureBandwidth,
  refreshActiveAccount,
  restoreSession,
  signOut,
  switchAccount,
  wasProfilePicked,
} from '@/common/utils/jellyfin';

const Shell = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const spatial = useSpatial();
    const {data: views} = useCached('views', () => getViews().then((v) => v || []));
    const [profileView, setProfileView] = useState(null);
    const mainRef = useRef(null);

    useEffect(() => {
        measureBandwidth();
    }, []);

    useEffect(() => {
        mainRef.current?.scrollTo?.(0, 0);
    }, [location.pathname]);

    useEffect(() => {
        const open = () => setProfileView('picker');
        window.addEventListener('aurita:open-profiles', open);
        return () => window.removeEventListener('aurita:open-profiles', open);
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack') {
                if (profileView === 'add') {
                    e.preventDefault();
                    setProfileView('picker');
                    return;
                }
                if (profileView) return;
                const main = mainRef.current;
                if (main && main.scrollTop > 80) {
                    e.preventDefault();
                    main.scrollTo({top: 0, behavior: 'smooth'});
                    spatial.focusFirstContent();
                    return;
                }
                if (location.pathname !== '/') {
                    e.preventDefault();
                    navigate(-1);
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [location.pathname, navigate, spatial, profileView]);

    const immersive = location.pathname.startsWith('/play/');

    const pickProfile = (userId) => {
        if (userId === getActiveAccount()?.userId) {
            closeProfiles();
            return;
        }
        switchAccount(userId);
        markProfilePicked();
        window.location.reload();
    };

    const closeProfiles = () => {
        setProfileView(null);
        setTimeout(() => spatial.focusId('nav-profile'), 0);
    };

    return (
        <div className="app">
            <RemoteControl/>
            <ScreenSaver/>
            {!immersive && <TopNav views={views || []} onOpenProfiles={() => setProfileView('picker')}/>}
            {profileView === 'picker' && (
                <ProfilePicker
                    onPick={pickProfile}
                    onAdd={() => setProfileView('add')}
                    onClose={closeProfiles}
                    onEmpty={() => window.location.reload()}
                    onSettings={() => {
                        setProfileView(null);
                        navigate('/settings');
                    }}
                />
            )}
            {profileView === 'add' && (
                <SetupWizard addMode onComplete={() => window.location.reload()}
                             onCancel={() => setProfileView('picker')}/>
            )}
            <CardOptionsProvider>
                <div className="main" ref={mainRef}>
                    <Routes>
                        <Route path="/" element={<Home/>}/>
                        <Route path="/library/:id" element={<Library/>}/>
                        <Route path="/detail/:id" element={<Detail/>}/>
                        <Route path="/play/:id" element={<Player/>}/>
                        <Route path="/search" element={<Search/>}/>
                        <Route path="/person/:id/:name" element={<Browse mode="person"/>}/>
                        <Route path="/genre/:id/:name" element={<Browse mode="genre"/>}/>
                        <Route path="/settings" element={<Settings/>}/>
                        <Route path="/syncplay" element={<SyncPlay/>}/>
                        <Route path="/downloads" element={<Downloads/>}/>
                        <Route path="/shorts" element={<Shorts/>}/>
                    </Routes>
                </div>
            </CardOptionsProvider>
        </div>
    );
}

const App = () => {
    const [phase, setPhase] = useState('loading');
    const [translationsLoaded, setTranslationsLoaded] = useState(i18n.isInitialized);

    useEffect(() => {
        if (i18n.isInitialized) return undefined;
        const done = () => setTranslationsLoaded(true);
        i18n.on('initialized', done);
        return () => i18n.off('initialized', done);
    }, []);

    useEffect(() => {
        restoreSession().then((ok) => {
            if (!ok) {
                setPhase('welcome');
                return;
            }
            refreshActiveAccount();

            if (getAccounts().length > 1 && !wasProfilePicked()) {
                setPhase('picker');
            } else {
                markProfilePicked();
                const active = getActiveAccount();
                const locked = active && accountHasPin(active.userId) && !isProfileUnlocked(active.userId);
                setPhase(locked ? 'lock' : 'ready');
            }
        }).catch(() => setPhase('welcome'));
    }, []);

    const booting = phase === 'loading' || !translationsLoaded;

    return (
        <SpatialProvider>
            {booting && (
                <div className="loading-screen">
                    <div className="yt-big"><AuritaLogo size={84}/></div>
                    <div className="spinner"/>
                </div>
            )}
            {!booting && phase === 'welcome' && (
                <SetupWizard onComplete={() => {
                    markProfilePicked();
                    window.location.reload();
                }}/>
            )}
            {!booting && phase === 'picker' && (
                <ProfilePicker
                    onPick={(id) => {
                        markProfilePicked();
                        if (id === getActiveAccount()?.userId) {
                            setPhase('ready');
                            return;
                        }
                        switchAccount(id);
                        window.location.reload();
                    }}
                    onAdd={() => setPhase('add')}
                    onEmpty={() => setPhase('welcome')}
                />
            )}
            {!booting && phase === 'add' && (
                <SetupWizard addMode onComplete={() => window.location.reload()} onCancel={() => setPhase('picker')}/>
            )}
            {!booting && phase === 'lock' && (() => {
                const active = getActiveAccount();
                return (
                    <PinPad
                        mode="verify"
                        eyebrow={active?.name}
                        expected={getAccountPin(active?.userId)}
                        onSuccess={() => {
                            markProfileUnlocked(active.userId);
                            setPhase('ready');
                        }}
                        onForgot={() => {
                            signOut();
                            clearProfilePicked();
                            window.location.reload();
                        }}
                    />
                );
            })()}
            {!booting && phase === 'ready' && <Shell/>}
            <Toaster/>
        </SpatialProvider>
    );
}

export default App;

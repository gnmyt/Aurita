import "./styles.sass";
import {useState} from 'react';
import {FastForward, Gauge, Images, Lock, LogOut, SkipForward, Square, Subtitles} from 'lucide-react';
import {useAutoFocusFirst} from '@/common/contexts/SpatialNav';
import {
    accountHasPin,
    clearAccountPin,
    clearProfilePicked,
    getAccountPin,
    getActiveAccount,
    QUALITY_LEVELS,
    setAccountPin,
    signOut,
} from '@/common/utils/jellyfin';
import {
    getPref,
    getQuality,
    getSubBg,
    getSubSize,
    setPref,
    setQuality as saveQuality,
    setSubBg,
    setSubSize,
    SUB_SIZES
} from '@/common/utils/prefs';
import Avatar from '@/common/components/Avatar';
import SettingRow from '@/common/components/SettingRow';
import PinPad from '@/common/components/PinPad';
import ConfirmDialog from '@/common/components/ConfirmDialog';
import {toast} from '@/common/utils/toast';
import {BRAND} from '@/common/utils/brand';

export const Settings = () => {
    const account = getActiveAccount();
    const [subSize, setSubSizeState] = useState(getSubSize());
    const [subBg, setSubBgState] = useState(getSubBg());
    const [quality, setQuality] = useState(getQuality);
    const [prefs, setPrefs] = useState(() => ({
        autoplayNext: getPref('autoplayNext'),
        autoSkipSegments: getPref('autoSkipSegments'),
        autoplayPreviews: getPref('autoplayPreviews'),
    }));

    const togglePref = (key) => {
        const next = !prefs[key];
        setPref(key, next);
        setPrefs((p) => ({...p, [key]: next}));
    };

    const [pinFlow, setPinFlow] = useState(null);
    const [hasPin, setHasPin] = useState(() => accountHasPin(account?.userId));
    const [confirmSignOut, setConfirmSignOut] = useState(false);

    useAutoFocusFirst(true);

    const openProfiles = () => window.dispatchEvent(new CustomEvent('aurita:open-profiles'));
    const doSignOut = () => {
        signOut();
        clearProfilePicked();
        window.location.reload();
    };

    const cycleSubSize = () => {
        const i = SUB_SIZES.findIndex((s) => s.key === subSize);
        const next = SUB_SIZES[(i + 1) % SUB_SIZES.length].key;
        setSubSize(next);
        setSubSizeState(next);
    };
    const toggleSubBg = () => {
        const next = !subBg;
        setSubBg(next);
        setSubBgState(next);
    };
    const cycleQuality = () => {
        const i = QUALITY_LEVELS.findIndex((q) => q.key === quality);
        const next = QUALITY_LEVELS[(i + 1) % QUALITY_LEVELS.length].key;
        saveQuality(next);
        setQuality(next);
    };

    const subSizeLabel = SUB_SIZES.find((s) => s.key === subSize)?.label || 'Normal';
    const qualityLabel = QUALITY_LEVELS.find((q) => q.key === quality)?.label || 'Automatisch';

    return (
        <div className="settings">
            {pinFlow === 'create' && (
                <PinPad
                    mode="create"
                    eyebrow={account?.name}
                    onComplete={(pin) => {
                        setAccountPin(account.userId, pin);
                        setHasPin(true);
                        setPinFlow(null);
                        toast('Profilsperre aktiviert');
                    }}
                    onCancel={() => setPinFlow(null)}
                />
            )}
            {pinFlow === 'remove' && (
                <PinPad
                    mode="verify"
                    eyebrow={account?.name}
                    expected={getAccountPin(account?.userId)}
                    onSuccess={() => {
                        clearAccountPin(account.userId);
                        setHasPin(false);
                        setPinFlow(null);
                        toast('Profilsperre deaktiviert');
                    }}
                    onCancel={() => setPinFlow(null)}
                />
            )}
            {confirmSignOut && (
                <ConfirmDialog
                    title="Abmelden?"
                    message={`„${account?.name || 'Dieses Profil'}" wird von diesem Gerät abgemeldet.`}
                    confirmLabel="Abmelden"
                    danger
                    onConfirm={doSignOut}
                    onCancel={() => setConfirmSignOut(false)}
                />
            )}
            <h1 className="settings-head">Profil und Einstellungen</h1>

            <div className="settings-card">
                <SettingRow
                    leading={<Avatar account={account} size={48}/>}
                    title={account?.name || 'Profil'}
                    subtitle="Profil wechseln oder hinzufügen"
                    chevron
                    focusKey="settings-first"
                    onSelect={openProfiles}
                />
                <SettingRow
                    icon={<Lock size={26}/>}
                    title="Profilsperre"
                    subtitle="PIN für den Zugriff auf dieses Profil"
                    value={hasPin ? 'An' : 'Aus'}
                    onSelect={() => setPinFlow(hasPin ? 'remove' : 'create')}
                />
                <SettingRow
                    icon={<LogOut size={26}/>}
                    title="Abmelden"
                    subtitle="Dieses Profil von diesem Gerät abmelden"
                    chevron
                    danger
                    onSelect={() => setConfirmSignOut(true)}
                />
            </div>

            <div className="settings-section">Wiedergabe</div>
            <div className="settings-card">
                <SettingRow
                    icon={<SkipForward size={26}/>}
                    title="Nächste Folge automatisch abspielen"
                    subtitle="Am Ende automatisch zur nächsten Folge wechseln"
                    value={prefs.autoplayNext ? 'An' : 'Aus'}
                    onSelect={() => togglePref('autoplayNext')}
                />
                <SettingRow
                    icon={<FastForward size={26}/>}
                    title="Intro & Abspann automatisch überspringen"
                    subtitle="Markierte Abschnitte ohne Tastendruck überspringen"
                    value={prefs.autoSkipSegments ? 'An' : 'Aus'}
                    onSelect={() => togglePref('autoSkipSegments')}
                />
                <SettingRow
                    icon={<Images size={26}/>}
                    title="Vorschau automatisch abspielen"
                    subtitle="Empfehlungen auf der Startseite automatisch durchblättern"
                    value={prefs.autoplayPreviews ? 'An' : 'Aus'}
                    onSelect={() => togglePref('autoplayPreviews')}
                />
                <SettingRow
                    icon={<Gauge size={26}/>}
                    title="Standard-Wiedergabequalität"
                    subtitle="Qualität, mit der die Wiedergabe startet"
                    value={qualityLabel}
                    onSelect={cycleQuality}
                />
            </div>

            <div className="settings-section">Untertitel</div>
            <div className="settings-card">
                <SettingRow
                    icon={<Subtitles size={26}/>}
                    title="Untertitelgröße"
                    subtitle="Größe der Untertitel anpassen"
                    value={subSizeLabel}
                    onSelect={cycleSubSize}
                />
                <SettingRow
                    icon={<Square size={26}/>}
                    title="Untertitel-Hintergrund"
                    subtitle="Abgedunkelten Balken hinter Untertiteln anzeigen"
                    value={subBg ? 'An' : 'Aus'}
                    onSelect={toggleSubBg}
                />
            </div>

            <div className="settings-foot">{BRAND} · Oberfläche für Jellyfin</div>
        </div>
    );
}

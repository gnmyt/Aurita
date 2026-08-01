import "./styles.sass";
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
    Clock,
    Eye,
    Gauge,
    Images,
    Languages,
    Lock,
    LogOut,
    MonitorPlay,
    Rewind,
    SkipForward,
    Square,
    Tv,
    Subtitles
} from 'lucide-react';
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
    getChoice,
    getPref,
    getQuality,
    getSubBg,
    getSubSize,
    setChoice,
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
import LanguagePicker from '@/common/components/LanguagePicker';
import {toast} from '@/common/utils/toast';
import {BRAND} from '@/common/utils/brand';
import i18n, {languages} from '@/i18n';

export const Settings = () => {
    const {t} = useTranslation();
    const account = getActiveAccount();
    const [subSize, setSubSizeState] = useState(getSubSize());
    const [subBg, setSubBgState] = useState(getSubBg());
    const [quality, setQuality] = useState(getQuality);
    const [prefs, setPrefs] = useState(() => ({
        autoplayNext: getPref('autoplayNext'),
        autoplayPreviews: getPref('autoplayPreviews'),
        screensaver: getPref('screensaver'),
        showClock: getPref('showClock'),
    }));
    const [choices, setChoices] = useState(() => ({
        matchFrameRate: getChoice('matchFrameRate'),
        stillWatching: getChoice('stillWatching'),
        resumePreroll: getChoice('resumePreroll'),
        segmentIntro: getChoice('segmentIntro'),
        segmentOutro: getChoice('segmentOutro'),
    }));

    const cycleChoice = (key, values) => {
        const i = values.indexOf(choices[key]);
        const next = values[(i + 1) % values.length];
        setChoice(key, next);
        setChoices((c) => ({...c, [key]: next}));
    };

    const togglePref = (key) => {
        const next = !prefs[key];
        setPref(key, next);
        setPrefs((p) => ({...p, [key]: next}));
    };

    const [pinFlow, setPinFlow] = useState(null);
    const [hasPin, setHasPin] = useState(() => accountHasPin(account?.userId));
    const [confirmSignOut, setConfirmSignOut] = useState(false);
    const [langPicker, setLangPicker] = useState(false);

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

    const subSizeKey = SUB_SIZES.find((s) => s.key === subSize)?.labelKey || 'media.subtitleSize.normal';
    const qualityKey = QUALITY_LEVELS.find((q) => q.key === quality)?.labelKey || 'media.quality.auto';
    const onOff = (on) => (on ? t('settings.on') : t('settings.off'));
    const activeLanguage = languages.find((l) => l.code === i18n.resolvedLanguage);

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
                        toast(t('settings.toast.pinEnabled'));
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
                        toast(t('settings.toast.pinDisabled'));
                    }}
                    onCancel={() => setPinFlow(null)}
                />
            )}
            {confirmSignOut && (
                <ConfirmDialog
                    title={t('settings.signOutTitle')}
                    message={t('settings.signOutMessage', {name: account?.name || t('settings.thisProfile')})}
                    confirmLabel={t('common.actions.signOut')}
                    danger
                    onConfirm={doSignOut}
                    onCancel={() => setConfirmSignOut(false)}
                />
            )}
            {langPicker && <LanguagePicker onClose={() => setLangPicker(false)}/>}
            <h1 className="settings-head">{t('settings.title')}</h1>

            <div className="settings-card">
                <SettingRow
                    leading={<Avatar account={account} size={48}/>}
                    title={account?.name || t('settings.profileFallback')}
                    subtitle={t('settings.switchProfile')}
                    chevron
                    focusKey="settings-first"
                    onSelect={openProfiles}
                />
                <SettingRow
                    icon={<Lock size={26}/>}
                    title={t('settings.profileLock')}
                    subtitle={t('settings.profileLockSub')}
                    value={onOff(hasPin)}
                    onSelect={() => setPinFlow(hasPin ? 'remove' : 'create')}
                />
                <SettingRow
                    icon={<LogOut size={26}/>}
                    title={t('settings.signOut')}
                    subtitle={t('settings.signOutSub')}
                    chevron
                    danger
                    onSelect={() => setConfirmSignOut(true)}
                />
            </div>

            <div className="settings-section">{t('settings.languageSection')}</div>
            <div className="settings-card">
                <SettingRow
                    icon={<Languages size={26}/>}
                    title={t('settings.appLanguage')}
                    subtitle={t('settings.appLanguageSub')}
                    value={activeLanguage?.name}
                    chevron
                    onSelect={() => setLangPicker(true)}
                />
            </div>

            <div className="settings-section">{t('settings.playback')}</div>
            <div className="settings-card">
                <SettingRow
                    icon={<SkipForward size={26}/>}
                    title={t('settings.autoplayNext')}
                    subtitle={t('settings.autoplayNextSub')}
                    value={onOff(prefs.autoplayNext)}
                    onSelect={() => togglePref('autoplayNext')}
                />
                <SettingRow
                    icon={<Images size={26}/>}
                    title={t('settings.autoplayPreviews')}
                    subtitle={t('settings.autoplayPreviewsSub')}
                    value={onOff(prefs.autoplayPreviews)}
                    onSelect={() => togglePref('autoplayPreviews')}
                />
                <SettingRow
                    icon={<Tv size={26}/>}
                    title={t('settings.matchFrameRate')}
                    subtitle={t('settings.matchFrameRateSub')}
                    value={onOff(choices.matchFrameRate === 'on')}
                    onSelect={() => cycleChoice('matchFrameRate', ['on', 'off'])}
                />
                <SettingRow
                    icon={<Rewind size={26}/>}
                    title={t('settings.resumePreroll')}
                    subtitle={t('settings.resumePrerollSub')}
                    value={choices.resumePreroll === '0' ? t('settings.off') : `${choices.resumePreroll}s`}
                    onSelect={() => cycleChoice('resumePreroll', ['0', '5', '10', '15'])}
                />
                <SettingRow
                    icon={<Eye size={26}/>}
                    title={t('settings.stillWatching')}
                    subtitle={t('settings.stillWatchingSub')}
                    value={choices.stillWatching === '0' ? t('settings.off') : choices.stillWatching}
                    onSelect={() => cycleChoice('stillWatching', ['0', '2', '3', '4', '5'])}
                />
                <SettingRow
                    icon={<SkipForward size={26}/>}
                    title={t('settings.segmentIntro')}
                    subtitle={t('settings.segmentActionSub')}
                    value={t(`settings.segment.${choices.segmentIntro}`)}
                    onSelect={() => cycleChoice('segmentIntro', ['skip', 'ask', 'none'])}
                />
                <SettingRow
                    icon={<SkipForward size={26}/>}
                    title={t('settings.segmentOutro')}
                    subtitle={t('settings.segmentActionSub')}
                    value={t(`settings.segment.${choices.segmentOutro}`)}
                    onSelect={() => cycleChoice('segmentOutro', ['skip', 'ask', 'none'])}
                />
                <SettingRow
                    icon={<MonitorPlay size={26}/>}
                    title={t('settings.screensaver')}
                    subtitle={t('settings.screensaverSub')}
                    value={onOff(prefs.screensaver)}
                    onSelect={() => togglePref('screensaver')}
                />
                <SettingRow
                    icon={<Clock size={26}/>}
                    title={t('settings.showClock')}
                    subtitle={t('settings.showClockSub')}
                    value={onOff(prefs.showClock)}
                    onSelect={() => togglePref('showClock')}
                />
                <SettingRow
                    icon={<Gauge size={26}/>}
                    title={t('settings.defaultQuality')}
                    subtitle={t('settings.defaultQualitySub')}
                    value={t(qualityKey)}
                    onSelect={cycleQuality}
                />
            </div>

            <div className="settings-section">{t('settings.subtitles')}</div>
            <div className="settings-card">
                <SettingRow
                    icon={<Subtitles size={26}/>}
                    title={t('settings.subtitleSize')}
                    subtitle={t('settings.subtitleSizeSub')}
                    value={t(subSizeKey)}
                    onSelect={cycleSubSize}
                />
                <SettingRow
                    icon={<Square size={26}/>}
                    title={t('settings.subtitleBackground')}
                    subtitle={t('settings.subtitleBackgroundSub')}
                    value={onOff(subBg)}
                    onSelect={toggleSubBg}
                />
            </div>

            <div className="settings-foot">{t('settings.footer', {brand: BRAND})}</div>
        </div>
    );
}

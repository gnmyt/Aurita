import "./styles.sass";
import {useCallback, useEffect, useRef, useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {ArrowRight, Check, ChevronRight, Plus, RefreshCw, Server, Smartphone} from 'lucide-react';
import AuritaLogo from '@/common/components/AuritaLogo';
import {BRAND} from '@/common/utils/brand';
import {useAutoFocusFirst, useFocusable} from '@/common/contexts/SpatialNav';
import ServerConnect from '@/common/components/ServerConnect';
import {
  authenticateWithQuickConnect,
  getActiveAccount,
  getServers,
  isServerPinned,
  quickConnectEnabled,
  quickConnectInitiate,
  quickConnectPoll,
} from '@/common/utils/jellyfin';

const WizardButton = ({label, Icon, primary, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className={`btn${primary ? ' primary' : ''}`} {...handlers}>
            {Icon && <Icon size={22} strokeWidth={2.5}/>}
            <span>{label}</span>
        </div>
    );
}

const ServerChoice = ({server, current, add, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className={`server-choice${add ? ' add' : ''}`} {...handlers}>
            <div className="server-choice-icon">
                {add ? <Plus size={26} strokeWidth={2.2}/> : <Server size={26} strokeWidth={1.8}/>}
            </div>
            <div className="server-choice-text">
        <span className="server-choice-name">
          {add ? 'Neuen Server hinzufügen' : (server.name || server.url.replace(/^https?:\/\//, ''))}
        </span>
                {!add && <span className="server-choice-url">{server.url.replace(/^https?:\/\//, '')}</span>}
            </div>
            {current && <span className="server-choice-badge">Aktueller Server</span>}
        </div>
    );
}

const prettyCode = (code) => {
    if (!code) return '';
    return code.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export const SetupWizard = ({onComplete, addMode = false, onCancel}) => {
    const servers = getServers();
    const currentServerId = getActiveAccount()?.serverId;
    const [server, setServer] = useState(() => {
        if (isServerPinned()) return servers[0];
        if (!addMode && servers.length === 1) return servers[0];
        return null;
    });
    const [step, setStep] = useState(() => {
        if (isServerPinned()) return addMode ? 'pairing' : 'welcome';
        if (servers.length === 0) return 'connect';
        if (addMode || servers.length > 1) return 'choose';
        return 'welcome';
    });
    const [enabled, setEnabled] = useState(null);
    const [pairing, setPairing] = useState(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const pollRef = useRef(null);
    const autoStartedRef = useRef(false);

    useEffect(() => {
        if (step === 'welcome' && server) quickConnectEnabled(server).then(setEnabled);
    }, [step, server]);

    const stopPolling = () => {
        clearInterval(pollRef.current);
        pollRef.current = null;
    };

    const startPairing = useCallback(async (target) => {
        autoStartedRef.current = true;
        stopPolling();
        setStep('pairing');
        setStatus('waiting');
        setError('');
        setPairing(null);
        try {
            const result = await quickConnectInitiate(target);
            setPairing(result);
            pollRef.current = setInterval(async () => {
                try {
                    const state = await quickConnectPoll(target, result.Secret);
                    if (state === null) {
                        setStatus('expired');
                        stopPolling();
                        return;
                    }
                    if (state.Authenticated) {
                        stopPolling();
                        setStatus('authorizing');
                        await authenticateWithQuickConnect(target, result.Secret);
                        onComplete();
                    }
                } catch (e) {
                    setStatus('error');
                    setError(e.message);
                    stopPolling();
                }
            }, 2500);
        } catch (e) {
            setStatus('error');
            setError(e.message);
        }
    }, [onComplete]);

    useEffect(() => stopPolling, []);

    useEffect(() => {
        if (step === 'pairing' && server && !autoStartedRef.current) {
            autoStartedRef.current = true;
            startPairing(server);
        }
    }, [step, server, startPairing]);

    useAutoFocusFirst(step === 'choose' || step === 'pairing' || enabled !== null);

    const pickServer = (s) => {
        setServer(s);
        if (addMode) startPairing(s);
        else setStep('welcome');
    };

    if (step === 'connect') {
        return (
            <ServerConnect
                onDone={pickServer}
                onCancel={servers.length ? () => setStep('choose') : (addMode ? onCancel : undefined)}
            />
        );
    }

    if (step === 'choose') {
        const sorted = [...servers].sort((a, b) =>
            (a.id === currentServerId ? -1 : 0) - (b.id === currentServerId ? -1 : 0));
        return (
            <div className="wizard" data-modal>
                <div className="wizard-bg"/>
                <div className="wizard-card choose">
                    <h1 className="wizard-title">Auf welchem Server?</h1>
                    <p className="wizard-sub">
                        Wähle den Server, auf dem sich das neue Profil anmelden soll.
                    </p>
                    <div className="wizard-servers">
                        {sorted.map((s, i) => (
                            <ServerChoice
                                key={s.id}
                                server={s}
                                current={s.id === currentServerId}
                                focusKey={`wizard-server-${i}`}
                                onSelect={() => pickServer(s)}
                            />
                        ))}
                        <ServerChoice add focusKey="wizard-server-add" onSelect={() => setStep('connect')}/>
                    </div>
                    {addMode && (
                        <div className="wizard-actions">
                            <WizardButton label="Abbrechen" onSelect={onCancel}/>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const serverHost = (server?.url || '').replace(/^https?:\/\//, '');
    const qrTarget = `${server?.url}/web/#/quickconnect`;

    return (
        <div className="wizard" data-modal>
            <div className="wizard-bg"/>
            {step === 'welcome' && (
                <div className="wizard-card welcome">
                    <div className="wizard-logo"><AuritaLogo size={96}/></div>
                    <h1 className="wizard-title">Willkommen bei {BRAND}</h1>
                    <p className="wizard-sub">
                        Melde dich mit deinem Jellyfin-Konto an, um Filme und Serien
                        auf dem großen Bildschirm zu genießen.
                    </p>
                    {enabled === false ? (
                        <div className="wizard-error">
                            Schnellverbindung ist auf {serverHost} nicht aktiviert.
                            Bitte aktiviere sie in den Server-Einstellungen.
                        </div>
                    ) : (
                        <div className="wizard-actions">
                            <WizardButton
                                primary
                                focusKey="wizard-start"
                                Icon={ArrowRight}
                                label={enabled === null ? 'Verbinde…' : 'Anmelden'}
                                onSelect={() => {
                                    if (enabled) startPairing(server);
                                }}
                            />
                        </div>
                    )}
                    <div className="wizard-server">{serverHost}</div>
                </div>
            )}

            {step === 'pairing' && (
                <div className="wizard-card pairing">
                    <div className="pairing-left">
                        <h1 className="wizard-title">Auf dem Handy anmelden</h1>
                        <ol className="wizard-steps">
                            <li>Öffne <strong>{serverHost}</strong> auf deinem Handy oder Computer und melde dich an.
                            </li>
                            <li>Gehe zu <strong>Benutzer&shy;einstellungen <ChevronRight className="bc-arrow"
                                                                                         size={15}/> Schnellverbindung</strong>.
                            </li>
                            <li>Gib den folgenden Code ein:</li>
                        </ol>
                        <div className="pairing-code">{pairing ? prettyCode(pairing.Code) : '— — —'}</div>
                        <div className="pairing-status">
                            {status === 'waiting' && <><span className="spinner small"/> Warte auf Bestätigung…</>}
                            {status === 'authorizing' && <><Check size={20}/> Angemeldet! Lade…</>}
                            {status === 'expired' &&
                                <span className="status-warn">Code abgelaufen. Bitte neuen Code anfordern.</span>}
                            {status === 'error' && <span className="status-warn">{error}</span>}
                        </div>
                        <div className="wizard-actions">
                            <WizardButton
                                primary={status === 'expired' || status === 'error'}
                                focusKey="wizard-refresh"
                                Icon={RefreshCw}
                                label="Neuer Code"
                                onSelect={() => startPairing(server)}
                            />
                            <WizardButton
                                label="Zurück"
                                onSelect={() => {
                                    stopPolling();
                                    autoStartedRef.current = false;
                                    if (isServerPinned()) {
                                        if (addMode) onCancel?.(); else setStep('welcome');
                                    } else if (addMode) setStep('choose');
                                    else setStep(getServers().length > 1 ? 'choose' : 'welcome');
                                }}
                            />
                        </div>
                    </div>
                    <div className="pairing-right">
                        <div className="qr-wrap">
                            <QRCodeSVG value={qrTarget} size={208} bgColor="#ffffff" fgColor="#0f0f0f" level="M"
                                       includeMargin/>
                        </div>
                        <div className="qr-hint"><Smartphone size={16}/> Scannen, um die Seite zu öffnen</div>
                    </div>
                </div>
            )}
        </div>
    );
}

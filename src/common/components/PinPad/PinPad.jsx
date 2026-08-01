import "./styles.sass";
import {useCallback, useEffect, useRef, useState} from 'react';
import Dpad from '@/common/components/Dpad';

const DIR = {ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R'};
const LEN = 4;

export const PinPad = ({mode = 'verify', expected, eyebrow, onComplete, onSuccess, onCancel, onForgot}) => {
    const [step, setStep] = useState(mode === 'create' ? 'enter' : 'verify');
    const [first, setFirst] = useState('');
    const [entry, setEntry] = useState('');
    const [flash, setFlash] = useState(null);
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);
    const flashTimer = useRef(null);
    const okTimer = useRef(null);
    const shakeTimer = useRef(null);

    const fail = (msg) => {
        setError(msg);
        setEntry('');
        setShake(true);
        clearTimeout(shakeTimer.current);
        shakeTimer.current = setTimeout(() => setShake(false), 480);
    };

    const submit = useCallback((seq) => {
        if (mode === 'create') {
            if (step === 'enter') {
                setFirst(seq);
                setEntry('');
                setError('');
                setStep('confirm');
                return;
            }
            if (seq === first) onComplete?.(seq);
            else {
                setStep('enter');
                setFirst('');
                fail('PINs stimmen nicht überein. Erneut versuchen.');
            }
        } else if (seq === expected) {
            onSuccess?.();
        } else {
            fail('Falsche PIN. Bitte erneut versuchen.');
        }
    }, [mode, step, first, expected, onComplete, onSuccess]);

    useEffect(() => {
        const onKey = (e) => {
            if (DIR[e.key]) {
                e.preventDefault();
                e.stopPropagation();
                setFlash(e.key);
                clearTimeout(flashTimer.current);
                flashTimer.current = setTimeout(() => setFlash(null), 240);
                setError('');
                setEntry((cur) => (cur.length >= LEN ? cur : cur + DIR[e.key]));
            } else if (e.key === 'Backspace' || e.key === 'GoBack') {
                e.preventDefault();
                e.stopPropagation();
                setEntry((cur) => {
                    if (cur.length > 0) return cur.slice(0, -1);
                    onCancel?.();
                    return cur;
                });
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancel?.();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                if (e.key === 'Enter' && onForgot && !e.repeat) {
                    clearTimeout(okTimer.current);
                    okTimer.current = setTimeout(() => onForgot(), 1000);
                }
            }
        };
        const onKeyUp = (e) => {
            if (e.key === 'Enter') clearTimeout(okTimer.current);
        };
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('keyup', onKeyUp, true);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('keyup', onKeyUp, true);
            clearTimeout(flashTimer.current);
            clearTimeout(okTimer.current);
            clearTimeout(shakeTimer.current);
        };
    }, [onCancel, onForgot]);

    useEffect(() => {
        if (entry.length !== LEN) return undefined;
        const t = setTimeout(() => submit(entry), 200);
        return () => clearTimeout(t);
    }, [entry, submit]);

    const titles = {
        enter: 'Wähle eine PIN',
        confirm: 'PIN bestätigen',
        verify: 'PIN eingeben',
    };
    const subs = {
        enter: 'Gib mit den Pfeiltasten eine Folge aus 4 Richtungen ein.',
        confirm: 'Gib dieselbe Richtungs-Folge noch einmal ein.',
        verify: 'Dieses Profil ist gesperrt.',
    };

    return (
        <div className="pin-screen">
            <div className={`pinpad${shake ? ' shake' : ''}`}>
                <div className="pin-dpad"><Dpad flash={flash}/></div>
                <div className="pin-info">
                    {eyebrow && <div className="pin-eyebrow">{eyebrow}</div>}
                    <h1 className="pin-title">{titles[step]}</h1>
                    <div className="pin-sub">{subs[step]}</div>
                    <div className="pin-boxes">
                        {Array.from({length: LEN}).map((_, i) => {
                            const filled = i < entry.length;
                            const active = i === entry.length;
                            return (
                                <div key={i} className={`pin-box${filled ? ' filled' : ''}${active ? ' active' : ''}`}>
                                    {filled ? <span className="pin-dot"/> : (active && <span className="pin-caret"/>)}
                                </div>
                            );
                        })}
                    </div>
                    <div className={`pin-error${error ? ' show' : ''}`}>{error || ' '}</div>
                    {onForgot &&
                        <div className="pin-forgot">PIN vergessen? <b>OK</b> gedrückt halten zum Abmelden.</div>}
                </div>
            </div>
        </div>
    );
}

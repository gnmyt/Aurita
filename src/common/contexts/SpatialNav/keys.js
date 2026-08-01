import {useEffect, useRef} from 'react';

export const BACK_KEYS = ['Escape', 'Backspace', 'GoBack'];
export const OK_KEYS = ['Enter', ' '];
export const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
export const isBackKey = (e) => BACK_KEYS.includes(e.key);
export const isOkKey = (e) => OK_KEYS.includes(e.key);

export const useKeyTrap = (handler, enabled = true) => {
    const ref = useRef(handler);
    ref.current = handler;
    useEffect(() => {
        if (!enabled) return undefined;
        const onKey = (e) => ref.current(e);
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [enabled]);
}

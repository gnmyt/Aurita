import {useCallback, useEffect, useMemo, useRef} from 'react';
import {markPointerMove, SpatialContext} from './context';

const MODAL_SELECTOR = '.picker, .cardopts, [data-modal]';

const ROW_TOP_OFFSET = 88;
let lastScrollAt = 0;

const scrollFocus = (el) => {
    if (!el) return;
    const now = Date.now();
    const behavior = (now - lastScrollAt < 280) ? 'auto' : 'smooth';
    lastScrollAt = now;

    if (el.closest(MODAL_SELECTOR)) {
        el.scrollIntoView({behavior, block: 'nearest'});
        return;
    }

    const main = el.closest('.main') || document.querySelector('.main');

    const strip = el.closest('.row-track');
    if (strip) {
        const er = el.getBoundingClientRect();
        const sr = strip.getBoundingClientRect();
        const target = strip.scrollLeft + (er.left - sr.left) - (sr.width / 2 - er.width / 2);
        strip.scrollTo({left: Math.max(0, target), behavior});
    }

    const navStrip = el.closest('.tn-items');
    if (navStrip) {
        const er = el.getBoundingClientRect();
        const sr = navStrip.getBoundingClientRect();
        const target = navStrip.scrollLeft + (er.left - sr.left) - (sr.width / 2 - er.width / 2);
        navStrip.scrollTo({left: Math.max(0, target), behavior});
        return;
    }

    if (!main) {
        el.scrollIntoView({behavior, block: 'nearest', inline: 'center'});
        return;
    }

    if (el.closest('.spotlight')) {
        main.scrollTo({top: 0, behavior});
        return;
    }
    const row = el.closest('.row');
    if (row) {
        const mr = main.getBoundingClientRect();
        const rr = row.getBoundingClientRect();
        const target = main.scrollTop + (rr.top - mr.top) - ROW_TOP_OFFSET;
        main.scrollTo({top: Math.max(0, target), behavior});
        return;
    }
    const mr = main.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.top < mr.top + ROW_TOP_OFFSET || er.bottom > mr.bottom - 40) {
        const target = main.scrollTop + (er.top - mr.top) - (main.clientHeight / 2 - er.height / 2);
        main.scrollTo({top: Math.max(0, target), behavior});
    }
}

const rectCenter = (r) => ({x: r.left + r.width / 2, y: r.top + r.height / 2});

const directionInfo = (dir, cr, cc, r) => {
    const c = rectCenter(r);
    const dx = c.x - cc.x;
    const dy = c.y - cc.y;
    switch (dir) {
        case 'left':
            return {inDir: r.right <= cr.left + 1, primary: -dx, cross: Math.abs(dy)};
        case 'right':
            return {inDir: r.left >= cr.right - 1, primary: dx, cross: Math.abs(dy)};
        case 'up':
            return {inDir: r.bottom <= cr.top + 1, primary: -dy, cross: Math.abs(dx)};
        default:
            return {inDir: r.top >= cr.bottom - 1, primary: dy, cross: Math.abs(dx)};
    }
}

const candidateScore = (dir, entry, {cr, cc, curInNav, curInModal, vertical}) => {
    if (!entry.el) return null;
    const r = entry.el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    if (curInModal && !entry.el.closest(MODAL_SELECTOR)) return null;
    const candInNav = !!entry.el.closest('.topnav');
    if (curInNav && (vertical ? candInNav : !candInNav)) return null;
    const {inDir, primary, cross} = directionInfo(dir, cr, cc, r);
    if (!inDir || primary <= 0) return null;
    const overlap = vertical
        ? Math.min(cr.right, r.right) - Math.max(cr.left, r.left)
        : Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top);
    let score = primary + cross * 3;
    if (overlap <= 0) score += 1e5;
    if (dir === 'up' && candInNav) score += 1e6;
    return score;
}

const leftmostInTrack = (entries, track) => {
    let bestId = null;
    let bestLeft = Infinity;
    for (const [id, entry] of entries) {
        if (!entry.el || !track.contains(entry.el)) continue;
        if (entry.el.offsetLeft < bestLeft) {
            bestLeft = entry.el.offsetLeft;
            bestId = id;
        }
    }
    return bestId;
}

export const SpatialProvider = ({children}) => {
    const registry = useRef(new Map());
    const currentId = useRef(null);
    const lpRef = useRef(null);
    const lpTimer = useRef(null);
    const lastFocus = useRef(new Map());
    const listeners = useRef(new Set());

    const subscribe = useCallback((fn) => {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
    }, []);
    const notify = (id) => {
        listeners.current.forEach((fn) => fn(id));
    };

    const register = useCallback((id, data) => {
        registry.current.set(id, data);
    }, []);

    const unregister = useCallback((id) => {
        registry.current.delete(id);
        if (currentId.current === id) {
            currentId.current = null;
        }
    }, []);

    const focusId = useCallback((id, {scroll = true} = {}) => {
        const entry = registry.current.get(id);
        if (!entry) return;
        const prev = currentId.current;
        currentId.current = id;
        if (entry.restoreKey != null) lastFocus.current.set(window.location.pathname, entry.restoreKey);
        if (scroll && entry.el) {
            scrollFocus(entry.el);
        }
        entry.onFocus?.();
        if (prev !== id) notify(id);
    }, []);

    const getCurrentId = useCallback(() => currentId.current, []);

    const focusFirstContent = useCallback(() => {
        const modals = document.querySelectorAll(MODAL_SELECTOR);
        const modal = modals.length ? modals[modals.length - 1] : null;
        for (const [id, entry] of registry.current) {
            if (id.startsWith('nav-')) continue;
            if (!entry.el) continue;
            if (modal && !modal.contains(entry.el)) continue;
            focusId(id);
            return true;
        }
        return false;
    }, [focusId]);

    const restoreFocus = useCallback(() => {
        if (document.querySelector(MODAL_SELECTOR)) return false;
        const key = lastFocus.current.get(window.location.pathname);
        if (key == null) return false;
        for (const [id, entry] of registry.current) {
            if (entry.restoreKey === key && entry.el) {
                focusId(id);
                return true;
            }
        }
        return false;
    }, [focusId]);

    const findNext = useCallback((dir) => {
        const curId = currentId.current;
        const cur = curId != null ? registry.current.get(curId) : null;
        if (!cur?.el) {
            if (focusFirstContent()) return;
            const first = [...registry.current.keys()][0];
            if (first != null) focusId(first);
            return;
        }
        const cr = cur.el.getBoundingClientRect();
        const flags = {
            cr,
            cc: rectCenter(cr),
            curInNav: !!cur.el.closest('.topnav'),
            curInModal: !!cur.el.closest(MODAL_SELECTOR),
            vertical: dir === 'up' || dir === 'down',
        };
        let best = null;
        let bestScore = Infinity;
        for (const [id, entry] of registry.current) {
            if (id === curId) continue;
            const score = candidateScore(dir, entry, flags);
            if (score != null && score < bestScore) {
                bestScore = score;
                best = id;
            }
        }
        if (best == null) return;
        if (flags.vertical) {
            const bestTrack = registry.current.get(best)?.el?.closest('.row-track');
            if (bestTrack && bestTrack !== cur.el.closest('.row-track')) {
                best = leftmostInTrack(registry.current, bestTrack) ?? best;
            }
        }
        focusId(best);
    }, [focusId, focusFirstContent]);

    const select = useCallback(() => {
        const cur = currentId.current != null ? registry.current.get(currentId.current) : null;
        cur?.onSelect?.();
    }, []);

    const jumpTop = useCallback(() => {
        const main = document.querySelector('.main');
        if (main) main.scrollTo({top: 0, behavior: 'smooth'});
        focusFirstContent();
    }, [focusFirstContent]);

    useEffect(() => {
        const onKey = (e) => {
            const map = {
                ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
            };
            if (e.key === 'Home' || e.key === 'PageUp') {
                e.preventDefault();
                jumpTop();
                return;
            }
            if (map[e.key]) {
                e.preventDefault();
                findNext(map[e.key]);
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (e.key === 'Enter' && lpRef.current?.fired) return;
                const id = currentId.current;
                const entry = id != null ? registry.current.get(id) : null;
                if (e.key === 'Enter' && entry?.onLongPress) {
                    if (e.repeat) return;
                    lpRef.current = {id, fired: false};
                    clearTimeout(lpTimer.current);
                    lpTimer.current = setTimeout(() => {
                        if (lpRef.current && lpRef.current.id === id) {
                            lpRef.current.fired = true;
                            registry.current.get(id)?.onLongPress?.();
                        }
                    }, 500);
                } else {
                    select();
                }
            }
        };
        const onKeyUp = (e) => {
            if (e.key !== 'Enter' || !lpRef.current) return;
            clearTimeout(lpTimer.current);
            const {id, fired} = lpRef.current;
            lpRef.current = null;
            if (!fired && currentId.current === id) registry.current.get(id)?.onSelect?.();
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [findNext, select, jumpTop]);

    useEffect(() => {
        window.addEventListener('mousemove', markPointerMove, true);
        return () => window.removeEventListener('mousemove', markPointerMove, true);
    }, []);

    const ctx = useMemo(
        () => ({register, unregister, focusId, getCurrentId, focusFirstContent, restoreFocus, subscribe, currentId}),
        [register, unregister, focusId, getCurrentId, focusFirstContent, restoreFocus, subscribe],
    );
    return <SpatialContext.Provider value={ctx}>{children}</SpatialContext.Provider>;
}

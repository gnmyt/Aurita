import {useEffect, useRef, useState} from 'react';

const mem = new Map();
const LS_PREFIX = 'jf_cache_';

const lsGet = (key) => {
    try {
        const s = localStorage.getItem(LS_PREFIX + key);
        return s ? JSON.parse(s) : undefined;
    } catch {
        return undefined;
    }
}

const pruneLs = () => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX));
    keys.slice(0, Math.ceil(keys.length / 2)).forEach((k) => localStorage.removeItem(k));
}

const lsSet = (key, val) => {
    let s;
    try {
        s = JSON.stringify(val);
    } catch {
        return;
    }
    try {
        localStorage.setItem(LS_PREFIX + key, s);
    } catch {
        try {
            pruneLs();
            localStorage.setItem(LS_PREFIX + key, s);
        } catch {
        }
    }
}

export const getCache = (key) => {
    if (mem.has(key)) return mem.get(key);
    const v = lsGet(key);
    if (v !== undefined) mem.set(key, v);
    return v;
}

export const setCache = (key, val) => {
    mem.set(key, val);
    lsSet(key, val);
}

export const clearCache = () => {
    mem.clear();
    try {
        Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX)).forEach((k) => localStorage.removeItem(k));
    } catch {
    }
}

const bus = typeof window !== 'undefined' ? new EventTarget() : null;

export const revalidate = (key) => {
    bus?.dispatchEvent(new CustomEvent('revalidate', {detail: key}));
}

export const useCached = (key, fetcher) => {
    const [data, setData] = useState(() => (key ? getCache(key) : undefined));
    const [loading, setLoading] = useState(() => (key ? getCache(key) === undefined : true));
    const [tick, setTick] = useState(0);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    useEffect(() => {
        if (!key) return undefined;
        const cached = getCache(key);
        if (tick === 0) {
            setData(cached);
            setLoading(cached === undefined);
        }
        let alive = true;
        Promise.resolve(fetcherRef.current())
            .then((res) => {
                if (!alive) return;
                setCache(key, res);
                setData(res);
                setLoading(false);
            })
            .catch(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [key, tick]);

    useEffect(() => {
        if (!key || !bus) return undefined;
        const h = (e) => {
            if (e.detail === key) setTick((t) => t + 1);
        };
        bus.addEventListener('revalidate', h);
        return () => bus.removeEventListener('revalidate', h);
    }, [key]);

    return {data, loading};
}

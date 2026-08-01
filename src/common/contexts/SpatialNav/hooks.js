import {useContext, useEffect, useRef, useState} from 'react';
import {recentPointerMove, SpatialContext} from './context';

let _uid = 0;

export const useFocusable = ({onSelect, onFocus, onLongPress, focusKey, restoreKey} = {}) => {
    const ctx = useContext(SpatialContext);
    const idRef = useRef(focusKey || `f${++_uid}`);
    const elRef = useRef(null);
    const cbRef = useRef({onSelect, onFocus, onLongPress, restoreKey});
    cbRef.current = {onSelect, onFocus, onLongPress, restoreKey};

    const id = idRef.current;

    useEffect(() => {
        ctx.register(id, {
            get el() {
                return elRef.current;
            },
            get restoreKey() {
                return cbRef.current.restoreKey;
            },
            onSelect: () => cbRef.current.onSelect?.(),
            onFocus: () => cbRef.current.onFocus?.(),
            get onLongPress() {
                return cbRef.current.onLongPress ? () => cbRef.current.onLongPress() : null;
            },
        });
        return () => ctx.unregister(id);
    }, [ctx, id]);

    const [focused, setFocused] = useState(() => ctx.getCurrentId() === id);
    useEffect(() => ctx.subscribe((curId) => setFocused(curId === id)), [ctx, id]);

    const handlers = {
        ref: (node) => {
            elRef.current = node;
        },
        onMouseEnter: () => {
            if (recentPointerMove()) ctx.focusId(id, {scroll: false});
        },
        onClick: () => {
            ctx.focusId(id, {scroll: false});
            cbRef.current.onSelect?.();
        },
        'data-focused': focused ? 'true' : undefined,
    };

    return {focused, handlers, focusSelf: () => ctx.focusId(id)};
}

export const useSpatial = () => {
    return useContext(SpatialContext);
}

export const useSpatialFocus = () => {
    const ctx = useContext(SpatialContext);
    const [cur, setCur] = useState(() => ctx.getCurrentId());
    useEffect(() => ctx.subscribe((id) => setCur(id)), [ctx]);
    return cur;
}

export const useAutoFocusFirst = (ready) => {
    const ctx = useContext(SpatialContext);
    const done = useRef(false);
    useEffect(() => {
        if (!ready) {
            done.current = false;
            return;
        }
        if (done.current) return;
        const t = setTimeout(() => {
            if (ctx.restoreFocus() || ctx.focusFirstContent()) done.current = true;
        }, 0);
        return () => clearTimeout(t);
    }, [ready, ctx]);
}

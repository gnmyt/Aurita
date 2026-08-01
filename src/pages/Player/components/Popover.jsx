import {useLayoutEffect, useRef, useState} from 'react';

const ARROW_INSET = 26;

export const Popover = ({anchor, title, variant, children}) => {
    const ref = useRef(null);
    const [arrowX, setArrowX] = useState(null);

    useLayoutEffect(() => {
        const el = ref.current;
        const btn = document.querySelector(`[data-ctrl="${anchor}"]`);
        if (!el || !btn) {
            setArrowX(null);
            return undefined;
        }
        const place = () => {
            const pr = el.getBoundingClientRect();
            const br = btn.getBoundingClientRect();
            const x = br.left + br.width / 2 - pr.left;
            setArrowX(Math.max(ARROW_INSET, Math.min(pr.width - ARROW_INSET, x)));
        };
        place();
        const ro = new ResizeObserver(place);
        ro.observe(el);
        window.addEventListener('resize', place);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', place);
        };
    }, [anchor]);

    return (
        <div className={`pop${variant ? ` pop-${variant}` : ''}`} ref={ref}>
            {title && <div className="pop-title">{title}</div>}
            {children}
            {arrowX != null && <span className="pop-arrow" style={{left: `${arrowX}px`}}/>}
        </div>
    );
}


const CX = 75, CY = 92, R_OUT = 52, R_IN = 26, RMID = (R_OUT + R_IN) / 2, GAP = 7;
const KEYS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
const ANGLE = {ArrowUp: 270, ArrowRight: 0, ArrowDown: 90, ArrowLeft: 180};

const polar = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

const sector = (a0, a1) => {
    const [x0, y0] = polar(R_OUT, a0), [x1, y1] = polar(R_OUT, a1);
    const [x2, y2] = polar(R_IN, a1), [x3, y3] = polar(R_IN, a0);
    return `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 0 0 ${x3} ${y3} Z`;
}

const SECTORS = {
    ArrowUp: sector(225 + GAP, 315 - GAP),
    ArrowRight: sector(-45 + GAP, 45 - GAP),
    ArrowDown: sector(45 + GAP, 135 - GAP),
    ArrowLeft: sector(135 + GAP, 225 - GAP),
};

const chevron = (key) => {
    const [x, y] = polar(RMID, ANGLE[key]);
    const s = 6;
    if (key === 'ArrowUp') return `${x - s},${y + s * 0.5} ${x},${y - s * 0.5} ${x + s},${y + s * 0.5}`;
    if (key === 'ArrowDown') return `${x - s},${y - s * 0.5} ${x},${y + s * 0.5} ${x + s},${y - s * 0.5}`;
    if (key === 'ArrowLeft') return `${x + s * 0.5},${y - s} ${x - s * 0.5},${y} ${x + s * 0.5},${y + s}`;
    return `${x - s * 0.5},${y - s} ${x + s * 0.5},${y} ${x - s * 0.5},${y + s}`;
}

export const Dpad = ({flash}) => {
    return (
        <svg className="dpad" viewBox="17 34 116 116" aria-hidden="true">
            <circle className="dpad-ring" cx={CX} cy={CY} r={R_OUT}/>
            {KEYS.map((k) => <path key={k} d={SECTORS[k]} className={`dpad-sector${flash === k ? ' on' : ''}`}/>)}
            {KEYS.map((k) => <polyline key={k} points={chevron(k)}
                                       className={`dpad-chevron${flash === k ? ' on' : ''}`}/>)}
            <circle className="dpad-select" cx={CX} cy={CY} r={R_IN - 3}/>
        </svg>
    );
}

import {Check} from 'lucide-react';

export const TrackMenu = ({cols, menuCol, menuRow, menuRowRef}) => {
    return (
        <div className="nf-menu">
            {cols.map((col, ci) => (
                <div key={col.key} className={`nf-col${ci === menuCol ? ' active' : ''}`}>
                    <div className="nf-col-title">{col.title}</div>
                    {col.rows.map((r, ri) => (
                        <div key={r.label}
                             ref={ci === menuCol && ri === menuRow ? menuRowRef : null}
                             className={`nf-row${ci === menuCol && ri === menuRow ? ' focused' : ''}${r.on ? ' on' : ''}`}>
                            <span className="nf-check">{r.on && <Check size={18} strokeWidth={3}/>}</span>
                            <span>{r.label}</span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

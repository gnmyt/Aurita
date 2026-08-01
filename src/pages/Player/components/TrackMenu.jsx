import {Check} from 'lucide-react';
import {Popover} from './Popover';
import {useScrollIntoView} from '../hooks';

export const TrackMenu = ({anchor, cols, menuCol, menuRow}) => {
    const rowRef = useScrollIntoView([menuCol, menuRow]);
    return (
        <Popover anchor={anchor} variant="tracks">
            <div className="pop-cols">
                {cols.map((col, ci) => (
                    <div key={col.key} className={`nf-col${ci === menuCol ? ' active' : ''}`}>
                        <div className="nf-col-title">{col.title}</div>
                        {col.rows.map((r, ri) => (
                            <div key={r.label}
                                 ref={ci === menuCol && ri === menuRow ? rowRef : null}
                                 onClick={r.sel}
                                 className={`nf-row${ci === menuCol && ri === menuRow ? ' focused' : ''}${r.on ? ' on' : ''}`}>
                                <span className="nf-check">{r.on && <Check size={18} strokeWidth={3}/>}</span>
                                <span>{r.label}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </Popover>
    );
}

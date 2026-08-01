import {fmtClock as fmt, TICKS_PER_SEC} from '@/common/utils/time';
import {thumbStyle} from '../utils';

export const ScrubBar = ({zone, duration, time, buffered, scrubbing, scrubTime, chapters, chapterAt, trick}) => {
    const pct = duration ? (time / duration) * 100 : 0;
    const bufPct = duration ? Math.min(100, (buffered / duration) * 100) : 0;
    const scrubPct = duration ? (scrubTime / duration) * 100 : 0;
    return (
        <div className="nf-scrubber">
            <div className={`nf-track${zone === 'scrub' ? ' focused' : ''}`}>
                <div className="nf-buffer" style={{width: `${bufPct}%`}}/>
                <div className="nf-fill" style={{width: `${pct}%`}}/>
                {chapters.map((c) => {
                    const p = duration ? ((c.StartPositionTicks || 0) / TICKS_PER_SEC / duration) * 100 : 0;
                    return p > 0.3 && p < 99.7
                        ? <div key={c.StartPositionTicks} className="nf-chap" style={{left: `${p}%`}}/>
                        : null;
                })}
                <div className="nf-knob" style={{left: `${scrubbing ? scrubPct : pct}%`}}/>
                {scrubbing && duration > 0 && (
                    <>
                        <div className="scrub-preview" style={{left: `${Math.min(92, Math.max(8, scrubPct))}%`}}>
                            {trick && <div className="scrub-thumb" style={thumbStyle(trick, scrubTime)}/>}
                            {chapterAt(scrubTime)?.Name &&
                                <div className="scrub-chap">{chapterAt(scrubTime).Name}</div>}
                            <div className="scrub-time">{fmt(scrubTime)}</div>
                        </div>
                    </>
                )}
            </div>
            <span className="nf-time">{fmt(scrubbing ? scrubTime : (duration - time))}</span>
        </div>
    );
}

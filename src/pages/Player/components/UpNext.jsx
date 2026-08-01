import {ChevronDown} from 'lucide-react';

export const UpNext = ({nextEp, secondsLeft}) => {
    return (
        <div className="upnext">
            <div className="upnext-label">Als Nächstes in {secondsLeft}s</div>
            <div className="upnext-title">{nextEp.SeriesName}</div>
            <div className="upnext-sub">S{nextEp.ParentIndexNumber}:E{nextEp.IndexNumber} · {nextEp.Name}</div>
            <div className="upnext-actions">
        <span className="upnext-hint">
          OK = Jetzt abspielen · <ChevronDown className="inline-ico" size={15}/> = Schließen
        </span>
            </div>
        </div>
    );
}

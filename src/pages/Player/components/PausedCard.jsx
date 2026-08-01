export const PausedCard = ({item, epLine}) => {
    return (
        <>
            <div className="player-pausedim"/>
            <div className="player-paused">
                <div className="pp-eyebrow">Du schaust</div>
                {item?.Name && <div className="pp-title">{item.Type === 'Episode' ? item.SeriesName : item.Name}</div>}
                {epLine && <div className="pp-line">{epLine}</div>}
                {item?.Type === 'Episode' && item?.Name && <div className="pp-chapter">{item.Name}</div>}
                {item?.Overview && <div className="pp-overview">{item.Overview}</div>}
            </div>
        </>
    );
}

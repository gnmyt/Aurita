import "./styles.sass";
import {useState} from 'react';
import {ARROW_KEYS, BACK_KEYS, isBackKey, isOkKey, OK_KEYS, useKeyTrap} from '@/common/contexts/SpatialNav';

export const ConfirmDialog = ({
                                  title,
                                  message,
                                  confirmLabel = 'Bestätigen',
                                  cancelLabel = 'Abbrechen',
                                  danger,
                                  onConfirm,
                                  onCancel
                              }) => {
    const [idx, setIdx] = useState(0);

    useKeyTrap((e) => {
        if (![...ARROW_KEYS, ...OK_KEYS, ...BACK_KEYS].includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'ArrowLeft') setIdx(0);
        else if (e.key === 'ArrowRight') setIdx(1);
        else if (isOkKey(e)) (idx === 1 ? onConfirm : onCancel)?.();
        else if (isBackKey(e)) onCancel?.();
    });

    return (
        <div className="confirm">
            <div className="confirm-box">
                <div className="confirm-title">{title}</div>
                {message && <div className="confirm-msg">{message}</div>}
                <div className="confirm-actions">
                    <div className={`confirm-btn${idx === 0 ? ' focused' : ''}`}>{cancelLabel}</div>
                    <div
                        className={`confirm-btn${danger ? ' danger' : ''}${idx === 1 ? ' focused' : ''}`}>{confirmLabel}</div>
                </div>
            </div>
        </div>
    );
}

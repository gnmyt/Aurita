import "./styles.sass";
import {accountColor, userImageUrl} from '@/common/utils/jellyfin';

export const Avatar = ({account, size = 160, className = ''}) => {
    const img = userImageUrl(account, Math.round(size * 2));
    const [c1, c2] = accountColor(account?.userId);
    return (
        <div
            className={`avatar${className ? ' ' + className : ''}`}
            style={{width: size, height: size, background: img ? '#000' : `linear-gradient(150deg, ${c1}, ${c2})`}}
        >
            {img ? (
                <img src={img} alt="" draggable={false}/>
            ) : (
                <svg viewBox="0 0 100 100" width="64%" height="64%" aria-hidden="true">
                    <circle cx="36" cy="42" r="6" fill="#fff"/>
                    <circle cx="64" cy="42" r="6" fill="#fff"/>
                    <path d="M32 60 Q50 76 68 60" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"/>
                </svg>
            )}
        </div>
    );
}

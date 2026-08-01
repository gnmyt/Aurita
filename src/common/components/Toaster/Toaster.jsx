import "./styles.sass";
import {useEffect, useRef, useState} from 'react';
import {Check} from 'lucide-react';
import {onToast} from '@/common/utils/toast';

export const Toaster = () => {
    const [msg, setMsg] = useState(null);
    const timer = useRef(null);
    useEffect(() => onToast((m) => {
        setMsg(m);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setMsg(null), Math.min(20000, Math.max(2600, m.duration || 0)));
    }), []);
    useEffect(() => () => clearTimeout(timer.current), []);
    if (!msg) return null;
    return (
        <div className="app-toast" key={msg.id}>
            <Check size={20} strokeWidth={3}/>
            <div>
                {msg.header && <div className="app-toast-head">{msg.header}</div>}
                <span>{msg.text}</span>
            </div>
        </div>
    );
}

import {useEffect, useState} from 'react';

export const useSettledFocus = (focused, delay = 250) => {
    const [settled, setSettled] = useState(false);

    useEffect(() => {
        if (!focused) {
            setSettled(false);
            return undefined;
        }
        const timer = setTimeout(() => setSettled(true), delay);
        return () => clearTimeout(timer);
    }, [focused, delay]);

    return settled;
}

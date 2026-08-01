import {useEffect, useRef} from 'react';

export const useScrollIntoView = (deps) => {
    const ref = useRef(null);
    useEffect(() => {
        ref.current?.scrollIntoView({block: 'nearest', inline: 'nearest'});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return ref;
}

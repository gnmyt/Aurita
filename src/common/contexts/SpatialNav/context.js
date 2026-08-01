import {createContext} from 'react';

export const SpatialContext = createContext(null);

let lastPointerMove = 0;
export const markPointerMove = () => {
    lastPointerMove = Date.now();
};
export const recentPointerMove = () => Date.now() - lastPointerMove < 80;

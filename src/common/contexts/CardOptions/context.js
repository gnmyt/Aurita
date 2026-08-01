import {createContext, useContext} from 'react';

export const CardOptionsContext = createContext(null);

export const useCardOptions = () => {
    return useContext(CardOptionsContext);
}

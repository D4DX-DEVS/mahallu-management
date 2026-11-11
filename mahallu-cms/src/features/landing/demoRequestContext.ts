import { createContext, useContext } from 'react';

/**
 * Opens the "Request ZAAD" form. The page owns the dialog; every
 * "Request ZAAD" button on it calls this.
 */
export const DemoRequestContext = createContext<() => void>(() => undefined);

export const useRequestDemo = () => useContext(DemoRequestContext);

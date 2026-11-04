import { createContext, useContext } from 'react';

/**
 * Opens the "Request a demo" form. The page owns the dialog; every
 * "Request a demo" button on it calls this.
 */
export const DemoRequestContext = createContext<() => void>(() => undefined);

export const useRequestDemo = () => useContext(DemoRequestContext);

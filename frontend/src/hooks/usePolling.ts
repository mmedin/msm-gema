import { useEffect, useRef } from 'react';

/**
 * Hook para polling reactivo sin solapamiento de peticiones.
 * Utiliza setTimeout recursivo tras resolver o fallar la promesa,
 * garantizando que nunca se acumulen peticiones concurrentes en conexiones lentas.
 */
export function usePolling(
  callback: () => Promise<void> | void,
  intervalMs: number = 20000,
  deps: React.DependencyList = [],
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const tick = async () => {
      try {
        await savedCallback.current();
      } catch (error) {
        console.error('Error en ciclo de polling:', error);
      } finally {
        if (isMounted) {
          timeoutId = setTimeout(tick, intervalMs);
        }
      }
    };

    // Ejecución inicial inmediata
    tick();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [enabled, intervalMs, ...deps]);
}

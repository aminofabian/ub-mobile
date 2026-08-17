import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

export function useTenantDeepLink(onUrl: (url: string) => void | Promise<void>): void {
  const handlerRef = useRef(onUrl);
  handlerRef.current = onUrl;

  useEffect(() => {
    const handle = (url: string | null | undefined) => {
      if (!url?.trim()) {
        return;
      }
      void handlerRef.current(url);
    };

    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', (event) => {
      handle(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

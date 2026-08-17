import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createRealtimeClient } from '@kiosk/realtime';
import { API_BASE_URL } from '../lib/config';

export function useStorefrontRealtime(slug: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!slug) return;

    const client = createRealtimeClient(API_BASE_URL);
    void client.connect();

    const unsubPrice = client.subscribe('price_changed', () => {
      void queryClient.invalidateQueries({ queryKey: ['items', slug] });
      void queryClient.invalidateQueries({ queryKey: ['product', slug] });
    });

    const unsubStock = client.subscribe('stock_changed', () => {
      void queryClient.invalidateQueries({ queryKey: ['items', slug] });
      void queryClient.invalidateQueries({ queryKey: ['product', slug] });
    });

    return () => {
      unsubPrice();
      unsubStock();
      client.disconnect();
    };
  }, [queryClient, slug]);
}

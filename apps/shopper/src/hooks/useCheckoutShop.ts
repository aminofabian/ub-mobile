import { useEffect, useMemo, useState } from 'react';
import { factsFrom, knownShop, stillWaitingForShop, usableFacts, WAIT_FOR_SHOP_MS, type CheckoutFacts } from '../lib/checkout-facts';
import { loadFacts, saveFacts } from '../lib/checkout-memory';
import type { ShopFacts } from '../lib/checkout-form';
import { usePaymentOptions } from './usePaymentOptions';
import { useStorefront } from './useStorefront';

/**
 * What checkout knows about the shop: where it delivers and whether it takes M-Pesa online. The shop's own
 * answer when it has given one, the phone's copy from a recent visit when it has not, and nothing known
 * when neither exists, in which case the form says so rather than guessing.
 */
export function useCheckoutShop(slug: string) {
  const storefront = useStorefront(slug);
  const options = usePaymentOptions(slug);
  const [kept, setKept] = useState<CheckoutFacts | null>(null);
  const [keptRead, setKeptRead] = useState(false);
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  // The shop's calls have no time limit of their own, so on a bad connection the form would wait for ever.
  useEffect(() => {
    setWaitedTooLong(false);
    const timer = setTimeout(() => setWaitedTooLong(true), WAIT_FOR_SHOP_MS);
    return () => clearTimeout(timer);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    void loadFacts(slug).then((facts) => {
      if (cancelled) return;
      setKept(usableFacts(facts, new Date()));
      setKeptRead(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Each answer is used as it comes: the areas do not wait for the payment options, nor the options for the areas.
  const live = useMemo(
    () =>
      storefront.data || options.data
        ? {
            areas: storefront.data ? (storefront.data.deliveryAreas ?? []) : null,
            online: options.data ? (options.data.online ?? []) : null,
            manual: options.data ? (options.data.manual ?? []) : null,
          }
        : null,
    [storefront.data, options.data],
  );

  useEffect(() => {
    if (!live) return;
    const facts = factsFrom(live.areas, { online: live.online, manual: live.manual }, new Date());
    if (facts) void saveFacts(slug, facts);
  }, [live, slug]);

  const known = knownShop(live ? { areas: live.areas, online: live.online } : null, kept);
  const shop: ShopFacts = { areaNames: known.areaNames, hasOnlinePay: known.hasOnlinePay };

  return {
    shop,
    /** The answers shown come from the phone's copy, not from the shop just now. */
    fromPhone: known.fromPhone,
    /** Still waiting on the shop with nothing kept to go on. */
    loading: stillWaitingForShop({
      anyAnswer: live !== null,
      kept: kept !== null,
      keptRead,
      asking: storefront.isLoading || options.isLoading,
      waitedTooLong,
    }),
    /** The shop's counter payment instructions, when it has given them. */
    manualMethods: options.data?.manual ?? [],
  };
}

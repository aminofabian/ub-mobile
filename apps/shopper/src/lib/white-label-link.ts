/**
 * Whether a link may be followed in a shop's own app. That app has one shop, so a link is followed only
 * when it names that shop: following a link to any other would sign the person out of theirs and show
 * somebody else's. The generic app has no embedded shop and never follows a link by itself, so for it the
 * answer is always no.
 *
 * No imports, so node can run this file's test directly.
 */
export function linkIsForMyShop(embeddedSlug: string | null | undefined, linkedSlug: string | null | undefined): boolean {
  const mine = (embeddedSlug ?? '').trim().toLowerCase();
  const linked = (linkedSlug ?? '').trim().toLowerCase();
  return mine !== '' && mine === linked;
}

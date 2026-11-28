/**
 * Whether a shopper has to be signed in to check out.
 *
 * The website lets a guest place an order, so the app does too. Asking for a join first, as the app used to,
 * costs orders from people who only wanted to buy once, and gives the shop nothing it cannot take from the
 * form. A signed-in shopper still gets more: details kept by default, and orders in their account.
 *
 * Whether to put the join back in front of checkout is the owner's call (plan V2, section 5.8). It is one
 * constant, here, so the answer is one change.
 */
export const REQUIRE_SIGN_IN_TO_CHECKOUT = false;

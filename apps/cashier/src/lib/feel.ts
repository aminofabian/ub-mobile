import * as Haptics from 'expo-haptics';

/**
 * The till's sense of touch.
 *
 * A touchscreen that never answers feels like a web page in a shell. One light impact on a press, a
 * selection tick when a choice changes, and a success/warning note at the two moments that matter (a
 * sale recorded, a count that does not match) — that is the whole vocabulary. Everything is fire and
 * forget: a device that cannot buzz (or a person who turned it off) must never see a failed sale
 * because of it.
 */
const fire = (run: () => Promise<void>): void => {
  void run().catch(() => undefined);
};

export const feel = {
  /** A press that did something: adding a product, opening a sheet, stepping a quantity. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Moving through choices: a chip, a tab, a filter. */
  select: () => fire(() => Haptics.selectionAsync()),
  /** A sale recorded, a shift closed cleanly. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Something the cashier must look at: a blocked item, a count that does not match. */
  warn: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** A refusal: the shop would not take it, or the line could not be made. */
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

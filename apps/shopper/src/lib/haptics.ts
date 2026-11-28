import * as Haptics from 'expo-haptics';

/**
 * Touch feedback. Each call is fire-and-forget: a phone with haptics off, or a simulator with none,
 * must never slow down or break the tap it answers.
 */
function quiet(run: () => Promise<void>) {
  run().catch(() => undefined);
}

/** A control took the press. */
export function tapFeel() {
  quiet(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Something landed: an item in the basket, a sheet snapping open. */
export function landFeel() {
  quiet(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** A choice changed: a tab, a chip, a quantity step. */
export function stepFeel() {
  quiet(() => Haptics.selectionAsync());
}

/** The thing the shopper came to do is done: order placed, payment through. */
export function doneFeel() {
  quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** It did not go through. */
export function failFeel() {
  quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

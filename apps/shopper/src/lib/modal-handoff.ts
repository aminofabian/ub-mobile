/**
 * iOS cannot present a modal while another is still closing: the second is dropped without a word. The
 * Shopper has two places that close one modal and open another (the list of shops to the shop finder, the
 * shop finder to an offered link), so on iOS the second waits for the first to finish closing. Android has
 * no such limit and does not wait.
 *
 * The wait is longer than the close animation (about 0.35 s) and has not been timed on a device.
 *
 * No imports, so node can run this file's test directly.
 */
export const IOS_MODAL_CLOSE_MS = 450;

export function afterModalCloses(
  run: () => void,
  os: string,
  schedule: (task: () => void, ms: number) => unknown = setTimeout,
): void {
  if (os === 'ios') {
    schedule(run, IOS_MODAL_CLOSE_MS);
  } else {
    run();
  }
}

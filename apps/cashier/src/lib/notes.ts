/** The most notes the notice bar shows in full. One more than this is still shown whole (see `boundNotes`). */
export const MAX_NOTES = 3;

/**
 * The notes to draw. A basket picked up after a long wait, or a list of held baskets with several problems, can have
 * more to say than fits above the products, and a bar that grows until the list is gone is worse than one that says
 * how many it left out. Up to one more than `max` is shown whole, because "and 1 more" takes the room of the note it
 * hides; past that the first `max` are shown and the rest are counted.
 */
export function boundNotes(notes: readonly string[], max: number = MAX_NOTES): string[] {
  if (notes.length <= max + 1) return [...notes];
  const hidden = notes.length - max;
  return [...notes.slice(0, max), `and ${hidden} more.`];
}

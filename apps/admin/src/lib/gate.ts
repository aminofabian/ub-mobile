/**
 * A door that lets one caller through at a time. `enter` answers whether the caller may go ahead; whoever went ahead
 * calls `leave` when finished.
 *
 * It answers at once. A flag kept with `useState` is not seen until the screen has been drawn again, so two quick taps
 * both found it clear: on iOS two "Record this payment?" questions were put up one on top of the other, and confirming
 * both could send the payment twice. A gate is read in the same breath it is shut.
 */
export type Gate = {
  /** True when the caller may go ahead, and the door is now shut behind them. False when someone is already through. */
  enter: () => boolean;
  /** Opens the door again. Harmless when it is already open. */
  leave: () => void;
  /** Whether someone is through right now. */
  held: () => boolean;
};

export function createGate(): Gate {
  let inside = false;
  return {
    enter: () => {
      if (inside) return false;
      inside = true;
      return true;
    },
    leave: () => {
      inside = false;
    },
    held: () => inside,
  };
}

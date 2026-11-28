import React from 'react';
import { Capsule } from './Capsule';

/** The two buttons the shop picker and its sheets use: one main action, and a quieter alternative. */
export function ActionButton({
  label,
  onPress,
  kind = 'primary',
  busy = false,
  disabled = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'quiet';
  busy?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  return (
    <Capsule
      label={label}
      onPress={onPress}
      kind={kind}
      busy={busy}
      disabled={disabled}
      chip={kind === 'primary' ? 'arrow-forward' : undefined}
      accessibilityHint={accessibilityHint}
    />
  );
}

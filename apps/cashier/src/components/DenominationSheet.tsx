import React from 'react';
import { BottomSheet } from './BottomSheet';
import { DenominationCounter, type DenominationProps } from './DenominationCounter';

/**
 * The counter as a sheet of its own, for the Shift screen. The open-shift prompt shows the same counter inside its
 * own sheet instead (a second modal over a modal does not present on iOS), which is why the body lives apart.
 */
export function DenominationSheet({ mode, expectedTotal, onCancel, onDone }: DenominationProps) {
  return (
    <BottomSheet visible onClose={onCancel} title={mode === 'open' ? 'Opening cash' : 'Closing cash'}>
      <DenominationCounter embedded mode={mode} expectedTotal={expectedTotal} onCancel={onCancel} onDone={onDone} />
    </BottomSheet>
  );
}

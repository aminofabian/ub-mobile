import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
// Metro resolves this to the bundled asset's module id; the `*.wav` shim in assets.d.ts types it.
import CHIME from '../../assets/sounds/invoice-chime.wav';

/**
 * The bell's alert: a short chime plus a success buzz when a counter invoice lands. Everything here
 * is fire-and-forget — a till with the ringer off, a simulator with no audio, or a phone that denies
 * haptics must never throw or slow the live update it answers.
 */

let player: AudioPlayer | null = null;
let audioReady = false;

/** Build the player once and set an audio mode that is heard even on silent. Safe to call repeatedly. */
export function primeInvoiceAlert(): void {
  if (audioReady) return;
  audioReady = true;
  try {
    // A till is meant to be heard: play through the silent switch, and don't duck to a whisper.
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(
      () => undefined
    );
    player = createAudioPlayer(CHIME);
  } catch {
    player = null;
  }
}

/** Replay the chime from the start, so two invoices a second apart each ring. */
function chime(): void {
  try {
    if (!player) primeInvoiceAlert();
    if (!player) return;
    player.seekTo(0);
    player.play();
  } catch {
    // A failed play is silent, never fatal.
  }
}

/** A new counter invoice arrived: chime + a success-pattern buzz. */
export function alertInvoiceArrived(): void {
  chime();
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/** Release the player on sign-out / teardown. */
export function releaseInvoiceAlert(): void {
  try {
    player?.remove();
  } catch {
    // ignore
  }
  player = null;
  audioReady = false;
}

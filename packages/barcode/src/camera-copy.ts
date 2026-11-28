/** Where the camera stands, as far as the words on the scanner screen are concerned. */
export type CameraWords =
  | { kind: 'checking' }
  /** The person said no. `canAskAgain` is false once the phone no longer shows the question. */
  | { kind: 'refused'; canAskAgain: boolean }
  /** This build has no camera module, or it failed to start. */
  | { kind: 'missing' };

/**
 * What the scanner screen says while it has no picture. A refusal says what the person can do next, and not the
 * same thing both times: while the phone still asks, backing out and tapping Scan again brings the question back;
 * after that only the phone's settings can, and promising a second question would be a lie. `scanAgain` is what the
 * button that opens the camera is called on the screen the person came from.
 */
export function describeCameraAccess(access: CameraWords, scanAgain = 'Scan QR code'): string {
  switch (access.kind) {
    case 'checking':
      return 'Opening the camera...';
    case 'refused':
      return access.canAskAgain
        ? `Camera access wasn't allowed. Type the code instead, or go back and tap ${scanAgain} again to be asked once more.`
        : "Camera access is turned off for this app. Turn it on in your phone's settings, or type the code instead.";
    case 'missing':
      return "The camera isn't available on this phone. Type the code instead.";
  }
}

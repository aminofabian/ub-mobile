# Mobile release artifacts

Drop Android APKs here to publish them on the web download page
(`https://<platform-host>/download#mobile`).

1. Build the APK with EAS (see `../RELEASE.md`):

   ```bash
   cd mobile/apps/shopper
   eas build --profile preview --platform android
   ```

2. Download the artifact from Expo and save it in this folder. The filename
   must contain the app id so the publisher can match it:
   `shopper`, `cashier`, `admin`, `stock`, or `grocery` —
   e.g. `kiosk-shopper.apk`.

3. Publish it to the web app:

   ```bash
   cd frontend
   bun run pack:mobile-downloads
   ```

This copies the newest APK per app into `frontend/public/downloads/mobile/`
(with the version from the app's `package.json`) and regenerates
`manifest.json`, which the `/download` page reads.

App Store / Play Store badge URLs can be set at publish time:

```bash
APP_MOBILE_STORE_LINK_ANDROID="https://play.google.com/store/apps/details?id=..." \
APP_MOBILE_STORE_LINK_IOS="https://apps.apple.com/app/..." \
bun run pack:mobile-downloads
```

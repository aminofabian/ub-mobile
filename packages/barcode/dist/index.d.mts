import * as react_jsx_runtime from 'react/jsx-runtime';

interface QrScannerProps {
    /** The text of the first QR code the camera reads. Called once. */
    onScanned: (text: string) => void;
    /** The person backed out, or the camera cannot be used: the caller shows another way to enter the code. */
    onCancel: () => void;
}
/**
 * Reads one QR code, for the screens that pair a phone or join a shop. It asks for the camera itself, as the
 * barcode scanner beside it does, and it loads the camera module only when it is shown, so an app that never
 * shows it does not need the module to start.
 */
declare function QrScanner({ onScanned, onCancel }: QrScannerProps): react_jsx_runtime.JSX.Element;

interface BarcodeResult {
    value: string;
    format: string;
}
interface BarcodeScannerProps {
    onBarcode: (result: BarcodeResult) => void;
    /** Called when the camera module could not be loaded. The scanner says so on its own screen as well, so a caller that wants that read leaves this out. */
    onError?: (error: Error) => void;
    onClose?: () => void;
}
/**
 * Reads barcodes for as long as it is shown. It asks for the camera itself the first time, and says what to do when the
 * answer is no. It loads the camera module only when it is shown, so an app that never shows it does not need the module
 * to start.
 */
declare function BarcodeScanner({ onBarcode, onError, onClose }: BarcodeScannerProps): react_jsx_runtime.JSX.Element;

export { type BarcodeResult, BarcodeScanner, type BarcodeScannerProps, QrScanner, type QrScannerProps };

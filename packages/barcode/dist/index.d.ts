import * as react_jsx_runtime from 'react/jsx-runtime';

interface BarcodeResult {
    value: string;
    format: string;
}
interface BarcodeScannerProps {
    onBarcode: (result: BarcodeResult) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
}
declare function BarcodeScanner({ onBarcode, onError, onClose }: BarcodeScannerProps): react_jsx_runtime.JSX.Element;

export { type BarcodeResult, BarcodeScanner, type BarcodeScannerProps };

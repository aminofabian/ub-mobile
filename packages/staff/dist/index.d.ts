import * as react_native from 'react-native';
import { PressableProps, TextProps, ViewProps } from 'react-native';
import { TenantContext, BranchOption, StockItem, ApiClient, ItemHistory, UnsentSummary, StaffUser, StaffApp } from '@kiosk/core';
export { DecreaseCall } from '@kiosk/core';
import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as zustand from 'zustand';

/**
 * The shop as a guide map. Cream is the water every screen floats on, the shop's own colour is the land,
 * and four zone colours mark aisles and states.
 */
declare const MART: {
    readonly ink: "#16180f";
    readonly inkMuted: "#565a4e";
    /** Darkest quiet tone that still clears 4.5:1 on `paper`. */
    readonly inkQuiet: "#8c8f82";
    /** The ground of every screen: a warm, soft off-white with the faintest green undertone. */
    readonly paper: "#f7f6f0";
    /** Cards and fields: pure white, lifted by a soft shadow. */
    readonly paperElevated: "#ffffff";
    /** Pressed tiles, skeleton bones, quiet wells. */
    readonly paperSunken: "#eceae1";
    /** Hairline dividers and card edges. */
    readonly border: "#e8e6db";
    /** Outlined capsules and fields at rest. */
    readonly borderStrong: "#d4d1c4";
    /** The accent that leads: the counter's amber, so the till and the shop floor read as one product. */
    readonly fallbackPrimary: "#F08A24";
    /** A deeper amber for pressed states and text on the wash. */
    readonly fallbackPrimaryLift: "#D97515";
    readonly fallbackAccent: "#e8650e";
    readonly gold: "#f2c438";
    readonly danger: "#b42318";
    readonly dangerSurface: "#fee4e2";
    readonly success: "#2f7a21";
    readonly successSurface: "#dcf5d0";
    readonly warning: "#7a5a00";
    readonly warningSurface: "#fdf2c4";
    readonly info: "#0b5cab";
    readonly infoSurface: "#d4e9ff";
    /** The soft shadow colour — a warm brown-black, never pure black. */
    readonly shadowTint: "#7A5A2E";
    readonly radius: 16;
};
/** The map's zone colours. Each aisle keeps one; ink is the only text colour that sits on them. */
declare const ZONE: {
    readonly sun: "#f5e211";
    readonly coral: "#ff705d";
    readonly pond: "#2ba0ff";
    readonly lilac: "#ebc1ff";
    readonly leaf: "#8ed462";
};
/** The same aisle is always the same colour, on every screen and after every reload. */
declare function zoneFor(key: string | null | undefined): string;
/** Lobes are round. Tiles take `lg`, wells `md`, small marks `sm`; every control is a capsule (`pill`). */
declare const RADIUS: {
    readonly sm: 12;
    readonly md: 16;
    readonly lg: 20;
    readonly xl: 28;
    readonly pill: 999;
};
/** 4pt grid. Page gutter is GUTTER; grid gap is SPACE.sm. */
declare const SPACE: {
    readonly xxs: 2;
    readonly xs: 4;
    readonly sm: 8;
    readonly md: 12;
    readonly lg: 16;
    readonly xl: 20;
    readonly xxl: 28;
    readonly xxxl: 40;
};
declare const GUTTER: 20;
/**
 * The UI voice, changed once at start-up by an app that wants its own typeface.
 *
 * The till reads best in the device's own face; a counter can wear its brand instead. Because `MartText` and every
 * component read these values on each render, mutating them before the first screen paints is enough — no context, no
 * prop drilling, and an app that never calls the setter keeps the system face it always had.
 */
/**
 * The UI voice. DM Sans while the Sande More files are the unlicensed demo build (it watermarks every heading); the four
 * `SandeMore_*` families stay loaded in the shell, so switching back is this table alone.
 */
/**
 * The UI voice: **Sande More**, as asked. Note the files supplied are the DEMO cut, which prints a small "DEMO" glyph
 * after each heading — the licensed build replaces them file for file, with no code change.
 */
declare const FONT: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
    black: string;
};
/** Families as they are registered by the shell's `useFonts`. */
declare const JAKARTA: {
    readonly regular: "PlusJakartaSans_400Regular";
    readonly medium: "PlusJakartaSans_500Medium";
    readonly semibold: "PlusJakartaSans_600SemiBold";
    readonly bold: "PlusJakartaSans_700Bold";
    readonly black: "PlusJakartaSans_800ExtraBold";
};
type UiTypeface = 'system' | 'jakarta';
type UiFace = {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
    black: string;
};
/**
 * Point every MART / UI text style at these registered family names. Call once after `useFonts` resolves,
 * before the first screen paints. Updates both `@kiosk/staff` and `@kiosk/ui` so Banner/Button match MartText.
 */
declare function setUiFace(family: UiFace): void;
/** Called once by an app before its first screen: `jakarta` for the branded counter, `system` for the till. */
declare function setUiTypeface(face: UiTypeface): void;
/**
 * The weights, as plain strings rather than `TextStyle['fontWeight']`: a navigator's header style asks for `string`, and
 * the wider union (which admits numbers) is refused there. These five values satisfy both.
 */
declare const WEIGHT: Record<'regular' | 'medium' | 'semibold' | 'bold' | 'black', '400' | '500' | '600' | '700' | '800'>;
/** Same system face for headers. */
declare const BRAND: {
    readonly semibold: string;
    readonly bold: string;
    readonly black: string;
};
/**
 * Soft POS scale — matches the food-ordering till shot:
 * screen titles 600, product names 500, prices 600, loud totals 700, meta 400.
 */
declare const TYPE: {
    display: {
        fontFamily: string;
        fontWeight: "400" | "500" | "600" | "700" | "800";
        fontSize: number;
        lineHeight: number;
        letterSpacing: number;
    };
    hero: {
        fontFamily: string;
        fontWeight: "400" | "500" | "600" | "700" | "800";
        fontSize: number;
        lineHeight: number;
        letterSpacing: number;
    };
    title: {
        fontFamily: string;
        fontWeight: "400" | "500" | "600" | "700" | "800";
        fontSize: number;
        lineHeight: number;
        letterSpacing: number;
    };
    heading: {
        fontFamily: string;
        fontWeight: "400" | "500" | "600" | "700" | "800";
        fontSize: number;
        lineHeight: number;
        letterSpacing: number;
    };
    body: {
        fontFamily: string;
        fontWeight: "400" | "500" | "600" | "700" | "800";
        fontSize: number;
        lineHeight: number;
    };
    label: {
        fontFamily: string;
        fontWeight: "400" | "500" | "600" | "700" | "800";
        fontSize: number;
        lineHeight: number;
        letterSpacing: number;
    };
    meta: {
        fontFamily: string;
        fontWeight: "400" | "500" | "600" | "700" | "800";
        fontSize: number;
        lineHeight: number;
        letterSpacing: number;
    };
    shelf: {
        fontFamily: string;
        fontWeight: "400" | "500" | "600" | "700" | "800";
        fontSize: number;
        lineHeight: number;
        letterSpacing: number;
    };
    price: {
        fontFamily: string;
        fontWeight: "400" | "500" | "600" | "700" | "800";
        fontSize: number;
        lineHeight: number;
        letterSpacing: number;
    };
};
declare const ELEVATION: {
    readonly ruled: {
        readonly backgroundColor: "#ffffff";
    };
    readonly lifted: {
        readonly backgroundColor: "#f7f6f0";
        readonly borderWidth: 1.5;
        readonly borderColor: "#16180f";
    };
};
/**
 * Soft desk-paper lift. Cards use `card`; bars that sit over content use `floating`.
 */
declare const SHADOW: {
    readonly card: {
        readonly shadowColor: "#7A5A2E";
        readonly shadowOffset: {
            readonly width: 0;
            readonly height: 4;
        };
        readonly shadowOpacity: 0.07;
        readonly shadowRadius: 14;
        readonly elevation: 3;
    };
    readonly hero: {
        readonly shadowColor: "#7A5A2E";
        readonly shadowOffset: {
            readonly width: 0;
            readonly height: 10;
        };
        readonly shadowOpacity: 0.12;
        readonly shadowRadius: 24;
        readonly elevation: 8;
    };
    readonly floating: {
        readonly shadowColor: "#7A5A2E";
        readonly shadowOffset: {
            readonly width: 0;
            readonly height: -2;
        };
        readonly shadowOpacity: 0.08;
        readonly shadowRadius: 16;
        readonly elevation: 10;
    };
};
declare const HAIRLINE: {
    readonly borderWidth: number;
    readonly borderColor: "#e8e6db";
};
declare const SPRING: {
    readonly duration: 400;
    readonly dampingRatio: 0.62;
};
declare const SETTLE: {
    readonly duration: 400;
    readonly dampingRatio: 1;
};
declare const MOTION: {
    readonly feedback: 130;
    readonly state: 220;
    readonly view: 400;
    readonly entrance: 400;
    readonly exit: 220;
    readonly easeOut: react_native.EasingFunction;
    readonly easeIn: react_native.EasingFunction;
};
/** Two-digit alpha suffix for a hex colour. */
declare function tint(hex: string, alpha: number): string;
type OnFill = {
    /** Text and icons. */
    primary: string;
    /** Supporting text. Still clears 4.5:1. */
    secondary: string;
    hairline: string;
    wash: string;
};
/**
 * What to write with on a filled area. A shop picks its own colours, so this is worked out from the fill:
 * ink where ink clears 4.5:1, cream otherwise.
 */
declare function onFill(hex: string): OnFill;
/** Text on the fallback brand green. Prefer `onFill(colour)` wherever the fill is a shop's colour. */
declare const ON_BRAND: OnFill;
type MartPalette = {
    primary: string;
    accent: string;
    gold: string;
    onPrimary: OnFill;
    onAccent: OnFill;
    logoUrl: string | null;
    displayName: string;
    tagline: string | null;
    description: string | null;
    heroBanners: string[];
};
declare function martFromTenant(tenant: TenantContext, extras?: {
    announcement?: string | null;
    businessName?: string | null;
}): MartPalette;
/** A white field on the water that holds a form, a list or a summary. */
declare const TILE: {
    readonly backgroundColor: "#ffffff";
    readonly borderRadius: 20;
    readonly padding: 16;
};

/**
 * The mart look: a warm paper ground, white tiles lifted by a soft shadow, the Poppins type scale.
 * Screens compose these instead of reaching for raw styles.
 */
type TypeScale = keyof typeof TYPE;
/**
 * A tappable that dips a touch when pressed — scale 0.97, a fast spring down and an eased spring back — so every
 * button, tile and row feels like it heard the finger. This one micro-interaction, applied everywhere, is most of
 * what makes an app feel alive; nothing in the real world reacts to a press by doing nothing. Drop-in for Pressable.
 */
declare function PressableScale({ children, style, onPressIn, onPressOut, disabled, scaleTo, ...rest }: PressableProps & {
    scaleTo?: number;
}): react_jsx_runtime.JSX.Element;
declare function MartText({ variant, color, style, ...rest }: TextProps & {
    variant?: TypeScale;
    color?: string;
}): react_jsx_runtime.JSX.Element;
/** The screen's cream ground. */
declare function Screen({ style, ...rest }: ViewProps): react_jsx_runtime.JSX.Element;
/** A white field on the water that holds a form, a list row or a summary. */
declare function Tile({ style, ...rest }: ViewProps): react_jsx_runtime.JSX.Element;
/**
 * A metric. Quiet by design: a white tile on the water, a small zone-coloured dot keyed to the label
 * for identity, a muted caption, and the number itself in ink doing the talking.
 */
declare function StatTile({ label, value, zoneKey, }: {
    label: string;
    value: string;
    zoneKey?: string;
}): react_jsx_runtime.JSX.Element;
/**
 * A tiny bar sparkline drawn from plain Views — no native SVG module, so it needs no extra build.
 * Values are normalised to the tallest bar; the last bar takes the accent to read as "now".
 */
declare function Sparkline({ data, color, height, }: {
    data: number[];
    color?: string;
    height?: number;
}): react_jsx_runtime.JSX.Element;
/**
 * The screen's headline number: a caption, a large ink figure, an optional trend delta, and an
 * optional sparkline. One of these leads the dashboard; the smaller MiniTiles support it.
 */
declare function HeroMetric({ label, value, delta, trendUp, spark, accent, }: {
    label: string;
    value: string;
    delta?: string;
    trendUp?: boolean;
    spark?: number[];
    accent?: string;
}): react_jsx_runtime.JSX.Element;
/** A supporting metric: small icon, caption, and number, on a quiet tile. */
declare function MiniTile({ icon, label, value, accent, }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    accent?: string;
}): react_jsx_runtime.JSX.Element;
declare function SectionHead({ children }: {
    children: React.ReactNode;
}): react_jsx_runtime.JSX.Element;
type ButtonKind = 'primary' | 'accent' | 'quiet';
declare function MartButton({ label, kind, busy, disabled, style, ...rest }: Omit<PressableProps, 'children'> & {
    label: string;
    kind?: ButtonKind;
    busy?: boolean;
}): react_jsx_runtime.JSX.Element;

/**
 * The gloss on a card: an edge that catches light, a warm fall at the foot, and one soft reflection across the top.
 *
 * It is drawn from plain views rather than a gradient image or an SVG paint — both of which misbehave in this stack
 * (`url(#id)` paints render red; stretched images draw at 1:1 and get cropped). Four layers, no per-frame work, and
 * it lands identically at any card size.
 */
declare function CardGloss({ radius, strength }: {
    radius?: number;
    strength?: 'soft' | 'high';
}): react_jsx_runtime.JSX.Element;

/**
 * The ground a screen floats on: a lit surface rather than a flat fill.
 *
 * A 512×1024 bake of three slow passes — a wash with a light direction, a soft highlight where the light falls in, and a
 * faint shadow gathering at the foot — drawn as one static image so there is no per-frame work and no dependency on a
 * gradient library. Only the ground is tinted; the cards above it stay the brightest thing on screen, which is what
 * makes them float.
 */
declare function Gloss(): react_jsx_runtime.JSX.Element;

/**
 * A sheet that rises from the foot of the screen, with a scrim that closes it and a keyboard avoider inside it.
 *
 * The till learned the hard way that iOS's native page sheet cannot give a text field first responder in this app; every
 * sheet that can hold a form uses this shape instead, so all apps share one sheet behaviour.
 */
declare function Sheet({ visible, onClose, children, title, maxHeight, }: {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    maxHeight?: `${number}%`;
}): react_jsx_runtime.JSX.Element;

/**
 * A customer whose details have been checked — by a person at the shop, or by entering a code sent to their own number.
 *
 * Both roads end in the same status here: the badge is about the person being known, not about which method proved it. It
 * is deliberately quiet — a small check in a tinted capsule — because verification is information, not a warning: most
 * shops do not require it, and a customer without it is not in any trouble.
 */
declare function VerifiedBadge({ verified, compact }: {
    verified: boolean;
    compact?: boolean;
}): react_jsx_runtime.JSX.Element | null;

/** Where a product was, and where the basket is, both in the screen's own coordinates. */
type Flight = {
    id: number;
    /** The product's initials, so the thing in the air is recognisably the thing that was tapped. */
    initials: string;
    /** The aisle colour of that product, the same tint as its tile. */
    colour: string;
    from: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    to: {
        x: number;
        y: number;
    };
};
/**
 * The tap, answered in space: a small disc carrying the product's initials arcs from its tile to the
 * basket total, shrinking and fading as it lands.
 *
 * It is purely visual — the product is in the basket before this runs, and nothing here can slow a sale.
 * One flight per new line, never per quantity change, and none at all when the phone asks for reduced motion.
 */
declare function FlyToCart({ flights, onDone }: {
    flights: readonly Flight[];
    onDone: (id: number) => void;
}): react_jsx_runtime.JSX.Element;

/**
 * The weigh sheet for a product sold by weight: the till's own prompt, shared.
 *
 * Two ways to answer, and a way to swap between them:
 *   • by weight — type kilograms (0.35), or tap ¼ / ½ / ¾ / 1 / 2;
 *   • by money — type what the customer is spending, and the sheet works out the weight ("100 bob of sugar").
 * The live line shows the weight and what it costs before anything goes into the basket, so the label and the charge can
 * never disagree.
 */
declare function WeightSheet({ visible, name, unit, perUnitCents, onCancel, onConfirm, onNotWeighed, }: {
    visible: boolean;
    name: string;
    unit?: string;
    /** What one unit costs, in cents. Null when the product has no price and cannot be sold by weight. */
    perUnitCents: number | null;
    onCancel: () => void;
    /** Answers with words when it cannot be taken, and null once it has been. */
    onConfirm: (thousandths: number) => string | null;
    /**
     * Offered when the product is not really sold by weight: stops treating it that way. Answers with words on failure, or
     * null once the item has been changed.
     */
    onNotWeighed?: () => Promise<string | null>;
}): react_jsx_runtime.JSX.Element;

/** What a shelf tile needs to know about a product — the same few facts the till's tiles show. */
type ShelfTileItem = {
    name: string;
    /** Whole shillings, or null when the shop has not priced it yet. */
    priceCents: number | null;
    /** Ten-thousandths on hand at this branch, or null when the server did not say. */
    onHandUnits: number | null;
    weighed: boolean;
    /** A photograph, when the catalogue has one. */
    imageUrl?: string | null;
    /** How many are already in the basket. */
    inBasket?: number;
};
/**
 * Retail POS product tile: compact media, strong name/price, −/qty/+, clear selected vs out-of-stock.
 * Selection = brand border + check + stepper count. Stock = quiet “Out” under the price — never the same mark.
 */
declare function ShelfTile({ item, onPress, onAdd, onRemove, onPressRect, disabled, columns, nameLines, frame, }: {
    item: ShelfTileItem;
    onPress: () => void;
    onAdd?: () => void;
    onRemove?: () => void;
    onPressRect?: (rect: {
        x: number;
        y: number;
        w: number;
        h: number;
    }) => void;
    disabled?: boolean;
    columns?: 2 | 3;
    /** How many lines the name may use. The rest wraps instead of ending in an ellipsis sooner than this. */
    nameLines?: number;
    /** `rail` fills a fixed-width card in a horizontal row. `grid` shares a column. */
    frame?: 'grid' | 'rail';
}): react_jsx_runtime.JSX.Element;

interface AuthState {
    tenant: TenantContext | null;
    branchId: string | null;
    branchName: string | null;
    email: string | null;
    isAuthenticated: boolean;
    setTenant: (tenant: TenantContext | null) => void;
    setBranch: (branch: BranchOption | null) => void;
    setEmail: (email: string) => void;
    setAuthenticated: (value: boolean) => void;
    reset: () => void;
}
declare const useAuthStore: zustand.UseBoundStore<zustand.StoreApi<AuthState>>;

type StaffBootPhase = 'loading' | 'tenant' | 'branch' | 'login' | 'ready' | 'error';
declare function useStaffBoot(baseURL: string, setTenant: (tenant: TenantContext) => void, 
/** Asked before a link that arrives while the app is open is followed. Saying no leaves the link unopened. */
mayFollowLink?: (url: string) => boolean): {
    phase: StaffBootPhase;
    setPhase: (phase: StaffBootPhase) => void;
    bootError: string | null;
    retry: () => void;
};

declare function useStaffAuthNavigation(setPhase: (phase: StaffBootPhase) => void, onLeaveStore?: () => void): {
    canChangeStore: boolean;
    goToTenant: () => Promise<void>;
    goToBranch: () => void;
};

/** What a screen needs of a keeper (see `createKeeper` in `@kiosk/core`). */
interface KeptSource<T> {
    load: (now: number) => Promise<T>;
    get: () => T;
    isLoaded: () => boolean;
    subscribe: (listener: () => void) => () => void;
}
type Kept<T> = {
    value: T;
    /** What is kept on the phone has been read. Until then the value is the empty one, and changes are refused. */
    ready: boolean;
    /** Reading what is kept failed. It must not be taken for "nothing kept": try again. */
    failed: boolean;
    retry: () => void;
};
/**
 * What a keeper holds, as a screen reads it. Reads it from the phone once, then follows every change, whichever screen
 * made it. A failed read is reported, never turned into an empty list.
 */
declare function useKept<T>(keeper: KeptSource<T>): Kept<T>;

/**
 * Asks a sender to send what is waiting: when the screen opens, every so often while it is open, and whenever the app
 * comes back to the front. The sender itself makes sure only one send runs at a time, so asking too often is harmless.
 */
declare function useFlushLoop(flush: () => Promise<unknown>, options?: {
    everyMs?: number;
    enabled?: boolean;
}): void;

type ItemSearchFailure = 'network' | 'unreadable';
type ItemSearch = {
    query: string;
    setQuery: (text: string) => void;
    items: StockItem[];
    loading: boolean;
    failed: ItemSearchFailure | null;
    total: number | null;
    more: boolean;
    loadMore: () => void;
    reload: () => void;
    /** Looks one scanned code up now. The items the server found, or null when it could not be asked or did not make sense. */
    lookup: (barcode: string) => Promise<StockItem[] | null>;
};
/**
 * The items of one branch, by name, code or barcode, a page at a time. Answers that arrive after a newer question was
 * asked are ignored, so a slow answer to "su" never replaces the answer to "sugar". A failed read says so; it never shows
 * as "no items".
 */
declare function useItemSearch(api: ApiClient, branchId: string, options?: {
    lowStock?: boolean;
    zeroStock?: boolean; /** Narrow to one category or department. */
    categoryId?: string; /** Narrow to one department (an item type). */
    itemTypeId?: string; /** Ask nothing until something is typed. */
    idle?: boolean;
}): ItemSearch;

/** Draws the camera and calls `onBarcode` for each code it reads. Passed in by the apps that ship the camera module. */
type ScannerRenderer = (props: {
    onBarcode: (value: string) => void;
    onClose: () => void;
}) => React.ReactElement;
type ItemFilter = 'all' | 'low' | 'out';
type Props$2 = {
    api: ApiClient;
    branchId: string;
    onPick: (item: StockItem) => void;
    /** Take one unit out of the basket for this item (cards only). */
    onRemove?: (item: StockItem) => void;
    renderScanner?: ScannerRenderer;
    /** Offer "Low" and "Out" beside "All". */
    withFilters?: boolean;
    /** Which filter is chosen when the finder opens. */
    initialFilter?: ItemFilter;
    /** Show nothing until something is typed. */
    idle?: boolean;
    /** Draw the items as the till's glossy tiles, instead of a list of rows. */
    cards?: boolean;
    /** How many tiles share a row. Two leaves room for a photo and a full name. */
    columns?: 2 | 3;
    /** Lines a tile name may use before it is cut. */
    nameLines?: number;
    /** Pinned above the shelf when nothing is being searched — the shop's best sellers. */
    featured?: StockItem[];
    /** Narrow the shelf to one category or department. The server does the narrowing. */
    categoryId?: string;
    /** Narrow the shelf to one department (an item type). */
    itemTypeId?: string;
    /** How many of each product are already in the basket, by item id. Cards show the count. */
    inBasket?: Record<string, number>;
    /** Bump this to put the cursor in the search field (the header's "Add item"). */
    focusSignal?: number;
    /** Draw the small filter circle inside the search field; it cycles in stock / low / all. */
    showFilter?: boolean;
    /** Float an add button over the grid's foot: scans when a camera is available, else goes to the field. */
    showAdd?: boolean;
    /** The app's accent, for the filter circle and the add button. */
    accent?: string;
    /** Where a card was on screen when it was tapped, for a flight to the basket. */
    onPickRect?: (rect: {
        x: number;
        y: number;
        w: number;
        h: number;
        name: string;
    }) => void;
    /** Keep the camera open after each scan, so a basket can be scanned in one go. */
    continuous?: boolean;
    /** Said under the camera after each scan in `continuous` mode. */
    scanNote?: string | null;
    /** How loudly `scanNote` is said: `warn` for a scan that did not go in. */
    scanTone?: 'ok' | 'warn';
    placeholder?: string;
};
/**
 * Finds items by name, code or barcode and hands the one that was tapped or scanned to `onPick`. It reads the shop's
 * items as they are now: a failed read is said to be one, never shown as "no items".
 */
declare function ItemPicker({ api, branchId, onPick, onRemove, renderScanner, withFilters, initialFilter, idle, continuous, scanNote, scanTone, placeholder, cards, columns, nameLines, featured, categoryId, itemTypeId, onPickRect, inBasket, focusSignal, showFilter, showAdd, accent, }: Props$2): react_jsx_runtime.JSX.Element;

/**
 * The server calls that read an item and change its stock, each with a limit on how long the app waits. A change is
 * sent once. Its answer may be lost, and the screens then look at the item before doing anything else: the server does
 * not read an Idempotency-Key on these routes, so a repeat would be applied twice.
 */
/** One item as it is now at this branch. Null when the answer is not an item. Throws when the server cannot be reached. */
declare function fetchFreshItem(api: ApiClient, branchId: string, itemId: string): Promise<StockItem | null>;
/** The most entries the server's item history gives (it cuts any larger ask down to this). */
declare const HISTORY_LIMIT = 100;
/** An item's recent stock history, and how far back it reaches. Null when the answer is not a history. Throws when the server cannot be reached. */
declare function fetchHistory(api: ApiClient, itemId: string, limit?: number): Promise<ItemHistory | null>;
declare function postStockIncrease(api: ApiClient, body: unknown): Promise<unknown>;
declare function fetchAllocation(api: ApiClient, itemId: string, branchId: string, units: number): Promise<unknown>;
declare function postBatchDecrease(api: ApiClient, body: unknown): Promise<unknown>;
declare function postWastage(api: ApiClient, body: unknown): Promise<unknown>;

declare function describeUnsent(unsent: UnsentSummary): string;
/**
 * Asks whether to go ahead when the store being left still holds sales that were never sent. They
 * stay on the phone, in that store's own queue, and are sent the next time the person signs in to it.
 */
declare function confirmLeavingUnsent(unsent: UnsentSummary, storeName?: string): Promise<boolean>;
/**
 * Asks whether to sign out while the shop still holds sales that were never sent. Whoever signs in next on this
 * phone sends them, and the server records a sale for the person whose session sent it, in that person's shift.
 */
declare function confirmSigningOutWithUnsent(unsent: UnsentSummary, storeName?: string): Promise<boolean>;
/** Whether to go ahead and sign out: nothing is asked when nothing is waiting to be sent. */
declare function confirmSignOut(storeName?: string): Promise<boolean>;
/** Leaves the active store for the store picker. Returns whether the person actually left. */
declare function leaveStore(storeName?: string): Promise<boolean>;

interface TenantEntryScreenProps {
    baseURL: string;
    appTitle: string;
    onTenantResolved: (tenant: TenantContext) => void;
}
declare function TenantEntryScreen({ baseURL, appTitle, onTenantResolved }: TenantEntryScreenProps): react_jsx_runtime.JSX.Element;

interface PinLoginScreenProps {
    baseURL: string;
    branchId: string;
    onSuccess: (branches?: BranchOption[]) => void;
    allowPassword?: boolean;
    storeName?: string | null;
    branchName?: string | null;
    onBack?: () => void;
    onChangeStore?: () => void;
}
/**
 * @deprecated No app uses this any more: `StaffShell` signs people in (`SignInScreen`), asks the server who they
 * are, and finds their branch. Kept exported until a release has gone out without it; it still sends the branch
 * chosen before sign-in and shows server errors in a system dialog.
 */
declare function PinLoginScreen({ baseURL, branchId, onSuccess, allowPassword, storeName, branchName, onBack, onChangeStore, }: PinLoginScreenProps): react_jsx_runtime.JSX.Element;

interface BranchSelectScreenProps {
    branches: BranchOption[];
    onSelect: (branch: BranchOption) => void;
    storeName?: string | null;
    onChangeStore?: () => void;
    /** The heading. Defaults to "Select branch". */
    title?: string;
    /** The label of the way out at the top. Defaults to "Change store"; after sign-in it is "Sign out". */
    backLabel?: string;
}
declare function BranchSelectScreen({ branches, onSelect, storeName, onChangeStore, title, backLabel, }: BranchSelectScreenProps): react_jsx_runtime.JSX.Element;

interface WhiteLabelErrorScreenProps {
    message: string;
    onRetry: () => void;
}
declare function WhiteLabelErrorScreen({ message, onRetry }: WhiteLabelErrorScreenProps): react_jsx_runtime.JSX.Element;

type Props$1 = {
    api: ApiClient;
    branchId: string;
    renderScanner?: ScannerRenderer;
    itemId?: string;
    /** Drawn inside a sheet: no page wash of its own, and tighter padding, because the sheet already frames it. */
    inline?: boolean;
};
/**
 * Set how many of one item are on the shelf. Pick the item, type the count, review, then confirm.
 * The change is checked against the shelf once more just before it is sent.
 */
declare function SetStockScreen({ api, branchId, renderScanner, itemId, inline }: Props$1): react_jsx_runtime.JSX.Element;

type Props = {
    api: ApiClient;
    tenantId: string;
    branchId: string;
    /** The signed-in person. A list belongs to them. */
    ownerId: string;
    renderScanner?: ScannerRenderer;
    /** Open with this item ready to be added. */
    addItem?: StockItem;
};
/**
 * A list of stock to write off, and the sending of it. A write-off cannot be recomputed or repeated: the server does not
 * recognise a request it has seen, so a write-off sent twice is taken off twice. So before each one is sent the screen
 * reads the item's history and writes down, on this phone, what it held and what is about to be sent. If the answer is
 * lost (a dead signal, a closed app), the record is what lets the screen look at the history afterwards and say whether
 * the write-off happened. It is never sent a second time on a guess.
 */
declare function SpoilsScreen({ api, tenantId, branchId, ownerId, renderScanner, addItem }: Props): react_jsx_runtime.JSX.Element;

interface PairScannerProps {
    /** The text of a QR code the camera read. */
    onScanned: (text: string) => void;
    onCancel: () => void;
}
/** Draws the camera. Only apps that ship the camera module give one; the others type the code. */
type PairScannerRenderer = (props: PairScannerProps) => React.ReactNode;

/** What an app gets once the person is signed in, fits the app, and is at a branch. */
interface StaffSession {
    api: ApiClient;
    tenant: TenantContext;
    user: StaffUser;
    branchId: string;
    branchName: string | null;
    /** The shop runs without shifts: the till never asks the person to open one (plan §5.6). */
    shiftsDisabled: boolean;
    /**
     * Ends the session on this phone, then shows the sign-in screen. Works with no connection. Resolves true once the
     * session has ended, and false when it did not: the person was asked about unsent sales and chose to stay signed in.
     */
    signOut: () => Promise<boolean>;
}
interface StaffShellProps {
    app: StaffApp;
    baseURL: string;
    /** A password beside the PIN (the Cashier and Admin offer it). */
    allowPassword?: boolean;
    /** This phone works as a till (the Cashier): ask whether it is still a registered one. */
    isTill?: boolean;
    /** Saves the sales that were never sent as text the person can keep. Passed by the Cashier. */
    exportUnsent?: () => Promise<void>;
    /** The shop has taken this phone off as a till: the app lets go of what it kept for that shop. Must not throw. */
    onRemoved?: (shopId: string) => void | Promise<void>;
    /** Draws the camera for the pairing QR. Only apps that ship the camera module pass it; the rest type the code. */
    renderScanner?: PairScannerRenderer;
    children: (session: StaffSession) => React.ReactNode;
}
/**
 * One way into every staff app (plan §5.11, §5.12): find the shop, sign in with a PIN, learn who the
 * person is from the server, check the app fits them, work out the branch, and only then open the app.
 * The four apps used to carry their own copy of this; they now render their screens inside it.
 */
declare function StaffShell({ app, baseURL, allowPassword, isTill, exportUnsent, onRemoved, renderScanner, children }: StaffShellProps): react_jsx_runtime.JSX.Element;

/** The counter's typeface, ready for `useFonts`: the same files every staff app is set in. */
declare const DM_SANS: {
    DMSans_400Regular: any;
    DMSans_500Medium: any;
    DMSans_600SemiBold: any;
    DMSans_700Bold: any;
};

export { BRAND, BranchSelectScreen, CardGloss, DM_SANS, ELEVATION, FONT, type Flight, FlyToCart, GUTTER, Gloss, HAIRLINE, HISTORY_LIMIT, HeroMetric, type ItemFilter, ItemPicker, type ItemSearch, type ItemSearchFailure, JAKARTA, type Kept, type KeptSource, MART, MOTION, MartButton, type MartPalette, MartText, MiniTile, ON_BRAND, type OnFill, type PairScannerProps, type PairScannerRenderer, PinLoginScreen, PressableScale, RADIUS, SETTLE, SHADOW, SPACE, SPRING, type ScannerRenderer, Screen, SectionHead, SetStockScreen, Sheet, ShelfTile, type ShelfTileItem, Sparkline, SpoilsScreen, type StaffBootPhase, type StaffSession, StaffShell, type StaffShellProps, StatTile, TILE, TYPE, TenantEntryScreen, Tile, type UiTypeface, VerifiedBadge, WEIGHT, WeightSheet, WhiteLabelErrorScreen, ZONE, confirmLeavingUnsent, confirmSignOut, confirmSigningOutWithUnsent, describeUnsent, fetchAllocation, fetchFreshItem, fetchHistory, leaveStore, martFromTenant, onFill, postBatchDecrease, postStockIncrease, postWastage, setUiFace, setUiTypeface, tint, useAuthStore, useFlushLoop, useItemSearch, useKept, useStaffAuthNavigation, useStaffBoot, zoneFor };

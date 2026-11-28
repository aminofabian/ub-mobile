import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

/** A mark for an aisle or department that has no picture of its own, read from its name. */
export function aisleIcon(label: string | null | undefined): IconName {
  const text = label ?? '';
  if (/drink|beverage|water|juice|soda|dairy|milk/i.test(text)) return 'cafe';
  if (/house|clean|essent|hygiene|home|household/i.test(text)) return 'sparkles';
  if (/station|office|paper|pen|electronic/i.test(text)) return 'pencil';
  if (/snack|bite|cookie|candy|bakery|cereal|bread/i.test(text)) return 'fast-food';
  if (/liquor|wine|spirit|alcohol|beer/i.test(text)) return 'wine';
  if (/cloth|fashion|wear|appar/i.test(text)) return 'shirt';
  if (/beauty|care|baby|health/i.test(text)) return 'flower';
  if (/fruit|veg|fresh|produce/i.test(text)) return 'leaf';
  if (/meat|fish|butcher|chicken/i.test(text)) return 'restaurant';
  if (/grocery|general|retail|food/i.test(text)) return 'basket';
  return 'cube';
}

/** "SOFT DRINKS" and "soft drinks" both read "Soft Drinks". Short all-caps words (TV, UK) stay. */
export function titleCase(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .map((word) =>
      word.length <= 2 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(' ');
}

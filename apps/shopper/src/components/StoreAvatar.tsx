import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Text } from 'react-native';
import { FONT, MART, onFill, zoneFor } from '../theme/mart';
import type { StoreCardView } from '../lib/store-card';
import { Lobe, lobeIndex } from './Coast';

/**
 * A shop's mark: a lobe in the shop's own colour with its first letter, or its logo resting on a quiet
 * lobe. A shop with no colour of its own takes a zone colour, and always the same one.
 */
export function StoreAvatar({ card, size = 44 }: { card: StoreCardView; size?: number }) {
  const [failed, setFailed] = useState(false);
  const key = card.address || card.name;
  const shape = lobeIndex(key);

  if (card.logoUrl && !failed) {
    const inner = Math.round(size * 0.6);
    return (
      <Lobe color={MART.paperSunken} size={size} shape={shape}>
        <Image
          source={{ uri: card.logoUrl }}
          style={{ width: inner, height: inner }}
          contentFit="contain"
          transition={160}
          onError={() => setFailed(true)}
          accessible={false}
        />
      </Lobe>
    );
  }

  // A shop may send a three-digit colour; the ink is worked out from six.
  const sent = card.color && card.color.length === 4 ? `#${card.color[1]}${card.color[1]}${card.color[2]}${card.color[2]}${card.color[3]}${card.color[3]}` : card.color;
  const fill = sent ?? zoneFor(key);
  return (
    <Lobe color={fill} size={size} shape={shape}>
      <Text
        style={{
          fontFamily: FONT.black,
          fontSize: Math.round(size * 0.42),
          lineHeight: Math.round(size * 0.52),
          color: onFill(fill).primary,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {card.monogram}
      </Text>
    </Lobe>
  );
}

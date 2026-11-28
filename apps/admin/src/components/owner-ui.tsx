import React, { useEffect } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HAIRLINE, MART, RADIUS, SHADOW, SPACE, TYPE, tint, zoneFor } from '../theme/mart';
import { MartButton, MartText, PressableScale } from '../theme/mart-ui';
import type { Loaded } from '../lib/loaded';
import type { TileView, Tone } from '../lib/today';

type IconName = keyof typeof Ionicons.glyphMap;

/** An icon keyed off a label, so a tile or row keeps the same mark everywhere it appears. */
function iconFor(label: string): IconName {
  const l = label.toLowerCase();
  if (l.includes('on the web')) return 'globe-outline';
  if (l.includes('takings')) return 'cash-outline';
  if (l.includes('till')) return 'desktop-outline';
  if (l.includes('supplier')) return 'receipt-outline';
  if (l.includes('order')) return 'cart-outline';
  if (l.includes('receive') || l.includes('delivery') || l.includes('stock')) return 'cube-outline';
  if (l.includes('owed') || l.includes('credit')) return 'wallet-outline';
  if (l.includes('report') || l.includes('overview')) return 'bar-chart-outline';
  if (l.includes('staff') || l.includes('people')) return 'people-outline';
  if (l.includes('setting')) return 'settings-outline';
  return 'globe-outline';
}

/**
 * The few pieces the Owner screens need that the mart set does not have yet: a notice, a figure tile that knows when
 * it is loading or not allowed, a tappable row, a chip, a switch between two or three choices, a field. They are built
 * from the mart tokens and `MartText`, so they follow the same look, and they live in their own file so the mart set
 * can keep changing underneath without touching them.
 */

/**
 * A section title with a short accent rule beside it, so headings read as deliberate dividers rather than
 * floating bold text. The rule is keyed off the words, so the same section keeps its colour.
 */
export function SectionHead({ children, accent }: { children: string; accent?: string }) {
  const bar = accent ?? zoneFor(children);
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionBar, { backgroundColor: bar }]} />
      <MartText variant="heading" accessibilityRole="header">
        {children}
      </MartText>
    </View>
  );
}

/** A white surface that holds a form or summary. The soft lift, shared, so every panel on every screen matches. */
export function Panel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/** "just now", "3m", "2h": how long ago a sale rang, kept short so it sits at the end of a row. */
function timeAgo(ms: number | null, now: number): string {
  if (ms === null) return '';
  const secs = Math.max(0, Math.round((now - ms) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** The green dot for M-Pesa, orange for cash, grey otherwise — matching the takings split. */
function methodColor(method: string | null): string {
  const l = (method ?? '').toLowerCase();
  if (l.includes('pesa') || l.includes('stk')) return MART.success;
  if (l.includes('cash')) return MART.fallbackAccent;
  return MART.inkQuiet;
}

export type SaleLine = {
  id: string;
  soldAt: number | null;
  itemName: string;
  quantity: number | null;
  amount: string;
  cashierName: string | null;
  method: string | null;
};

/**
 * The live sales tape: the newest sales, each a quiet row with the item, how much, who rang it and when.
 * Reads more often than the figures above it, so a sale shows up here within a few seconds of being made.
 */
export function RecentSalesFeed({ sales, now = Date.now() }: { sales: SaleLine[]; now?: number }) {
  if (sales.length === 0) {
    return (
      <Panel style={styles.feedEmpty}>
        <Ionicons name="pulse-outline" size={18} color={MART.inkQuiet} />
        <MartText variant="meta" color={MART.inkQuiet}>
          No sales yet today — they appear here as they are made.
        </MartText>
      </Panel>
    );
  }
  return (
    <Panel style={{ gap: 0 }}>
      {sales.map((s, i) => (
        <View key={`${s.id}:${s.itemName}:${i}`} style={[styles.feedRow, i > 0 && styles.feedRowRule]}>
          <View style={[styles.feedDot, { backgroundColor: methodColor(s.method) }]} />
          <View style={{ flex: 1, gap: SPACE.xxs }}>
            <MartText variant="label" numberOfLines={1}>
              {s.quantity && s.quantity !== 1 ? `${s.quantity} × ` : ''}
              {s.itemName}
            </MartText>
            <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
              {[s.cashierName, s.method].filter(Boolean).join(' · ') || '—'}
            </MartText>
          </View>
          <View style={{ alignItems: 'flex-end', gap: SPACE.xxs }}>
            <MartText variant="price">{s.amount}</MartText>
            <MartText variant="meta" color={MART.inkQuiet}>
              {timeAgo(s.soldAt, now)}
            </MartText>
          </View>
        </View>
      ))}
    </Panel>
  );
}

/**
 * The top of a screen, the same shape everywhere: a small eyebrow over a large title, with room for a
 * trailing mark. Gives each screen one strong, anchored headline instead of a stray line of bold text.
 */
export function ScreenHeader({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow?: string | null;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1, gap: SPACE.xxs }}>
        {eyebrow ? (
          <MartText variant="shelf" color={MART.inkQuiet} style={{ letterSpacing: 0.8 }}>
            {eyebrow.toUpperCase()}
          </MartText>
        ) : null}
        <MartText variant="display" numberOfLines={2}>
          {title}
        </MartText>
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
}

export type NoticeTone = 'ok' | 'warn' | 'bad' | 'info';

const NOTICE_LOOK: Record<NoticeTone, { surface: string; ink: string; icon: IconName }> = {
  ok: { surface: MART.successSurface, ink: MART.success, icon: 'checkmark-circle-outline' },
  warn: { surface: MART.warningSurface, ink: MART.warning, icon: 'alert-circle-outline' },
  bad: { surface: MART.dangerSurface, ink: MART.danger, icon: 'close-circle-outline' },
  info: { surface: MART.infoSurface, ink: MART.info, icon: 'information-circle-outline' },
};

/**
 * Says words aloud to a screen reader when they appear or change. iOS does not read an "alert" role by itself, so it is
 * told; Android reads a live region, which the notice sets, so it is not told twice.
 */
function useAnnounced(children: React.ReactNode) {
  const words = typeof children === 'string' ? children : null;
  useEffect(() => {
    if (words && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(words);
  }, [words]);
}

/**
 * A button that tells a screen reader what it is while it works. The mart button swaps its label for a spinner, which
 * left "Record payment" with no name at the moment it mattered most; this keeps the label and says it is busy.
 */
export function OwnerButton(props: React.ComponentProps<typeof MartButton>) {
  const busy = props.busy === true;
  return <MartButton accessibilityLabel={props.label} accessibilityState={{ busy, disabled: props.disabled === true || busy }} {...props} />;
}

/** A line the person has to read: what happened, or what could not. The words are ink; the colour only says how serious. */
export function Notice({ tone, children, action }: { tone: NoticeTone; children: React.ReactNode; action?: { label: string; onPress: () => void } }) {
  const look = NOTICE_LOOK[tone];
  useAnnounced(children);
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: look.surface }]}>
      <View style={styles.noticeRow}>
        <Ionicons name={look.icon} size={18} color={look.ink} style={{ marginTop: 1 }} />
        <MartText variant="label" style={styles.noticeText}>
          {children}
        </MartText>
      </View>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={SPACE.md} style={styles.noticeAction}>
          <MartText variant="label" color={look.ink} style={styles.noticeActionText}>
            {action.label}
          </MartText>
        </Pressable>
      ) : null}
    </View>
  );
}

const TONE_DOT: Record<Tone, string> = {
  ok: MART.success,
  ask: MART.fallbackAccent,
  warn: MART.warning,
  quiet: MART.inkQuiet,
};

/** A loading placeholder that breathes: a slow opacity pulse, so a waiting screen reads as alive, not frozen. */
function Bone({ width, height }: { width: number | `${number}%`; height: number }) {
  const pulse = React.useRef(new Animated.Value(0.5)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={{ width, height, borderRadius: RADIUS.sm, backgroundColor: MART.paperSunken, opacity: pulse }} />;
}

/**
 * One figure on Today. It says what it is while it loads, what it shows when it has it, and why it shows nothing when
 * the person's role may not see it or the server could not be asked. A figure that could not be refreshed stays on the
 * screen, marked as old.
 */
export function NumberTile(props: {
  label: string;
  zoneKey?: string;
  state: Loaded<TileView>;
  onPress?: () => void;
  onRetry: () => void;
  wide?: boolean;
}) {
  return props.wide ? <HeroTile {...props} /> : <CompactTile {...props} />;
}

type TileProps = {
  label: string;
  zoneKey?: string;
  state: Loaded<TileView>;
  onPress?: () => void;
  onRetry: () => void;
};

/** A steady colour per payment method so M-Pesa and cash read the same on every refresh. */
function splitColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('pesa')) return MART.success;
  if (l.includes('cash')) return MART.fallbackAccent;
  return MART.inkQuiet;
}

function spokenFor(label: string, state: Loaded<TileView>): string {
  return state.state === 'ok'
    ? `${label}: ${state.value.value}${state.value.note ? `. ${state.value.note}` : ''}${state.stale ? '. Out of date.' : ''}`
    : state.state === 'loading'
      ? `${label}: loading`
      : `${label}: ${state.words}`;
}

/**
 * The screen's lead figure — today's takings. A clean white card: a small eyebrow label with the figure's
 * mark, then the number large in ink, a quiet note and a real today-vs-yesterday move. No fill, no shadow —
 * the size of the number is what makes it the headline.
 */
function HeroTile({ label, state, onPress, onRetry }: TileProps) {
  const press = state.state === 'failed' ? onRetry : state.state === 'ok' ? onPress : undefined;
  const green = MART.fallbackPrimary;
  const trend = state.state === 'ok' ? state.value.trend ?? null : null;
  const trendColor = trend?.dir === 'down' ? MART.danger : trend?.dir === 'up' ? MART.success : MART.inkQuiet;
  const trendIcon: IconName = trend?.dir === 'down' ? 'trending-down' : trend?.dir === 'up' ? 'trending-up' : 'remove';
  return (
    <PressableScale
      accessibilityRole={press ? 'button' : 'text'}
      accessibilityLabel={spokenFor(label, state)}
      disabled={!press}
      onPress={press}
      style={styles.hero}
    >
      <View style={styles.heroHead}>
        <View style={styles.heroHeadLeft}>
          <View style={[styles.heroMark, { backgroundColor: tint(green, 0.1) }]}>
            <Ionicons name={iconFor(label)} size={16} color={green} />
          </View>
          <MartText variant="shelf" color={MART.inkQuiet} numberOfLines={1}>
            {label.toUpperCase()}
          </MartText>
        </View>
        {press ? <Ionicons name="chevron-forward" size={18} color={MART.inkQuiet} /> : null}
      </View>

      {state.state === 'loading' ? (
        <View style={{ gap: SPACE.sm, marginTop: SPACE.sm }}>
          <Bone width="62%" height={38} />
          <Bone width="44%" height={14} />
        </View>
      ) : null}

      {state.state === 'ok' ? (
        <View style={{ gap: SPACE.sm }}>
          <Text style={[styles.heroValue, { color: MART.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {state.value.value}
          </Text>
          <View style={styles.heroFooter}>
            {state.value.note ? (
              <MartText variant="meta" color={MART.inkMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {state.value.note}
              </MartText>
            ) : null}
            {trend ? (
              <View style={styles.heroTrend} accessibilityLabel={trend.spoken}>
                <Ionicons name={trendIcon} size={13} color={trendColor} />
                <MartText variant="shelf" color={trendColor} numberOfLines={1}>
                  {trend.label}
                </MartText>
              </View>
            ) : null}
          </View>
          {state.value.breakdown && state.value.breakdown.length > 0 ? (
            <View style={styles.heroSplit}>
              {state.value.breakdown.map((line) => (
                <View key={line.label} style={styles.heroSplitRow}>
                  <View style={[styles.heroSplitDot, { backgroundColor: splitColor(line.label) }]} />
                  <MartText variant="meta" color={MART.inkMuted} style={{ flex: 1 }} numberOfLines={1}>
                    {line.label}
                    {line.count !== null ? `  ·  ${line.count}` : ''}
                  </MartText>
                  <MartText variant="label" color={MART.ink} numberOfLines={1}>
                    {line.value}
                  </MartText>
                </View>
              ))}
            </View>
          ) : null}
          {state.stale ? (
            <MartText variant="meta" color={MART.warning}>
              Could not refresh. This is the last answer.
            </MartText>
          ) : null}
        </View>
      ) : null}

      {state.state === 'denied' ? (
        <MartText variant="meta" color={MART.inkMuted}>
          {state.words}
        </MartText>
      ) : null}

      {state.state === 'failed' ? (
        <View style={{ gap: SPACE.xs }}>
          <MartText variant="meta" color={MART.inkMuted}>
            {state.words}
          </MartText>
          <MartText variant="label" color={MART.fallbackPrimary}>
            Tap to try again
          </MartText>
        </View>
      ) : null}
    </PressableScale>
  );
}

/** A supporting figure: an icon chip keyed to the tile, the number in title weight, a quiet note, and a chevron when it opens something. */
function CompactTile({ label, zoneKey, state, onPress, onRetry }: TileProps) {
  const press = state.state === 'failed' ? onRetry : state.state === 'ok' ? onPress : undefined;
  const accent = state.state === 'ok' ? TONE_DOT[state.value.tone] : zoneFor(zoneKey ?? label);
  return (
    <PressableScale
      accessibilityRole={press ? 'button' : 'text'}
      accessibilityLabel={spokenFor(label, state)}
      disabled={!press}
      onPress={press}
      style={[styles.tile, styles.tileHalf]}
    >
      <View style={styles.tileHead}>
        <View style={[styles.tileIcon, { backgroundColor: tint(accent, 0.16) }]}>
          <Ionicons name={iconFor(label)} size={16} color={accent} />
        </View>
        {press ? <Ionicons name="chevron-forward" size={16} color={MART.inkQuiet} /> : null}
      </View>

      <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
        {label}
      </MartText>

      {state.state === 'loading' ? (
        <View style={{ gap: SPACE.xs }}>
          <Bone width="55%" height={24} />
          <Bone width="40%" height={13} />
        </View>
      ) : null}
      {state.state === 'ok' ? (
        <View style={{ gap: SPACE.xxs }}>
          <Text style={[TYPE.title, { color: MART.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {state.value.value}
          </Text>
          {state.value.note ? (
            <MartText variant="meta" color={MART.inkMuted} numberOfLines={2}>
              {state.value.note}
            </MartText>
          ) : null}
          {state.stale ? (
            <MartText variant="meta" color={MART.warning}>
              Could not refresh. This is the last answer.
            </MartText>
          ) : null}
        </View>
      ) : null}
      {state.state === 'denied' ? (
        <MartText variant="meta" color={MART.inkMuted}>
          {state.words}
        </MartText>
      ) : null}
      {state.state === 'failed' ? (
        <View style={{ gap: SPACE.xxs }}>
          <MartText variant="meta" color={MART.inkMuted}>
            {state.words}
          </MartText>
          <MartText variant="label" color={MART.info}>
            Tap to try again
          </MartText>
        </View>
      ) : null}
    </PressableScale>
  );
}

/** A white card on the water that can be tapped. A leading mark, then the title and its second line; a chevron when it opens something. */
export function Row({
  title,
  subtitle,
  right,
  icon,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
  icon?: IconName;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const label = accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title);
  const mark = icon ?? iconFor(title);
  const content = (
    <>
      <View style={[styles.rowMark, { backgroundColor: tint(MART.fallbackPrimary, 0.1) }]}>
        <Ionicons name={mark} size={20} color={MART.fallbackPrimary} />
      </View>
      <View style={{ flex: 1, gap: SPACE.xxs }}>
        <MartText variant="heading" numberOfLines={2}>
          {title}
        </MartText>
        {subtitle ? (
          <MartText variant="meta" color={MART.inkMuted} numberOfLines={2}>
            {subtitle}
          </MartText>
        ) : null}
      </View>
      {right ? (
        <View style={{ alignItems: 'flex-end', gap: SPACE.xs }}>{right}</View>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={MART.inkQuiet} />
      ) : null}
    </>
  );
  // A row nobody can tap is read as text, not as a button that is switched off.
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

export type ChipTone = 'ask' | 'ok' | 'quiet' | 'warn' | 'bad';

const CHIP_SURFACE: Record<ChipTone, string> = {
  ask: tint(MART.fallbackAccent, 0.22),
  ok: MART.successSurface,
  quiet: MART.paperSunken,
  warn: MART.warningSurface,
  bad: MART.dangerSurface,
};

/** A short status in a capsule: the words carry the meaning, the colour only says how loud it is. */
export function Chip({ label, tone = 'quiet' }: { label: string; tone?: ChipTone }) {
  return (
    <View style={[styles.chip, { backgroundColor: CHIP_SURFACE[tone] }]}>
      <MartText variant="shelf">{label}</MartText>
    </View>
  );
}

/** A choice between a few things, one of them always chosen. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  disabled?: boolean;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.segmented}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: disabled === true }}
            disabled={disabled}
            onPress={() => onChange(option.key)}
            style={[styles.segment, selected && styles.segmentSelected, disabled === true && { opacity: 0.55 }]}
          >
            <MartText variant="label" color={selected ? MART.ink : MART.inkMuted}>
              {option.label}
            </MartText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A labelled text box: a calm capsule that gains an ink outline when it has focus, a red one when its value will not do. */
export function Field({ label, error, style, icon, onFocus, onBlur, ...input }: TextInputProps & { label: string; error?: string | null; icon?: IconName }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: SPACE.sm }}>
      <MartText variant="label" color={MART.ink} style={{ marginLeft: SPACE.xs }}>
        {label}
      </MartText>
      <View style={[styles.field, focused && styles.fieldFocused, error ? styles.fieldInvalid : null]}>
        {icon ? <Ionicons name={icon} size={20} color={MART.inkMuted} /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={MART.inkQuiet}
          selectionColor={MART.ink}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...input}
          style={[styles.fieldInput, style]}
        />
      </View>
      {error ? (
        <MartText variant="meta" color={MART.danger} style={{ marginLeft: SPACE.xs }}>
          {error}
        </MartText>
      ) : null}
    </View>
  );
}

/** What a list says when it has nothing to show, or could not be had. An icon gives the empty space a centre of gravity. */
export function Message({ title, body, action, icon }: { title: string; body?: string | null; action?: { label: string; onPress: () => void }; icon?: IconName }) {
  const mark = icon ?? 'sparkles-outline';
  return (
    <View style={styles.message}>
      <View style={[styles.messageBadge, { backgroundColor: tint(MART.fallbackPrimary, 0.1) }]}>
        <Ionicons name={mark} size={28} color={MART.fallbackPrimary} />
      </View>
      <MartText variant="title" style={{ textAlign: 'center' }}>
        {title}
      </MartText>
      {body ? (
        <MartText variant="body" color={MART.inkMuted} style={{ textAlign: 'center', maxWidth: 300 }}>
          {body}
        </MartText>
      ) : null}
      {action ? <OwnerButton label={action.label} kind="quiet" onPress={action.onPress} /> : null}
    </View>
  );
}

/** Grey bars where a list is on its way. */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: SPACE.md }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.row, { minHeight: 72 }]}>
          <View style={{ flex: 1, gap: SPACE.sm }}>
            <Bone width="55%" height={18} />
            <Bone width="35%" height={13} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    gap: SPACE.sm,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.sm,
  },
  noticeText: {
    flex: 1,
    color: MART.ink,
  },
  noticeAction: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
    marginLeft: SPACE.lg + SPACE.sm,
  },
  noticeActionText: {
    textDecorationLine: 'underline',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  // A section title: a short accent rule, then the words.
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  sectionBar: {
    width: 4,
    height: 18,
    borderRadius: RADIUS.pill,
  },
  // The shared white surface for forms and summaries: soft lift, no hard border.
  panel: {
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    ...HAIRLINE,
    ...SHADOW.card,
  },
  feedEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
  },
  feedRowRule: {
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  feedDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.pill,
  },
  messageBadge: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.xs,
  },
  // The press feedback the whole set shares: a small, instant scale-down that says "heard you".
  pressedScale: {
    transform: [{ scale: 0.97 }],
    opacity: 0.96,
  },
  // The lead figure: a clean white card, set apart by a hairline, not a fill.
  hero: {
    minHeight: 128,
    flexBasis: '100%',
    flexGrow: 1,
    padding: SPACE.xl,
    borderRadius: RADIUS.xl,
    gap: SPACE.lg,
    backgroundColor: MART.paperElevated,
    ...SHADOW.hero,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  heroHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    flexShrink: 1,
  },
  heroMark: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroValue: { ...TYPE.hero },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
  },
  heroTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxs,
  },
  // The M-Pesa / cash split under today's takings: a hairline off, then a quiet line per method.
  heroSplit: {
    marginTop: SPACE.sm,
    paddingTop: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: MART.border,
    gap: SPACE.sm,
  },
  heroSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  heroSplitDot: {
    width: 7,
    height: 7,
    borderRadius: RADIUS.pill,
  },
  tile: {
    // Tall enough to hold a two-line note, so a one-line and a two-line tile in the same row match.
    minHeight: 124,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    gap: SPACE.xs,
    backgroundColor: MART.paperElevated,
    ...HAIRLINE,
    ...SHADOW.card,
  },
  tileHalf: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.pill,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    ...HAIRLINE,
    ...SHADOW.card,
  },
  rowMark: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.md,
  },
  segmentSelected: {
    backgroundColor: MART.paperElevated,
    shadowColor: MART.ink,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  field: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  fieldFocused: {
    borderColor: MART.ink,
  },
  fieldInvalid: {
    borderColor: MART.danger,
  },
  fieldInput: {
    ...TYPE.body,
    lineHeight: undefined,
    flex: 1,
    minHeight: 50,
    paddingVertical: 0,
    color: MART.ink,
  },
  message: {
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.xxxl,
    paddingHorizontal: SPACE.xl,
  },
});

import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { MART, RADIUS, SPACE, TYPE } from './mart';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * The app's text field: a white capsule on the water (a rounded tile when it takes several lines).
 * It gains an ink outline when it has focus and a red one, with the reason underneath, when what is
 * in it will not do. Takes every `TextInput` prop.
 */
export const Field = forwardRef<
  TextInput,
  TextInputProps & {
    label?: string;
    /** Help that is always there, under the field. */
    hint?: string | null;
    /** Why the value will not do. Replaces the hint and is announced. */
    error?: string | null;
    icon?: IconName;
    /** Fixed text before the value, such as "+254". */
    prefix?: string;
    /** A control at the trailing edge, such as a clear or show-password chip. */
    trailing?: React.ReactNode;
    /** The colour of the surface behind the field; the field turns cream on a white tile. */
    on?: 'water' | 'tile';
    containerStyle?: StyleProp<ViewStyle>;
  }
>(function Field(
  { label, hint, error, icon, prefix, trailing, on = 'water', containerStyle, style, multiline, onFocus, onBlur, ...input },
  ref
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          multiline && styles.multiline,
          { backgroundColor: on === 'tile' ? MART.paper : MART.paperElevated },
          focused && styles.focused,
          error ? styles.invalid : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={20} color={MART.inkMuted} /> : null}
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={MART.inkQuiet}
          selectionColor={MART.ink}
          accessibilityLabel={label}
          multiline={multiline}
          {...input}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.inputMultiline, style]}
        />
        {trailing}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    ...TYPE.label,
    marginBottom: SPACE.sm,
    marginLeft: SPACE.xs,
    color: MART.ink,
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
  },
  multiline: {
    alignItems: 'flex-start',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE.md,
  },
  focused: {
    borderColor: MART.ink,
  },
  invalid: {
    borderColor: MART.danger,
  },
  prefix: {
    ...TYPE.body,
    color: MART.inkMuted,
  },
  input: {
    ...TYPE.body,
    lineHeight: undefined,
    flex: 1,
    minHeight: 50,
    paddingVertical: 0,
    color: MART.ink,
  },
  inputMultiline: {
    minHeight: 84,
    lineHeight: TYPE.body.lineHeight,
    textAlignVertical: 'top',
  },
  hint: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
    marginLeft: SPACE.xs,
    color: MART.inkQuiet,
  },
  error: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
    marginLeft: SPACE.xs,
    color: MART.danger,
  },
});

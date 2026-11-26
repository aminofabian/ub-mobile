import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gloss, MartText, FONT, MART, RADIUS, SHADOW, SPACE, WEIGHT, SetStockScreen } from '@kiosk/staff';
import { useGrocerySession } from '../lib/session';
import type { GroceryStackParamList } from '../navigation/AppNavigator';

/** Says how many of an item are on the shelf, the same screen the Stock app has. Only for someone the shop lets do it. */
export function EditStockRoute() {
  const { api, branchId, modes, mayOrder, renderScanner } = useGrocerySession();
  const navigation = useNavigation<NativeStackNavigationProp<GroceryStackParamList>>();
  if (!modes.includes('stockEdit')) {
    return (
      <View style={styles.fill}>
        <Gloss />
        <View style={styles.card}>
          <MartText variant="title" style={styles.title}>
            Stock edit not available
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet} style={styles.copy}>
            Editing stock is not switched on for you at this shop. Ask the owner if you need to set shelf counts.
          </MartText>
          {mayOrder ? (
            <Pressable
              onPress={() => navigation.navigate('Order')}
              accessibilityRole="button"
              accessibilityLabel="Order from suppliers"
              style={styles.orderLink}
            >
              <MartText variant="label" color={MART.fallbackPrimary}>
                Order from suppliers
              </MartText>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.fill}>
      {mayOrder ? (
        <Pressable
          onPress={() => navigation.navigate('Order')}
          accessibilityRole="button"
          accessibilityLabel="Order from suppliers"
          style={styles.orderBar}
        >
          <MartText variant="label" color={MART.fallbackPrimary}>
            Order
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet}>
            Place a supplier order for your department
          </MartText>
        </Pressable>
      ) : null}
      <SetStockScreen api={api} branchId={branchId} {...(renderScanner ? { renderScanner } : {})} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  card: {
    margin: SPACE.md,
    marginTop: SPACE.xl,
    padding: SPACE.xl,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    gap: SPACE.sm,
    ...SHADOW.card,
  },
  title: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  copy: { maxWidth: 320 },
  orderLink: { marginTop: SPACE.md, alignSelf: 'flex-start' },
  orderBar: {
    marginHorizontal: SPACE.md,
    marginTop: SPACE.sm,
    marginBottom: SPACE.xs,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    gap: 2,
    ...SHADOW.card,
  },
});

import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { MART, MartText, RADIUS, SPACE } from '@kiosk/staff';
import type { CartLine } from '../lib/cart';
import { formatMoney, lineCents } from '../lib/money';
import { checkPriceEntry } from '../lib/price-entry';
import {
  breakdownFor,
  durationWords,
  MAX_SERVICE_QUANTITY,
  performersFor,
  planService,
  priceWords,
  sharedNames,
  startChoice,
  toggleOption,
  type Choice,
  type Performer,
  type Service,
} from '../lib/service-sale';
import { groupWords, NO_ONE_DOES_WORDS, priceBoxWords, sharedNamesWords, sumWords } from '../lib/service-words';
import { Prompt } from './Prompt';
import { CashierButton, CashierChip } from './CashierPrimitives';

interface ServiceSheetProps {
  /** The service being added. Null while the sheet is closed. */
  service: Service | null;
  performers: readonly Performer[];
  onCancel: () => void;
  /** Answers with words when the line could not be added, and null once it has been. */
  onAdd: (line: CartLine) => string | null;
}

/** A pill is a thumb's width tall here: the cashier is standing, with a customer waiting. */
const CHIP = { minHeight: 48 } as const;

/** One service: who did it, what the customer chose, how many, and the price when the cashier sets it. */
export function ServiceSheet({ service, performers, onCancel, onAdd }: ServiceSheetProps) {
  return (
    <Prompt visible={service !== null} title={service?.name ?? 'Service'} onClose={onCancel}>
      {service ? (
        // A different service is a new choice: the body starts again from nothing.
        <SheetBody key={service.id} service={service} performers={performers} onCancel={onCancel} onAdd={onAdd} />
      ) : null}
    </Prompt>
  );
}

function SheetBody({ service, performers, onCancel, onAdd }: Omit<ServiceSheetProps, 'service'> & { service: Service }) {
  const [choice, setChoice] = useState<Choice>(() => startChoice(service, performers));
  const [priceText, setPriceText] = useState('');
  const [refused, setRefused] = useState<string | null>(null);

  const able = performersFor(service, performers);
  const alike = sharedNamesWords(sharedNames(able));
  // A price that was typed and cannot be read stops the add: it must never quietly fall back to the listed price.
  const entry = service.variablePrice && priceText.trim() !== '' ? checkPriceEntry(priceText) : null;
  const readable = !(entry && !entry.ok);
  const typed: Choice = { ...choice, typedCents: entry && entry.ok ? entry.cents : null };
  const plan = planService(service, performers, typed);
  const canAdd = plan.ok && readable;
  const total = plan.ok && readable ? lineCents(plan.line.quantity, plan.line.unitPrice) : null;
  // What the choices add to the price, shown as a sum so that nothing is added without the cashier seeing it.
  const sum = readable ? sumWords(breakdownFor(service, typed)) : null;
  const details = [durationWords(service.durationMinutes), priceWords(service)].filter((part) => part !== '').join(' · ');
  const box = priceBoxWords(service);

  const change = (next: Choice) => {
    setRefused(null);
    setChoice(next);
  };

  const add = () => {
    if (!plan.ok || !canAdd) return;
    setRefused(onAdd(plan.line));
  };

  return (
    <View style={styles.body}>
      {details ? <MartText variant="meta" color={MART.inkQuiet}>{details}</MartText> : null}

      <MartText variant="heading" style={styles.heading} accessibilityRole="header">
        Who did it?
      </MartText>
      {able.length === 0 ? (
        <MartText variant="meta" style={styles.problem}>
          {NO_ONE_DOES_WORDS}
        </MartText>
      ) : (
        <View style={styles.chips}>
          {able.map((performer) => (
            <CashierChip
              key={performer.id}
              label={performer.name}
              selected={choice.performerId === performer.id}
              onPress={() => change({ ...choice, performerId: performer.id })}
              style={CHIP}
            />
          ))}
        </View>
      )}
      {alike ? <MartText variant="meta">{alike}</MartText> : null}

      {service.groups.map((group) => (
        <View key={group.id}>
          <MartText variant="heading" style={styles.heading} accessibilityRole="header">
            {group.name} <MartText variant="meta" color={MART.inkQuiet}>({groupWords(group)})</MartText>
          </MartText>
          <View style={styles.chips}>
            {group.options.map((option) => (
              <CashierChip
                key={option.id}
                label={option.extraCents > 0 ? `${option.name}  +${formatMoney(option.extraCents)}` : option.name}
                selected={choice.optionIds.includes(option.id)}
                onPress={() => change(toggleOption(service, choice, option.id))}
                style={CHIP}
              />
            ))}
          </View>
        </View>
      ))}

      {service.variablePrice ? (
        <View>
          <MartText variant="heading" style={styles.heading} accessibilityRole="header">
            {box.heading}
          </MartText>
          <TextInput
            style={styles.input}
            value={priceText}
            onChangeText={(text) => {
              setRefused(null);
              setPriceText(text);
            }}
            keyboardType="decimal-pad"
            placeholder={box.placeholder}
            maxLength={14}
            selectTextOnFocus
            accessibilityLabel={box.heading}
          />
          {entry && !entry.ok ? (
            <MartText variant="meta" style={styles.problem}>
              {entry.words}
            </MartText>
          ) : null}
        </View>
      ) : null}

      <View style={styles.quantity}>
        <MartText variant="body">How many</MartText>
        <View style={styles.stepper}>
          <CashierButton title="-" variant="secondary" onPress={() => change({ ...choice, quantity: choice.quantity - 1 })} disabled={choice.quantity <= 1} style={styles.step} />
          <MartText variant="title" accessibilityLabel={`How many: ${choice.quantity}`}>
            {choice.quantity}
          </MartText>
          <CashierButton
            title="+"
            variant="secondary"
            onPress={() => change({ ...choice, quantity: choice.quantity + 1 })}
            disabled={choice.quantity >= MAX_SERVICE_QUANTITY}
            style={styles.step}
          />
        </View>
      </View>

      {sum ? <MartText variant="meta">{sum}</MartText> : null}
      {total !== null ? (
        <MartText variant="title" accessibilityLiveRegion="polite">
          Total: {formatMoney(total)}
        </MartText>
      ) : !plan.ok && readable ? (
        <MartText variant="meta" color={MART.inkQuiet}>{plan.why}</MartText>
      ) : null}
      {refused ? (
        <MartText variant="meta" style={styles.problem} accessibilityRole="alert">
          {refused}
        </MartText>
      ) : null}

      <View style={styles.buttons}>
        <CashierButton title="Cancel" variant="secondary" onPress={onCancel} style={styles.button} />
        <CashierButton title="Add to basket" onPress={add} disabled={!canAdd} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.sm },
  heading: { marginTop: SPACE.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  input: {
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    minHeight: 56,
    fontSize: 24,
  },
  problem: { color: MART.danger },
  quantity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  step: { minWidth: 56 },
  buttons: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  button: { flex: 1 },
});

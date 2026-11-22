export const Linking = {
  getInitialURL: async () => null,
  addEventListener: () => ({ remove() {} }),
};
export const Platform = { OS: 'android' };

// Alert.alert: records what the person was asked, and answers the way a test directs.
//   __answerWith((call) => 'Switch anyway')  presses the button with that label
//   __answerWith(() => 'dismiss')            backs out of the dialog without pressing anything
const asked = [];
let answer = () => 'dismiss';

export const __asked = asked;
export function __answerWith(fn) {
  answer = fn;
}
export function __resetAlerts() {
  asked.length = 0;
  answer = () => 'dismiss';
}

export const Alert = {
  alert(title, message, buttons = [], options = {}) {
    const call = { title, message, buttons: buttons.map((button) => button.text) };
    asked.push(call);
    const choice = answer(call);
    queueMicrotask(() => {
      if (choice === 'dismiss') {
        options.onDismiss?.();
        return;
      }
      const button = buttons.find((candidate) => candidate.text === choice);
      if (!button) throw new Error(`the test pressed "${choice}" but the dialog offered ${JSON.stringify(call.buttons)}`);
      button.onPress?.();
    });
  },
};

export default { Linking, Platform, Alert };

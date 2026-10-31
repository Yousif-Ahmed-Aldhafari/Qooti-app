export const I18nManager = {
  isRTL: false,
  calls: {
    allowRTL: [] as boolean[],
    forceRTL: [] as boolean[],
    swapLeftAndRightInRTL: [] as boolean[],
  },
  allowRTL: (allow: boolean) => {
    I18nManager.calls.allowRTL.push(allow);
  },
  forceRTL: (force: boolean) => {
    I18nManager.calls.forceRTL.push(force);
  },
  swapLeftAndRightInRTL: (swap: boolean) => {
    I18nManager.calls.swapLeftAndRightInRTL.push(swap);
  },
  reset: () => {
    I18nManager.isRTL = false;
    I18nManager.calls = {
      allowRTL: [],
      forceRTL: [],
      swapLeftAndRightInRTL: [],
    };
  },
};

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export const Alert = {
  alertCalls: [] as { title: string; message?: string; buttons?: AlertButton[] }[],
  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    Alert.alertCalls.push({ title, message, buttons });
  },
  reset: () => {
    Alert.alertCalls = [];
  },
};

export const Platform = {
  OS: 'android',
  select: (obj: any) => obj.android ?? obj.default,
};

export const BackHandler = {
  listeners: [] as (() => boolean)[],
  addEventListener: (_event: string, handler: () => boolean) => {
    BackHandler.listeners.push(handler);
    return {
      remove: () => {
        BackHandler.listeners = BackHandler.listeners.filter((h) => h !== handler);
      },
    };
  },
  mockPressBack: () => {
    for (let i = BackHandler.listeners.length - 1; i >= 0; i--) {
      if (BackHandler.listeners[i]()) {
        return true;
      }
    }
    return false;
  },
};

export type TextStyle = {
  textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  writingDirection?: 'auto' | 'ltr' | 'rtl';
};

export type ViewStyle = {
  direction?: 'inherit' | 'ltr' | 'rtl';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
};

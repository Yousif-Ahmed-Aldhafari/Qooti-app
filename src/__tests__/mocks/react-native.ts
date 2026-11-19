import React from 'react';

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
  OS: 'android' as 'ios' | 'android' | 'web',
  select: (obj: any) => obj[Platform.OS] ?? obj.default,
  setOS: (os: 'ios' | 'android' | 'web') => {
    Platform.OS = os;
  },
  reset: () => {
    Platform.OS = 'android';
  },
};

export const Linking = {
  openedSettingsCount: 0,
  shouldFailOpenSettings: false,
  openSettings: async (): Promise<void> => {
    Linking.openedSettingsCount++;
    if (Linking.shouldFailOpenSettings) {
      throw new Error('Failed to open settings');
    }
  },
  reset: () => {
    Linking.openedSettingsCount = 0;
    Linking.shouldFailOpenSettings = false;
  },
};

export const AppState = {
  currentState: 'active',
  listeners: [] as ((state: string) => void)[],
  addEventListener: (_type: string, listener: (state: string) => void) => {
    AppState.listeners.push(listener);
    return {
      remove: () => {
        AppState.listeners = AppState.listeners.filter((l) => l !== listener);
      },
    };
  },
  simulateAppStateChange: (nextState: string) => {
    AppState.currentState = nextState;
    AppState.listeners.forEach((l) => l(nextState));
  },
  reset: () => {
    AppState.currentState = 'active';
    AppState.listeners = [];
  },
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

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
  hairlineWidth: 1,
  absoluteFill: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
};


function flattenStyle(style: any): any {
  if (!style) return undefined;
  if (!Array.isArray(style)) return style;
  return Object.assign({}, ...style.map(flattenStyle).filter(Boolean));
}

export const View = ({ style, ...props }: any) =>
  React.createElement('div', { style: flattenStyle(style), ...props });
export const Text = ({ style, ...props }: any) =>
  React.createElement('span', { style: flattenStyle(style), ...props });
export const ScrollView = ({ style, contentContainerStyle, ...props }: any) =>
  React.createElement('div', { style: flattenStyle([style, contentContainerStyle]), ...props });
export const SafeAreaView = ({ style, ...props }: any) =>
  React.createElement('div', { style: flattenStyle(style), ...props });
export const Pressable = ({ style, onPress, ...props }: any) => {
  const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
  return React.createElement('div', {
    style: flattenStyle(resolvedStyle),
    onClick: onPress,
    ...props,
  });
};
export const TouchableOpacity = ({ style, onPress, ...props }: any) =>
  React.createElement('div', { style: flattenStyle(style), onClick: onPress, ...props });
export const TextInput = ({ style, onChangeText, value, ...props }: any) =>
  React.createElement('input', {
    style: flattenStyle(style),
    value: value ?? '',
    onChange: onChangeText ? (e: any) => onChangeText(e.target.value) : undefined,
    ...props,
  });
export const Modal = ({ children, visible = true, ...props }: any) =>
  visible ? React.createElement('div', props, children) : null;
export const Keyboard = {
  dismiss: () => {},
  addListener: () => ({ remove: () => {} }),
};
export const KeyboardAvoidingView = ({ children, ...props }: any) =>
  React.createElement('div', props, children);
export const TouchableWithoutFeedback = ({ children, onPress, ...props }: any) =>
  React.createElement('div', { onClick: onPress, ...props }, children);
export const FlatList = ({ data = [], renderItem, keyExtractor, ...props }: any) =>
  React.createElement(
    'div',
    props,
    data.map((item: any, index: number) =>
      renderItem ? renderItem({ item, index, separators: {} }) : null
    )
  );
export const ActivityIndicator = (props: any) => React.createElement('div', props);

export type NativeSyntheticEvent<T> = {
  nativeEvent: T;
};

export type NativeScrollEvent = {
  contentOffset: { x: number; y: number };
};

export type StyleProp<T> = T | undefined | null | false | (T | undefined | null | false)[];

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

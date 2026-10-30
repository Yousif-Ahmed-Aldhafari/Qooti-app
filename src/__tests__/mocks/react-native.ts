export const I18nManager = {
  isRTL: false,
  allowRTL: (_allow: boolean) => {},
  forceRTL: (_force: boolean) => {},
  swapLeftAndRightInRTL: (_swap: boolean) => {},
};

export const Platform = {
  OS: 'android',
  select: (obj: any) => obj.android ?? obj.default,
};

export const BackHandler = {
  listeners: [] as Array<() => boolean>,
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

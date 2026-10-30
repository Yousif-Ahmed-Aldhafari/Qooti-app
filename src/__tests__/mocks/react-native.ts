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

import type { TextStyle, ViewStyle } from 'react-native';

import { useApp } from '../store/AppContext';
import {
  getDirection,
  getFlexEnd,
  getFlexStart,
  getRowDirection,
  getTextAlign,
  getWritingDirection,
  isRTLLanguage,
} from '../utils/languageDirection';

export function useLanguage() {
  const { settings, setLanguage, t } = useApp();
  const language = settings.selectedLanguage;
  const isRTL = isRTLLanguage(language);
  const direction = getDirection(language);
  const textAlign = getTextAlign(language);
  const writingDirection = getWritingDirection(language);
  const rowDirection = getRowDirection(language);
  const alignItems = getFlexStart(language) as ViewStyle['alignItems'];
  const alignSelf = getFlexStart(language);
  const alignEnd = getFlexEnd(language);
  const stretchAlignItems = 'stretch' as ViewStyle['alignItems'];

  return {
    language,
    setLanguage,
    t,
    isRTL,
    direction,
    textAlign,
    writingDirection,
    rowDirection,
    alignItems,
    alignSelf,
    alignEnd,
    directionStyle: { direction } as ViewStyle,
    contentDirectionStyle: { direction, alignItems: stretchAlignItems } as ViewStyle,
    textDirectionStyle: {
      direction,
      alignSelf: 'stretch',
      textAlign,
      writingDirection,
      width: '100%',
    } as TextStyle,
    rowDirectionStyle: { direction, flexDirection: rowDirection } as ViewStyle,
  };
}

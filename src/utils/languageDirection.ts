/**
 * Language direction utilities — consolidated to delegate to canonical rtl.ts.
 */
import type { Language } from '../models/settings';
import {
  applyRTL,
  direction,
  flexEnd,
  flexStart,
  alignItemsEnd,
  alignItemsStart,
  isRTL,
  rowDirection,
  rowStyle,
  textAlign,
  writingDirection,
} from './rtl';

export const isRTLLanguage = isRTL;
export const getDirection = direction;
export const getTextAlign = textAlign;
export const getWritingDirection = writingDirection;
export const getRowDirection = rowDirection;
export const getRowStyle = rowStyle;
export const getFlexStart = flexStart;
export const getFlexEnd = flexEnd;
export const getAlignItems = alignItemsStart;
export const getOppositeAlignItems = alignItemsEnd;

export function applyAppDirection(language: Language): boolean {
  return applyRTL(language);
}

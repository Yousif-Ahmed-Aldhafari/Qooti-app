import React from 'react';

function createSvgComponent(tag: string) {
  return function SvgElement(props: any) {
    const { children, onPress, onPressIn, ...rest } = props;
    // Map strokeDasharray to stroke-dasharray if needed
    const cleanProps: Record<string, any> = {};
    for (const [key, val] of Object.entries(rest)) {
      if (key === 'strokeDasharray') {
        cleanProps['stroke-dasharray'] = Array.isArray(val) ? val.join(' ') : val;
      } else if (key === 'strokeWidth') {
        cleanProps['stroke-width'] = val;
      } else {
        cleanProps[key] = val;
      }
    }
    return React.createElement(tag, cleanProps, children);
  };
}

export const Svg = createSvgComponent('svg');
export const Circle = createSvgComponent('circle');
export const Line = createSvgComponent('line');
export const Path = createSvgComponent('path');
export const Rect = createSvgComponent('rect');
export const Text = createSvgComponent('text');
export const TSpan = createSvgComponent('tspan');
export const G = createSvgComponent('g');
export const Defs = createSvgComponent('defs');
export const LinearGradient = createSvgComponent('linearGradient');
export const Stop = createSvgComponent('stop');
export const Polyline = createSvgComponent('polyline');
export const Polygon = createSvgComponent('polygon');

export default Svg;

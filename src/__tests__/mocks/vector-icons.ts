import React from 'react';

function createMockIcon(name: string) {
  const Component = (props: Record<string, unknown>) =>
    React.createElement('Text', { testID: name, ...props });
  Component.displayName = name;
  return Component;
}

export const Ionicons = createMockIcon('Ionicons');
export const MaterialIcons = createMockIcon('MaterialIcons');
export const MaterialCommunityIcons = createMockIcon('MaterialCommunityIcons');
export const FontAwesome = createMockIcon('FontAwesome');
export const FontAwesome5 = createMockIcon('FontAwesome5');
export const Feather = createMockIcon('Feather');
export const AntDesign = createMockIcon('AntDesign');
export const Entypo = createMockIcon('Entypo');

export default {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  FontAwesome,
  FontAwesome5,
  Feather,
  AntDesign,
  Entypo,
};

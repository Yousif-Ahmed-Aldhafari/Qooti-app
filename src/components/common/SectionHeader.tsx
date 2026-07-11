import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type SectionHeaderProps = {
  title: string;
  action?: React.ReactNode;
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const theme = useAppTheme();
  const { rowDirectionStyle, textDirectionStyle } = useLanguage();

  return (
    <View style={[styles.row, rowDirectionStyle]}>
      <Text style={[styles.title, textDirectionStyle, { color: theme.colors.text }]}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
});

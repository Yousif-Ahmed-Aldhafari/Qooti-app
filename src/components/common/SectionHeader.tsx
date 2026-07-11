import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type SectionHeaderProps = {
  title: string;
  action?: React.ReactNode;
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const theme = useAppTheme();
  const { rowDirection, textAlign, writingDirection } = useLanguage();

  return (
    <View style={[styles.row, { flexDirection: rowDirection }]}>
      <Text style={[styles.title, { color: theme.colors.text, textAlign, writingDirection }]}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
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

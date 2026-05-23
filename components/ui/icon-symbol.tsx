import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, StyleProp, TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // Основные
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  // PurePath собственные
  'map.fill': 'map',
  'wind': 'air',
  'info.circle.fill': 'info',
  'location.fill': 'my-location',
  'xmark.circle.fill': 'cancel',   // <-- крестик для очистки поля
} as IconMapping;

/**
 * Иконка, использующая SF Symbols на iOS и MaterialIcons на Android/Web.
 * Все имена основаны на SF Symbols, поэтому для каждой новой иконки
 * нужно добавить маппинг в MAPPING.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  );
}
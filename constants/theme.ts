/**
 * PurePath – цветовая система.
 * Дополнительные цвета предназначены для индикации качества воздуха.
 */
import { Platform } from 'react-native';

// Основной акцентный цвет – спокойный зелёный (свежесть, чистота)
const tintLight = '#2E7D32';
const tintDark = '#66BB6A';

// AQI цвета (индекса качества воздуха)
const airColors = {
  good: '#4CAF50',        // 0-50
  moderate: '#FFC107',   // 51-100
  unhealthySensitive: '#FF9800', // 101-150
  unhealthy: '#F44336',  // 151-200
  veryUnhealthy: '#9C27B0',
  hazardous: '#880E4F',
};

export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    tint: tintLight,
    icon: '#687076',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintLight,
    border: '#E0E0E0',
    // дополнительные
    card: '#F5F5F5',
    airColors,
  },
  dark: {
    text: '#ECEDEE',
    background: '#121212',
    tint: tintDark,
    icon: '#9BA1A6',
    tabIconDefault: '#6B6B6B',
    tabIconSelected: tintDark,
    border: '#2C2C2C',
    card: '#1E1E1E',
    airColors,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
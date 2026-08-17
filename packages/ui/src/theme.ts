export const theme = {
  colors: {
    primary: '#28a745',
    primaryDark: '#1e7e34',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#212529',
    textMuted: '#6c757d',
    border: '#dee2e6',
    danger: '#dc3545',
    warning: '#ffc107',
    success: '#28a745',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
} as const;

export type Theme = typeof theme;

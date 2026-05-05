import {
  argbFromHex,
  themeFromSourceColor,
  hexFromArgb
} from '@material/material-color-utilities';


export function applyTheme(color: string, isDark: boolean) {
  const theme = themeFromSourceColor(argbFromHex(color));
  const scheme = isDark ? theme.schemes.dark : theme.schemes.light;

  for (const [key, value] of Object.entries(scheme.toJSON())) {
    const cssVar = `--md-sys-color-${key.replace(/_/g, '-')}`;
    document.documentElement.style.setProperty(cssVar, hexFromArgb(value));
  }
}
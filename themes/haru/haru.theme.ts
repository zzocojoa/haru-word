// The haru theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in haru.settings.json and the generated haru.settings.ts;
// change them with `astryx experimental theme editor set haru ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {haruSettings} from './haru.settings';

export const haruTheme = defineTheme({
  extends: haruSettings,
  name: 'haru',
  tokens: {
    '--color-accent': '#d9f95f',
    '--color-on-accent': '#242621',
    '--color-accent-muted': '#eaf4cb',
    '--color-background-body': '#ffffff',
    '--color-background-surface': '#ffffff',
    '--color-background-card': '#ffffff',
    '--color-background-muted': '#f7f8f4',
    '--color-neutral': '#f2f4ed',
    '--color-text-primary': '#242621',
    '--color-text-secondary': '#62675c',
    '--color-text-accent': '#242621',
    '--color-border': '#daddd4',
    // The original input gray measures 2.94:1 on white; this shade clears 3:1.
    '--color-border-emphasized': '#8c9385',
    '--color-error': '#b3261e',
    '--color-on-error': '#ffffff',
    '--color-error-muted': '#fdebe9',
    '--color-on-error-muted': '#b3261e',
    '--color-success': '#206148',
    '--color-success-muted': '#e7f3ec',
    '--color-on-success-muted': '#206148',
    '--color-warning': '#825000',
    '--color-warning-muted': '#fff3d6',
    '--color-on-warning-muted': '#825000',
    '--focus-outline-color': '#242621',
    '--size-element-sm': '44px',
    '--size-element-md': '48px',
    '--size-element-lg': '48px',
    '--text-label-size': '16px',
    '--text-supporting-size': '14px',
    '--radius-element': '12px',
    '--radius-container': '16px',
  },
  components: {
    'app-shell': {base: {overflow: 'visible'}},
    'app-shell-header': {base: {zIndex: '30'}},
    'tab-list': {base: {
      display: 'block', backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '4px', width: '100%', height: 'auto',
      '--color-overlay-hover': 'transparent', '--color-overlay-pressed': 'transparent',
    }},
    tab: {
      base: {color: 'var(--caption)', backgroundColor: 'transparent', border: '0', fontWeight: '600'},
      selected: {backgroundColor: 'var(--action)', color: 'var(--ink)'},
    },
    button: {
      base: {whiteSpace: 'normal', height: 'auto', minHeight: '48px'},
      'size:sm': {height: 'auto', minHeight: '44px'},
    },
    'text-input': {base: {borderColor: '#8c9385', '--color-accent': '#242621'}},
    'text-area': {base: {borderColor: '#8c9385', '--color-accent': '#242621'}},
    selector: {base: {borderColor: '#8c9385', '--color-accent': '#242621'}},
  },
});

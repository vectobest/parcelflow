/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Values live as RGB channels in src/styles/index.css so opacity modifiers like bg-primary/15 keep working.
      colors: {
        'surface': 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-container-lowest': 'rgb(var(--c-surface-container-lowest) / <alpha-value>)',
        'surface-container-low': 'rgb(var(--c-surface-container-low) / <alpha-value>)',
        'surface-container': 'rgb(var(--c-surface-container) / <alpha-value>)',
        'surface-container-high': 'rgb(var(--c-surface-container-high) / <alpha-value>)',
        'surface-container-highest': 'rgb(var(--c-surface-container-highest) / <alpha-value>)',
        'on-surface': 'rgb(var(--c-on-surface) / <alpha-value>)',
        'on-surface-variant': 'rgb(var(--c-on-surface-variant) / <alpha-value>)',
        'outline-variant': 'rgb(var(--c-outline-variant) / <alpha-value>)',
        'primary': 'rgb(var(--c-primary) / <alpha-value>)',
        'primary-fixed-dim': 'rgb(var(--c-primary-fixed-dim) / <alpha-value>)',
        'on-primary': 'rgb(var(--c-on-primary) / <alpha-value>)',
        'secondary': 'rgb(var(--c-secondary) / <alpha-value>)',
        'secondary-container': 'rgb(var(--c-secondary-container) / <alpha-value>)',
        'tertiary': 'rgb(var(--c-tertiary) / <alpha-value>)',
        'error': 'rgb(var(--c-error) / <alpha-value>)',
        'error-container': 'rgb(var(--c-error-container) / <alpha-value>)',
        'on-error': 'rgb(var(--c-on-error) / <alpha-value>)',
        'caution': 'rgb(var(--c-caution) / <alpha-value>)',
        'white': 'rgb(var(--c-white) / <alpha-value>)'
      },
      // Radii and fonts are CSS variables too, so the light theme can be rounded and sentence-case while dark stays square signage.
      borderRadius: {
        DEFAULT: 'var(--r-default)',
        sm: 'var(--r-sm)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
        '3xl': 'var(--r-3xl)',
        card: 'var(--r-card)',
        badge: 'var(--r-badge)',
        full: '9999px'
      },
      spacing: {
        'space-3xs': '0.125rem',
        'space-xs': '0.375rem',
        'gutter-mobile': '0.25rem',
        'space-2xs': '0.25rem',
        'space-md': '0.75rem',
        margin: '1rem',
        'margin-mobile': '0.5rem',
        'space-sm': '0.5rem',
        'space-xl': '1.5rem',
        'space-lg': '1rem',
        gutter: '0.5rem'
      },
      fontFamily: {
        sans: ['var(--f-sans)'],
        display: ['var(--f-display)'],
        stencil: ['var(--f-stencil)'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        'code-sm': ['"IBM Plex Mono"', 'monospace'],
        'kpi-micro': ['"IBM Plex Mono"', 'monospace'],
        'body-regular': ['var(--f-sans)'],
        'body-compact': ['var(--f-sans)']
      },
      fontSize: {
        'code-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.02em', fontWeight: '500' }],
        'headline-lg': ['20px', { lineHeight: '26px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'data-lg': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['16px', { lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'kpi-micro': ['9px', { lineHeight: '11px', letterSpacing: '0.1em', fontWeight: '700' }],
        'body-regular': ['13px', { lineHeight: '18px', letterSpacing: '0em', fontWeight: '400' }],
        'display-xl-mobile': ['24px', { lineHeight: '30px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'body-compact': ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '400' }],
        'display-xl': ['32px', { lineHeight: '38px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'label-caps': ['10px', { lineHeight: '12px', letterSpacing: '0.08em', fontWeight: '700' }]
      }
    }
  },
  plugins: []
};

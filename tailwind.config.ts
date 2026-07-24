import type { Config } from 'tailwindcss';

/**
 * Paleta portada 1:1 desde biohealth_prototipo.html (variables :root).
 * No se introducen colores nuevos — mismo crema, mismo chocolate, mismo
 * dorado avaro, mismos colores de fase.
 */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        crema: '#F7F3EC',
        marfil: '#EFE8DC',
        choco: {
          DEFAULT: '#3A2A1E',
          deep: '#241812',
          mid: '#6B5544',
          soft: '#9A8672',
        },
        oro: {
          DEFAULT: '#B08D3F',
          claro: '#D9C08A',
          wash: '#F3EBD8',
        },
        fase: {
          restore: '#5C7A4A',
          repair: '#C08A2E',
          reset: '#A85A3C',
          target: '#3F5F7A',
          regenerate: '#6B4E7A',
          balance: '#8A8072',
        },
        linea: 'rgba(58,42,30,.11)',
        'linea-fuerte': 'rgba(58,42,30,.20)',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '11px',
      },
    },
  },
  plugins: [],
} satisfies Config;

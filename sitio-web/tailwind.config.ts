import type { Config } from 'tailwindcss';

/** Paleta corporativa BioHealth. Cambiar aquí impacta todo el sitio. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        crema: '#F8F6F0',
        beige: '#EFEAE1',
        dorado: { DEFAULT: '#C99624', oscuro: '#8F6A14', claro: '#E4C77E', wash: '#F5ECD6' },
        tinta: { DEFAULT: '#2B2925', suave: '#5A5650', tenue: '#6E6961' },
        linea: 'rgba(43,41,37,0.10)',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Manrope Variable"', 'system-ui', 'sans-serif'],
      },
      maxWidth: { contenido: '1200px' },
      boxShadow: {
        suave: '0 1px 2px rgba(43,41,37,.04), 0 12px 32px -12px rgba(43,41,37,.12)',
        elevada: '0 2px 4px rgba(43,41,37,.04), 0 24px 48px -16px rgba(43,41,37,.20)',
      },
      keyframes: {
        aparecer: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { aparecer: 'aparecer .9s cubic-bezier(.2,.7,.2,1) both' },
    },
  },
  plugins: [],
} satisfies Config;

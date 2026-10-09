import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        naija: { DEFAULT: '#2f7a55', deep: '#0d1411', ink: '#1b1a17', chalk: '#e9e4d4' },
        biro: '#1b3fa8',
        waec: '#c99a3e',
        margin: '#a5453d',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        pop: { '0%': { transform: 'translateY(8px) scale(.98)', opacity: '0' }, '100%': { transform: 'translateY(0) scale(1)', opacity: '1' } },
        floaty: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.75' } },
      },
      animation: { pop: 'pop .28s ease-out both', floaty: 'floaty 2.8s ease-in-out infinite' },
    },
  },
  plugins: [],
};
export default config;

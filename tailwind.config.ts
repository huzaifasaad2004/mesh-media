import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Mesh Media brand — maroon scale (replaces the old indigo template scale)
        brand: {
          50:  '#FAF3F0',
          100: '#F3E0DE',
          200: '#E5C2BF',
          300: '#D98A8E',
          400: '#B85A5E',
          500: '#8E2A30',
          600: '#6E1318',
          700: '#4E0E12',
          800: '#3E0B0E',
          900: '#2E080B',
        },
        maroon: { DEFAULT: '#6E1318', dark: '#4E0E12' },
        rose: '#D98A8E',
        paper: { 0: '#FAF9F5', 50: '#F7F2E9', 100: '#F3EEE6', 200: '#ECE4D6' },
        sand: { 300: '#E0D6C4', 400: '#C8BCA8' },
        taupe: { 500: '#9C9384', 600: '#6E655B' },
        umber: { 700: '#574E44', 800: '#3A332C' },
        espresso: { 900: '#2A2420', 950: '#1C1815' },
        ink: { DEFAULT: '#151312', muted: '#6E655B', black: '#0E0C0B' },
        aether: { cyan: '#2BD6D6' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
      borderRadius: { card: '12px', field: '8px' },
    },
  },
  plugins: [],
}
export default config

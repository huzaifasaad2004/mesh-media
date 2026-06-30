import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    '/Users/huzaifasaad/Desktop/mesh-media/pages/**/*.{js,ts,jsx,tsx,mdx}',
    '/Users/huzaifasaad/Desktop/mesh-media/components/**/*.{js,ts,jsx,tsx,mdx}',
    '/Users/huzaifasaad/Desktop/mesh-media/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          300: '#a5bbfc',
          400: '#8098f9',
          500: '#6172f3',
          600: '#444ce7',
          700: '#3538cd',
          800: '#2d31a6',
          900: '#2d3282',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config

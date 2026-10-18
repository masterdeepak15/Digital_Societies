import type { Config } from 'tailwindcss'

// Colors are CSS variables (see globals.css) so light/dark switch without per-class dark: variants.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Existing pages use bg-brand-600 etc.; the ramp is now navy (light) / blue (dark).
        brand: {
          50: v('brand-50'), 100: v('brand-100'), 200: v('brand-200'), 300: v('brand-300'), 400: v('brand-400'),
          500: v('brand-500'), 600: v('brand-600'), 700: v('brand-700'), 800: v('brand-800'), 900: v('brand-900'),
        },
        paper: v('paper'),
        surface: { DEFAULT: v('surface'), alt: v('surface-alt') },
        line: v('line'),
        ink: v('ink'),
        mute: v('mute'),
        saffron: { DEFAULT: v('saffron'), dark: v('saffron-dark') },
        nav: { DEFAULT: v('nav'), hi: v('nav-hi'), text: v('nav-text') },
        good: v('good'),
        warn: v('warn'),
        bad: v('bad'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config

const c = (name) => `rgb(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: c('--c-base'),
        surface: c('--c-surface'),
        raised: c('--c-raised'),
        line: c('--c-line'),
        main: c('--c-text'),
        muted: c('--c-muted'),
        gold: c('--c-gold'),
        'gold-soft': c('--c-gold-soft'),
        danger: c('--c-danger'),
        ok: c('--c-ok'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: { gold: '0 0 0 1px rgb(var(--c-gold) / 0.35), 0 8px 30px rgb(0 0 0 / 0.35)' },
    },
  },
  plugins: [],
};

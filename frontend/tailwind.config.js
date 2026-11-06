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
        'gold-deep': c('--c-gold-deep'),
        danger: c('--c-danger'),
        ok: c('--c-ok'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgb(var(--c-gold) / 0.4), 0 24px 60px -18px rgb(0 0 0 / 0.75), 0 0 50px -18px rgb(var(--c-gold) / 0.35)',
        glow: '0 0 30px -6px rgb(var(--c-gold) / 0.45)',
      },
    },
  },
  plugins: [],
};

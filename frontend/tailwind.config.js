/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg:      'var(--bg)',
        card:    'var(--card)',
        card2:   'var(--card2)',
        border:  'var(--border)',
        border2: 'var(--border2)',
        primary: 'var(--primary)',
        amber:   'var(--amber)',
        red:     'var(--red)',
        purple:  'var(--purple)',
        green:   'var(--green)',
        text:    'var(--text)',
        text2:   'var(--text2)',
        text3:   'var(--text3)',
      },
      fontFamily: {
        sans:  ['var(--font-sans)', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono:  ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

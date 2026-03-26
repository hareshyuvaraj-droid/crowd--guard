/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg:      '#050b14',
        panel:   '#0a1628',
        border:  '#112240',
        accent:  '#00e5ff',
        warn:    '#ffaa00',
        danger:  '#ff3b5c',
        safe:    '#00e676',
        mid:     '#ff6d00',
        muted:   '#4a6491',
      },
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
        sans: ['Syne', 'sans-serif'],
      }
    }
  },
  plugins: []
}

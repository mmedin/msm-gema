/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        crisis: {
          dark: '#0a0e17',
          card: '#131b2e',
          border: '#202d4a',
          p1: '#ef4444',
          p2: '#f97316',
          p3: '#eab308',
          p4: '#10b981',
        },
      },
    },
  },
  plugins: [],
}

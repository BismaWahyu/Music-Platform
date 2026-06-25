/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background colors
        bg: {
          primary: '#090a0e',
          secondary: '#12141a',
          tertiary: 'rgba(18, 20, 26, 0.5)',
          card: 'rgba(18, 20, 26, 0.42)',
        },
        // Text colors
        text: {
          primary: '#eaeaea',
          secondary: 'rgba(234, 234, 234, 0.7)',
          muted: 'rgba(234, 234, 234, 0.5)',
        },
        // Accent colors (purple/blue from Senandung.html)
        accent: {
          DEFAULT: 'oklch(0.64 0.19 256)',
          hover: 'oklch(0.6 0.17 256)',
          soft: 'oklch(0.58 0.18 305)',
          muted: 'oklch(0.5 0.08 280)',
        },
        // Border color
        border: 'rgba(255, 255, 255, 0.08)',
        borderHover: 'rgba(255, 255, 255, 0.15)',
        // Status colors
        success: '#4ade80',
        warning: '#fbbf24',
        error: '#e23b3b',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'input': '8px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px oklch(0.64 0.19 256 / 0.3)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}

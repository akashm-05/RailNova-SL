/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rail: {
          dark: '#0f172a',      // Midnight navy
          primary: '#2563eb',   // Electric indigo / cobalt
          teal: '#0d9488',      // Teal positive availability
          amber: '#d97706',     // Amber warnings / held
          red: '#dc2626',       // Red destructive / booked
          warm: '#f8fafc',      // Warm neutral background
          card: '#ffffff',
          slate: '#64748b',     // Secondary slate text
          border: '#e2e8f0'
        }
      }
    },
  },
  plugins: [],
}

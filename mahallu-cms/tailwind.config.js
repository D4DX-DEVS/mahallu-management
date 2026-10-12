/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9f4',
          100: '#dbf1e4',
          200: '#b9e2cb',
          300: '#8ccaa9',
          400: '#4fa57c',
          500: '#1e7a56',
          600: '#04563A',
          700: '#0B4837',
          800: '#093c2e',
          900: '#072f24',
          950: '#012A1C',
        },
        secondary: {
          50: '#fffbe0',
          100: '#fff6b3',
          200: '#fff086',
          300: '#ffe85a',
          400: '#fde12f',
          500: '#FDD817',
          600: '#b89b00',
          700: '#8a7300',
          800: '#665500',
          900: '#4a3d00',
          950: '#2e2600',
        },
        // ZAAD dark-mode charcoal surfaces (see also the .dark remap in src/index.css)
        surface: {
          base: '#0F1412',
          card: '#171D1A',
          raised: '#1E2622',
          hover: '#27322D',
          border: '#2B3631',
          'border-strong': '#3A4741',
          text: '#F1F4F2',
          muted: '#A5B0AA',
        },
        brand: {
          deep: '#0B4837',
          forest: '#04563A',
          mid: '#2F3B36',
          lime: '#8EC13E',
          'lime-bright': '#ACD81E',
          gold: '#FDD817',
          night: '#012A1C',
          ink: '#231F20',
        },
      },
      fontFamily: {
        // Plus Jakarta Sans for UI/headlines, Space Grotesk for labels,
        // Noto Sans Malayalam falls through per-glyph for Malayalam text.
        sans: ['Plus Jakarta Sans', 'Noto Sans Malayalam', 'system-ui', 'sans-serif'],
        malayalam: ['Noto Sans Malayalam', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'Noto Sans Malayalam', 'system-ui', 'sans-serif'],
        title: ['Plus Jakarta Sans', 'Noto Sans Malayalam', 'system-ui', 'sans-serif'],
        label: ['Space Grotesk', 'Noto Sans Malayalam', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}


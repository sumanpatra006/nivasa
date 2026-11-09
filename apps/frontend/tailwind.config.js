/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#F4F7F0',
          100: '#E7EEDF',
          200: '#D0DEC3',
          300: '#B3C99F',
          500: '#87A96B',
          700: '#5D7D46',
          900: '#354A2A',
        },
        walnut: {
          50: '#F7F3EF',
          100: '#EAE0D6',
          200: '#D4C0AF',
          500: '#5A3E2B',
          700: '#402B1E',
          900: '#281A12',
        },
        amber: {
          50: '#FFF7E9',
          100: '#F8E6C7',
          300: '#E8B76A',
          500: '#D5851F',
          700: '#9D5B13',
        },
        canvas: '#F7F7F4',
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F1F2ED',
        },
        border: {
          DEFAULT: '#E5E7DF',
          strong: '#CDD1C6',
        },
        text: {
          primary: '#242821',
          secondary: '#687067',
          muted: '#8A9087',
        },
        status: {
          success: '#477A4B',
          'success-bg': '#EAF3E8',
          warning: '#A66B15',
          'warning-bg': '#FFF3D9',
          danger: '#B8473D',
          'danger-bg': '#FBEAE7',
          info: '#527C91',
          'info-bg': '#EAF2F6',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        control: '8px',
        input: '10px',
        surface: '12px',
        modal: '16px',
      },
    },
  },
  plugins: [],
};


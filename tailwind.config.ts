import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mörkblå - Huvudfärg
        navy: {
          50: '#f0f3f7',
          100: '#dce3ec',
          200: '#b8c7d9',
          300: '#94abc6',
          400: '#4d6d8f',
          500: '#3a5270',
          600: '#2e4159',
          700: '#273749',
          800: '#1f2a37', // Basfärg
          900: '#151d26',
        },
        // Ljus varm grå - Sekundär
        warm: {
          50: '#ffffff',
          100: '#f5f7fa', // Sekundär färg
          200: '#ebeef3',
          300: '#dfe3eb',
          400: '#c8cdd7',
          500: '#a8aeb9',
          600: '#7f8694',
          700: '#5f6471',
          800: '#3f4450',
          900: '#2a2d35',
        },
        // Dämpad guld - Accent
        gold: {
          50: '#fefcf3',
          100: '#fdf8e1',
          200: '#fbf1c3',
          300: '#f8e89f',
          400: '#f6dd6b',
          500: '#f4c430', // Accentfärg
          600: '#d4a522',
          700: '#b38619',
          800: '#8f6a13',
          900: '#6b4f0e',
        }
      },
    },
  },
  plugins: [],
};
export default config;

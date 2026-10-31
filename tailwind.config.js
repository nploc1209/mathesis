/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border, 220 13% 91%))',
        input: 'hsl(var(--input, 220 13% 91%))',
        ring: 'hsl(var(--ring, 224 71.4% 4.1%))',
        background: 'hsl(var(--background, 0 0% 100%))',
        foreground: 'hsl(var(--foreground, 224 71.4% 4.1%))',
        primary: {
          DEFAULT: 'hsl(var(--primary, 220.9 39.3% 11%))',
          foreground: 'hsl(var(--primary-foreground, 210 20% 98%))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary, 220 14.3% 95.9%))',
          foreground: 'hsl(var(--secondary-foreground, 220.9 39.3% 11%))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted, 220 14.3% 95.9%))',
          foreground: 'hsl(var(--muted-foreground, 220 8.9% 46.1%))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent, 220 14.3% 95.9%))',
          foreground: 'hsl(var(--accent-foreground, 220.9 39.3% 11%))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive, 0 84.2% 60.2%))',
          foreground: 'hsl(var(--destructive-foreground, 210 20% 98%))',
        },
      },
      borderRadius: {
        lg: 'var(--radius, 0.5rem)',
        md: 'calc(var(--radius, 0.5rem) - 2px)',
        sm: 'calc(var(--radius, 0.5rem) - 4px)',
      },
    },
  },
  plugins: [],
};

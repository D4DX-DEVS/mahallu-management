/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* ---- Token-mapped semantic colours -------------------------------
         * These resolve to the CSS variables in index.css. Prefer them over
         * raw ramps: bg-card, text-muted-foreground, border-border, bg-primary.
         */
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          foreground: 'hsl(var(--warning-foreground) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          foreground: 'hsl(var(--info-foreground) / <alpha-value>)',
        },

        /* ---- Brand ramp --------------------------------------------------
         * Islamic Green. `primary` with no step resolves to the --primary
         * token, so bg-primary and bg-primary-600 land on the same brand colour.
         */
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },

      /* One neutral ramp for the whole product: Tailwind `gray`.
       * `slate` is intentionally not extended — do not reintroduce it. */

      borderRadius: {
        sm: 'calc(var(--radius) - 2px)', // 6px  — badges, chips, small controls
        DEFAULT: 'var(--radius)', //          8px  — every control
        md: 'var(--radius)', //               8px  — every control
        lg: 'calc(var(--radius) + 4px)', //  12px  — cards, dialogs, panels
        xl: 'calc(var(--radius) + 4px)', //  12px  — alias, keeps legacy usage on scale
        '2xl': 'calc(var(--radius) + 4px)', // 12px — alias
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-md)',
        xl: 'var(--shadow-md)',
        '2xl': 'var(--shadow-md)',
      },

      width: {
        /* The collapsed navigation rail. Paired with `ml-rail` on the content. */
        rail: '4.5rem',
      },
      margin: {
        rail: '4.5rem',
      },
      padding: {
        /* The iOS home-indicator inset, under the mobile tab bar. */
        safe: 'env(safe-area-inset-bottom)',
      },
      maxWidth: {
        /* The widest the content column ever gets. */
        content: '1600px',
      },
      height: {
        /* Viewport minus the app header and the mobile tab bar. */
        'screen-content': 'calc(100vh - 140px)',
      },
      minHeight: {
        'screen-content': 'calc(100vh - 140px)',
      },
      fontSize: {
        /* Seven steps: 12 / 13 / 14 / 16 / 18 / 24 / 30. Nothing outside them.
         * xl collapses onto 18 (the 20px step is removed) and 3xl/4xl/5xl cap
         * at 30 so no page can invent a larger heading. */
        xs: ['0.75rem', { lineHeight: '1rem' }], //          12 — caption, badge, helper
        label: ['0.8125rem', { lineHeight: '1.125rem' }], // 13 — form label, table cell
        sm: ['0.875rem', { lineHeight: '1.375rem' }], //     14 — body (default)
        base: ['1rem', { lineHeight: '1.5rem' }], //         16 — body large
        lg: ['1.125rem', { lineHeight: '1.625rem' }], //     18 — section title
        xl: ['1.125rem', { lineHeight: '1.625rem' }], //     18 — alias of lg
        '2xl': ['1.5rem', { lineHeight: '1.875rem' }], //    24 — page title
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], //   30 — display
        '4xl': ['1.875rem', { lineHeight: '2.25rem' }], //   30 — capped alias
        '5xl': ['1.875rem', { lineHeight: '2.25rem' }], //   30 — capped alias
      },

      spacing: {
        /* 4 / 8 / 12 / 16 / 24 / 32 / 48 are Tailwind 1/2/3/4/6/8/12.
         * Half-steps are deliberately mapped onto the scale so legacy
         * p-2.5 / gap-1.5 land on a real step instead of an off-grid value. */
        0.5: '0.25rem',
        1.5: '0.5rem',
        2.5: '0.75rem',
        3.5: '1rem',
        4.5: '1.25rem',
      },

      fontFamily: {
        /* One family. Noto Sans Malayalam carries the Malayalam glyphs the
         * Latin face lacks, so mixed strings resolve per glyph. */
        sans: ['Plus Jakarta Sans', 'Noto Sans Malayalam', 'system-ui', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'Noto Sans Malayalam', 'system-ui', 'sans-serif'],
        title: ['Plus Jakarta Sans', 'Noto Sans Malayalam', 'system-ui', 'sans-serif'],
        malayalam: ['Noto Sans Malayalam', 'sans-serif'],
      },

      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-in': 'fade-in 150ms ease-out',
      },
    },
  },
  plugins: [],
};

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-app)',
        foreground: 'var(--text-body)',
        title: 'var(--text-title)',
        card: {
          DEFAULT: 'var(--surface-card)',
          foreground: 'var(--text-body)',
        },
        surface: {
          app: 'var(--bg-app)',
          card: 'var(--surface-card)',
          subtle: 'var(--surface-subtle)',
          hover: 'var(--surface-hover)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          tint: 'var(--primary-tint)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--surface-subtle)',
          foreground: 'var(--text-body)',
        },
        muted: {
          DEFAULT: 'var(--surface-subtle)',
          foreground: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--primary-tint)',
          foreground: 'var(--primary)',
        },
        border: {
          DEFAULT: 'var(--border-subtle)',
          input: 'var(--border-input)',
          subtle: 'var(--border-subtle)',
        },
        input: 'var(--border-input)',
        ring: 'var(--primary)',
        viewport3d: 'var(--viewport-3d)',
        // Semantic status tokens
        semantic: {
          draft: {
            bg: 'var(--status-draft-bg)',
            text: 'var(--status-draft-text)',
            border: 'var(--status-draft-border)',
          },
          pending: {
            bg: 'var(--status-pending-bg)',
            text: 'var(--status-pending-text)',
            border: 'var(--status-pending-border)',
          },
          verified: {
            bg: 'var(--status-verified-bg)',
            text: 'var(--status-verified-text)',
            border: 'var(--status-verified-border)',
          },
          processing: {
            bg: 'var(--status-processing-bg)',
            text: 'var(--status-processing-text)',
            border: 'var(--status-processing-border)',
          },
          staging: {
            bg: 'var(--status-staging-bg)',
            text: 'var(--status-staging-text)',
            border: 'var(--status-staging-border)',
          },
          active: {
            bg: 'var(--status-active-bg)',
            text: 'var(--status-active-text)',
            border: 'var(--status-active-border)',
          },
          matched: {
            bg: 'var(--status-matched-bg)',
            text: 'var(--status-matched-text)',
            border: 'var(--status-matched-border)',
          },
          confirmed: {
            bg: 'var(--status-confirmed-bg)',
            text: 'var(--status-confirmed-text)',
            border: 'var(--status-confirmed-border)',
          },
          cancelled: {
            bg: 'var(--status-cancelled-bg)',
            text: 'var(--status-cancelled-text)',
            border: 'var(--status-cancelled-border)',
          },
        },
        // 12 Calibrated Shipper 3D Palette
        shipper: {
          1: { DEFAULT: 'var(--shipper-1)', wire: 'var(--shipper-1-wire)' },
          2: { DEFAULT: 'var(--shipper-2)', wire: 'var(--shipper-2-wire)' },
          3: { DEFAULT: 'var(--shipper-3)', wire: 'var(--shipper-3-wire)' },
          4: { DEFAULT: 'var(--shipper-4)', wire: 'var(--shipper-4-wire)' },
          5: { DEFAULT: 'var(--shipper-5)', wire: 'var(--shipper-5-wire)' },
          6: { DEFAULT: 'var(--shipper-6)', wire: 'var(--shipper-6-wire)' },
          7: { DEFAULT: 'var(--shipper-7)', wire: 'var(--shipper-7-wire)' },
          8: { DEFAULT: 'var(--shipper-8)', wire: 'var(--shipper-8-wire)' },
          9: { DEFAULT: 'var(--shipper-9)', wire: 'var(--shipper-9-wire)' },
          10: { DEFAULT: 'var(--shipper-10)', wire: 'var(--shipper-10-wire)' },
          11: { DEFAULT: 'var(--shipper-11)', wire: 'var(--shipper-11-wire)' },
          12: { DEFAULT: 'var(--shipper-12)', wire: 'var(--shipper-12-wire)' },
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;

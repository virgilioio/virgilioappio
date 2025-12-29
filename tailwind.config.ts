
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1750px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Virgilio.io Brand Colors
				surface: {
					primary: 'hsl(var(--surface-primary))',
					secondary: 'hsl(var(--surface-secondary))',
					tertiary: 'hsl(var(--surface-tertiary))',
					overlay: 'hsl(var(--surface-overlay))'
				},
				text: {
					primary: 'hsl(var(--text-primary))',
					secondary: 'hsl(var(--text-secondary))',
					tertiary: 'hsl(var(--text-tertiary))',
					muted: 'hsl(var(--text-muted))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))'
				},
				pastel: {
					blue: 'hsl(var(--pastel-blue))',
					'blue-foreground': 'hsl(var(--pastel-blue-foreground))',
					purple: 'hsl(var(--pastel-purple))',
					'purple-foreground': 'hsl(var(--pastel-purple-foreground))',
					green: 'hsl(var(--pastel-green))',
					'green-foreground': 'hsl(var(--pastel-green-foreground))',
					pink: 'hsl(var(--pastel-pink))',
					'pink-foreground': 'hsl(var(--pastel-pink-foreground))',
					yellow: 'hsl(var(--pastel-yellow))',
					'yellow-foreground': 'hsl(var(--pastel-yellow-foreground))',
					orange: 'hsl(var(--pastel-orange))',
					'orange-foreground': 'hsl(var(--pastel-orange-foreground))'
				},
				'purple-period': 'hsl(var(--purple-period))',
				'loading-ellipsis': '#d7c5fb',
				// Virgilio Calendly-style brand colors
				'virgilio-purple': '#6F3FF5',
				'virgilio-text': '#0F1222',
				'virgilio-muted': '#5A6072',
				'virgilio-border': '#E7E8EE',
				'virgilio-success': '#12B886',
				'virgilio-error': '#FA5252',
			},
			borderRadius: {
				xs: '4px',
				sm: '6px',
				md: '8px',
				lg: '12px',
				xl: '16px',
				brand: 'var(--radius)',
				none: '0',
				full: '9999px'
			},
			fontFamily: {
				poppins: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
				'poppins-black': ['Poppins', 'sans-serif'],
				inter: ['Inter', 'Roboto', 'Work Sans', 'sans-serif'],
				mono: ['Monaco', 'Menlo', 'monospace']
			},
			fontSize: {
				xs: 'var(--font-size-xs)',
				sm: 'var(--font-size-sm)',
				md: 'var(--font-size-md)',
				base: 'var(--font-size-base)',
				lg: 'var(--font-size-lg)',
				xl: 'var(--font-size-xl)',
				'2xl': 'var(--font-size-2xl)',
				'3xl': 'var(--font-size-3xl)',
				'4xl': 'var(--font-size-4xl)',
				// Virgilio Calendly-style heading sizes
				'h1-mobile': ['34px', { lineHeight: '1.15', letterSpacing: '-0.06em', fontWeight: '700' }],
				'h1-desktop': ['48px', { lineHeight: '1.15', letterSpacing: '-0.06em', fontWeight: '700' }],
				'h2-mobile': ['28px', { lineHeight: '1.15', letterSpacing: '-0.06em', fontWeight: '700' }],
				'h2-desktop': ['36px', { lineHeight: '1.15', letterSpacing: '-0.06em', fontWeight: '700' }],
				'h3-mobile': ['22px', { lineHeight: '1.15', letterSpacing: '-0.06em', fontWeight: '700' }],
				'h3-desktop': ['28px', { lineHeight: '1.15', letterSpacing: '-0.06em', fontWeight: '700' }],
				'h4-mobile': ['18px', { lineHeight: '1.2', letterSpacing: '-0.06em', fontWeight: '700' }],
				'h4-desktop': ['22px', { lineHeight: '1.2', letterSpacing: '-0.06em', fontWeight: '700' }],
			},
			lineHeight: {
				tight: 'var(--line-height-tight)',
				normal: 'var(--line-height-normal)',
				relaxed: 'var(--line-height-relaxed)'
			},
			spacing: {
				'xs': 'var(--spacing-xs)',      // 4px
				'sm': 'var(--spacing-sm)',      // 8px
				'md': 'var(--spacing-md)',      // 12px
				'lg': 'var(--spacing-lg)',      // 16px
				'xl': 'var(--spacing-xl)',      // 20px
				'2xl': 'var(--spacing-2xl)',    // 24px
				'3xl': 'var(--spacing-3xl)',    // 32px
				'4xl': 'var(--spacing-4xl)',    // 40px
				'5xl': 'var(--spacing-5xl)',    // 48px
				'6xl': 'var(--spacing-6xl)',    // 64px
				
				// Layout specific
				'gutter': 'var(--layout-gutter)',
				'layout-sm': 'var(--layout-padding-sm)',
				'layout-md': 'var(--layout-padding-md)',
				'layout-lg': 'var(--layout-padding-lg)'
			},
			height: {
				'button-sm': 'var(--button-height-sm)',
				'button': 'var(--button-height-default)',
				'button-lg': 'var(--button-height-lg)',
				'input': 'var(--input-height)',
				'table-row': 'var(--table-row-height)'
			},
			boxShadow: {
				xs: 'var(--shadow-xs)',
				sm: 'var(--shadow-sm)',
				md: 'var(--shadow-md)',
				lg: 'var(--shadow-lg)',
				xl: 'var(--shadow-xl)',
				'2xl': 'var(--shadow-2xl)',
				button: 'var(--shadow-button)',
				card: 'var(--shadow-card)',
				elevated: 'var(--shadow-elevated)',
				'neumorphic': 'var(--shadow-neumorphic-base)',
				'neumorphic-hover': 'var(--shadow-neumorphic-hover)',
				'neumorphic-active': 'var(--shadow-neumorphic-active)',
				'calendly': '0 8px 24px rgba(15, 18, 34, 0.08)',
			},
			letterSpacing: {
				tighter: '-0.05em',
				tight: '-0.025em',
				'page-title': '-0.06em',
				normal: '0em',
				wide: '0.025em',
				wider: '0.05em'
			},
			transitionDuration: {
				'fast': 'var(--transition-fast)',
				'default': 'var(--transition-default)',
				'slow': 'var(--transition-slow)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					from: {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					to: {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'scale-in': {
					from: {
						opacity: '0',
						transform: 'scale(0.95)'
					},
					to: {
						opacity: '1',
						transform: 'scale(1)'
					}
				},
				'slide-in': {
					from: {
						transform: 'translateX(-100%)'
					},
					to: {
						transform: 'translateX(0)'
					}
				},
				'slide-in-bottom-right': {
					from: {
						transform: 'translateY(100%) translateX(100%)',
						opacity: '0'
					},
					to: {
						transform: 'translateY(0) translateX(0)',
						opacity: '1'
					}
				},
				'slide-out-bottom-right': {
					from: {
						transform: 'translateY(0) translateX(0)',
						opacity: '1'
					},
					to: {
						transform: 'translateY(100%) translateX(100%)',
						opacity: '0'
					}
				},
				'coin-flip': {
					'0%': { transform: 'rotateY(0deg) scale(0.8)', opacity: '0' },
					'20%': { opacity: '1' },
					'60%': { transform: 'rotateY(540deg) scale(1.05)' },
					'80%': { transform: 'rotateY(700deg) scale(1)' },
					'95%': { transform: 'rotateY(720deg) scale(1.03)' },
					'100%': { transform: 'rotateY(720deg) scale(1)' }
				},
				'shimmer-beam': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(200%)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'slide-in': 'slide-in 0.3s ease-out',
				'slide-in-bottom-right': 'slide-in-bottom-right 0.3s ease-out',
				'slide-out-bottom-right': 'slide-out-bottom-right 0.3s ease-out',
				'coin-flip': 'coin-flip 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
				'shimmer-beam': 'shimmer-beam 2s ease-in-out infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;

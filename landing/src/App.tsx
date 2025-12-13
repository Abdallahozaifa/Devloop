import { useState, useEffect, useRef, Fragment } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence, useInView } from 'framer-motion'

const API_URL = import.meta.env.VITE_API_URL || 'https://devloop-api.fly.dev'

// =============================================================================
// DESIGN TOKENS
// =============================================================================
// Colors available for reference:
// bg: '#0a0a0b', bgCard: '#111113', bgHover: '#18181b'
// border: '#27272a', borderHover: '#3f3f46'
// text: '#fafafa', textMuted: '#a1a1aa', textDim: '#71717a'
// purple: '#8b5cf6', violet: '#6366f1', cyan: '#06b6d4', green: '#22c55e'

// =============================================================================
// PREMIUM LOGO COMPONENT - Infinite Loop with Arrow (Ship Fast)
// Inspired by: Linear, Vercel, Stripe - Clean, geometric, iconic
// =============================================================================
interface LogoProps {
  size?: number
  variant?: 'mark' | 'full' | 'wordmark'
  color?: 'gradient' | 'white' | 'black'
  className?: string
}

function Logo({ size = 32, variant = 'mark', color = 'gradient', className = '' }: LogoProps) {
  const gradientId = `logo-gradient-${Math.random().toString(36).substr(2, 9)}`

  // Get the stroke color based on color prop
  const getStroke = () => {
    if (color === 'gradient') return `url(#${gradientId})`
    if (color === 'white') return '#ffffff'
    return '#000000'
  }

  const LogoMark = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      {/*
        Infinity Loop Logo - Two flowing curves that form an infinity symbol
        with a subtle arrow direction suggesting "shipping" / forward motion
        Clean, geometric, works at any size from 16px to 512px
      */}
      <g>
        {/* Left loop of infinity */}
        <path
          d="M16 16C16 16 12 12 8 12C4 12 2 14.5 2 16C2 17.5 4 20 8 20C12 20 16 16 16 16Z"
          stroke={getStroke()}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Right loop of infinity - slightly extended for arrow effect */}
        <path
          d="M16 16C16 16 20 20 24 20C28 20 30 17.5 30 16C30 14.5 28 12 24 12C20 12 16 16 16 16Z"
          stroke={getStroke()}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Arrow tip - ship indicator */}
        <path
          d="M28 13L30 16L28 19"
          stroke={getStroke()}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  )

  if (variant === 'mark') {
    return <LogoMark />
  }

  // Full logo with wordmark
  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <LogoMark />
        <span
          className="font-semibold tracking-tight"
          style={{
            fontSize: size * 0.6,
            color: color === 'black' ? '#000000' : '#ffffff'
          }}
        >
          DevLoop
        </span>
      </div>
    )
  }

  // Wordmark only
  return (
    <span
      className={`font-semibold tracking-tight ${className}`}
      style={{
        fontSize: size * 0.6,
        color: color === 'black' ? '#000000' : '#ffffff'
      }}
    >
      DevLoop
    </span>
  )
}

// =============================================================================
// ANIMATED SECTION TITLE
// =============================================================================
interface SectionTitleProps {
  badge?: string
  title: string
  subtitle?: string
}

function SectionTitle({ badge, title, subtitle }: SectionTitleProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <div ref={ref} className="text-center mb-16">
      {badge && (
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="inline-block text-xs font-semibold tracking-wider uppercase text-zinc-500 mb-4"
        >
          {badge}
        </motion.span>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  )
}

// =============================================================================
// STAGGERED GRID CONTAINER
// =============================================================================
interface StaggeredGridProps {
  children: React.ReactNode
  className?: string
}

function StaggeredGrid({ children, className }: StaggeredGridProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1
          }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// =============================================================================
// ANIMATED NAVBAR
// =============================================================================
type NavPage = 'home' | 'docs' | 'dashboard'

interface NavbarProps {
  activePage: NavPage
  user?: { email: string } | null
  onLogout?: () => void
  showFeaturesPricing?: boolean
}

function Navbar({ user, onLogout, showFeaturesPricing = false }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0a0a0b]/80 backdrop-blur-2xl border-b border-white/[0.08] shadow-lg shadow-black/20'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          {/* Logo with glow effect on hover */}
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Logo size={36} variant="mark" color="gradient" />
          </div>
          <span className="text-xl font-semibold text-white tracking-tight">DevLoop</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          <a
            href={showFeaturesPricing ? '#features' : '/#features'}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            Features
          </a>
          <a
            href={showFeaturesPricing ? '#pricing' : '/#pricing'}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            Pricing
          </a>
          <Link
            to="/docs"
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            Docs
          </Link>

          <div className="ml-4 flex items-center gap-3">
            {user ? (
              <>
                <span className="text-zinc-500 text-sm truncate max-w-[150px]">{user.email}</span>
                <button
                  onClick={onLogout}
                  className="text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/dashboard"
                  className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/dashboard"
                  className="px-5 py-2.5 text-sm font-semibold text-[#0a0a0b] bg-white rounded-lg hover:bg-zinc-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-zinc-800/50 bg-[#0a0a0b]/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-2">
              <a
                href={showFeaturesPricing ? '#features' : '/#features'}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors"
              >
                Features
              </a>
              <a
                href={showFeaturesPricing ? '#pricing' : '/#pricing'}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors"
              >
                Pricing
              </a>
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors">Dashboard</Link>
                  <button onClick={() => { onLogout?.(); setMobileMenuOpen(false) }} className="w-full text-left px-4 py-3 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors">Sign out</button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors">Sign in</Link>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 bg-white text-zinc-900 font-medium rounded-lg text-center hover:bg-zinc-100 transition-colors">Get Started</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

// =============================================================================
// FAQ ACCORDION
// =============================================================================
interface FAQItemProps {
  question: string
  answer: string
  isOpen: boolean
  onClick: () => void
}

function FAQItem({ question, answer, isOpen, onClick }: FAQItemProps) {
  return (
    <div className="border-b border-zinc-800">
      <button
        onClick={onClick}
        className="w-full py-5 flex items-center justify-between text-left group"
      >
        <span className="text-white font-medium group-hover:text-zinc-300 transition-colors">{question}</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-5 h-5 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-zinc-400 text-sm leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// =============================================================================
// PRICING CARD
// =============================================================================
interface PricingCardProps {
  name: string
  price: number
  description: string
  features: string[]
  popular?: boolean
  onSelect: () => void
  delay?: number
  buttonText?: string
}

function PricingCard({ name, price, description, features, popular, onSelect, delay = 0, buttonText }: PricingCardProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  // Dynamic button text based on plan
  const getButtonText = () => {
    if (buttonText) return buttonText
    if (price === 0) return 'Start Free'
    return 'Start Trial'
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative p-8 rounded-2xl border ${
        popular
          ? 'border-white/20 bg-zinc-900/60'
          : 'border-zinc-800 bg-zinc-900/30'
      } hover:border-zinc-600 transition-all duration-300`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 text-xs font-semibold text-[#0a0a0b] bg-white rounded-full">
            MOST POPULAR
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">{name}</h3>
        <p className="text-zinc-400 text-sm">{description}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-white">${price}</span>
        <span className="text-zinc-500">/month</span>
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        className={`group w-full py-3.5 rounded-xl font-semibold transition-all relative overflow-hidden ${
          popular
            ? 'bg-white text-[#0a0a0b] hover:bg-zinc-100'
            : 'bg-zinc-800 text-white hover:bg-zinc-700'
        } hover:scale-[1.02] active:scale-[0.98]`}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {getButtonText()}
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </span>
      </button>
    </motion.div>
  )
}

// =============================================================================
// 3D MOCKUP WINDOW COMPONENT
// =============================================================================
interface MockupWindowProps {
  title?: string
  children: React.ReactNode
  className?: string
  variant?: 'terminal' | 'code' | 'browser'
}

function MockupWindow({ title = 'Terminal', children, className = '', variant = 'terminal' }: MockupWindowProps) {
  const variantStyles = {
    terminal: 'bg-[#0c0c0e]',
    code: 'bg-[#1e1e2e]',
    browser: 'bg-zinc-900'
  }

  return (
    <div className={`relative rounded-xl border border-zinc-700/50 ${variantStyles[variant]} shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-sm ${className}`}>
      {/* Window Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="ml-4 text-xs text-zinc-500 font-mono">{title}</span>
        </div>
        {variant === 'terminal' && (
          <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
            LIVE
          </span>
        )}
      </div>
      {/* Window Content */}
      <div className="p-4 font-mono text-sm">
        {children}
      </div>
    </div>
  )
}

// =============================================================================
// CODE DIFF COMPONENT (BEFORE/AFTER)
// =============================================================================
interface CodeDiffProps {
  before: { filename: string; lines: Array<{ num: number; content: string; type?: 'removed' | 'context' }> }
  after: { filename: string; lines: Array<{ num: number; content: string; type?: 'added' | 'context' }> }
}

function CodeDiff({ before, after }: CodeDiffProps) {
  return (
    <div className="grid grid-cols-2 gap-1 text-xs">
      {/* Before Panel */}
      <MockupWindow title={before.filename} variant="code" className="rounded-r-none border-r-0">
        <div className="space-y-0.5 min-h-[200px]">
          {before.lines.map((line, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-2 py-0.5 rounded ${
                line.type === 'removed' ? 'bg-red-500/10 text-red-400' : 'text-zinc-400'
              }`}
            >
              <span className="text-zinc-600 w-6 text-right">{line.num}</span>
              <span className={line.type === 'removed' ? 'line-through' : ''}>{line.content}</span>
            </div>
          ))}
        </div>
      </MockupWindow>

      {/* After Panel */}
      <MockupWindow title={after.filename} variant="code" className="rounded-l-none">
        <div className="space-y-0.5 min-h-[200px]">
          {after.lines.map((line, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-2 py-0.5 rounded ${
                line.type === 'added' ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-400'
              }`}
            >
              <span className="text-zinc-600 w-6 text-right">{line.num}</span>
              <span>{line.content}</span>
            </div>
          ))}
        </div>
      </MockupWindow>
    </div>
  )
}

// =============================================================================
// FLOATING NOTIFICATION POPUP
// =============================================================================
interface NotificationPopupProps {
  type: 'slack' | 'github' | 'success' | 'error'
  title: string
  message: string
  className?: string
  delay?: number
}

function NotificationPopup({ type, title, message, className = '', delay = 0 }: NotificationPopupProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  const icons = {
    slack: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.166a2.528 2.528 0 0 1-2.522 2.521h-6.312z"/>
      </svg>
    ),
    github: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    ),
    success: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  }

  const colors = {
    slack: 'text-[#E01E5A] bg-[#E01E5A]/10 border-[#E01E5A]/20',
    github: 'text-white bg-zinc-800 border-zinc-700',
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    error: 'text-red-400 bg-red-500/10 border-red-500/20'
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.4, delay: delay * 0.1 }}
      className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm shadow-xl ${colors[type]} ${className}`}
    >
      <div className="flex-shrink-0">{icons[type]}</div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs opacity-70 mt-0.5">{message}</p>
      </div>
    </motion.div>
  )
}

// =============================================================================
// 3D HERO VISUAL - DUAL PANEL MOCKUP
// =============================================================================
function Hero3DVisual() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  // Terminal animation content - Shows full autonomous development loop
  const terminalContent = [
    { text: "$ devloop build 'add stripe checkout'", color: 'text-cyan-400' },
    { text: '> Reading codebase...', color: 'text-zinc-400' },
    { text: '> Planning implementation...', color: 'text-zinc-400' },
    { text: '> Generating components...', color: 'text-zinc-400' },
    { text: '> Creating API routes...', color: 'text-emerald-400', icon: true },
    { text: '> Writing tests... 8 tests', color: 'text-emerald-400', icon: true },
    { text: '> Running tests... 8/8 passed', color: 'text-emerald-400', icon: true },
    { text: '> Feature shipped in 47s', color: 'text-emerald-400', icon: true },
  ]

  // Code diff content
  const codeBefore = {
    filename: 'checkout.ts',
    lines: [
      { num: 154, content: 'async function processPayment(userId) {', type: 'context' as const },
      { num: 155, content: '  const query = `SELECT * FROM users', type: 'context' as const },
      { num: 156, content: '    WHERE id = ${userId}`;', type: 'removed' as const },
      { num: 157, content: '  const result = await db.raw(query);', type: 'removed' as const },
      { num: 158, content: '  return result;', type: 'context' as const },
    ]
  }

  const codeAfter = {
    filename: 'checkout.ts (fixed)',
    lines: [
      { num: 154, content: 'async function processPayment(userId) {', type: 'context' as const },
      { num: 155, content: '  const result = await db("users")', type: 'added' as const },
      { num: 156, content: '    .where({ id: userId })', type: 'added' as const },
      { num: 157, content: '    .first();', type: 'added' as const },
      { num: 158, content: '  return result;', type: 'context' as const },
    ]
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="relative mt-16 sm:mt-24"
      style={{ perspective: '1500px' }}
    >
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[120px] -translate-y-1/2" />
        <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-blue-500/15 rounded-full blur-[100px] -translate-y-1/2" />
      </div>

      {/* Main 3D container */}
      <div
        className="relative mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-4"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Left Panel - Terminal */}
        <motion.div
          initial={{ opacity: 0, rotateY: 15, rotateX: 5 }}
          animate={isInView ? { opacity: 1, rotateY: 8, rotateX: 3 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          whileHover={{ rotateY: 5, rotateX: 2, scale: 1.02 }}
          className="relative z-10"
          style={{
            transformStyle: 'preserve-3d',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 100px rgba(139, 92, 246, 0.1)'
          }}
        >
          <MockupWindow title="devloop ~ my-saas-app" variant="terminal">
            <div className="space-y-2 min-h-[280px]">
              {terminalContent.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.3, delay: 0.4 + i * 0.1 }}
                  className={`flex items-center gap-2 ${line.color}`}
                >
                  {line.icon && <span className="text-emerald-400">&#10003;</span>}
                  <span>{line.text}</span>
                </motion.div>
              ))}
            </div>
          </MockupWindow>

          {/* Floating Slack notification */}
          <motion.div
            initial={{ opacity: 0, x: -20, y: 20 }}
            animate={isInView ? { opacity: 1, x: -40, y: -20 } : {}}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="absolute -left-4 -top-4 lg:-left-12 lg:-top-8 z-20"
          >
            <NotificationPopup
              type="slack"
              title="#devloop-alerts"
              message="Feature shipped to production"
            />
          </motion.div>
        </motion.div>

        {/* Right Panel - Code Diff */}
        <motion.div
          initial={{ opacity: 0, rotateY: -10, rotateX: 5, translateZ: 50 }}
          animate={isInView ? { opacity: 1, rotateY: -5, rotateX: 3, translateZ: 30 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          whileHover={{ rotateY: -3, rotateX: 2, scale: 1.02 }}
          className="relative z-0"
          style={{
            transformStyle: 'preserve-3d',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 80px rgba(59, 130, 246, 0.08)'
          }}
        >
          <CodeDiff before={codeBefore} after={codeAfter} />

          {/* Floating GitHub notification */}
          <motion.div
            initial={{ opacity: 0, x: 20, y: 20 }}
            animate={isInView ? { opacity: 1, x: 40, y: -20 } : {}}
            transition={{ duration: 0.5, delay: 1.4 }}
            className="absolute -right-4 -bottom-4 lg:-right-12 lg:-bottom-8 z-20"
          >
            <NotificationPopup
              type="github"
              title="PR #142 merged"
              message="Stripe checkout implementation"
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Success badge floating in center */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.4, delay: 1.6, type: 'spring', stiffness: 200 }}
        className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 z-30"
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-medium text-sm">Ship with confidence</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

// =============================================================================
// FEATURE VISUAL COMPONENTS
// =============================================================================

// Animated File Tree for Auto-Discovery
function AnimatedFileTree() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  const files = [
    { name: 'src', type: 'folder', indent: 0, delay: 0 },
    { name: 'api', type: 'folder', indent: 1, delay: 0.1 },
    { name: 'users.ts', type: 'file', indent: 2, delay: 0.2, status: 'found' },
    { name: 'payments.ts', type: 'file', indent: 2, delay: 0.3, status: 'found' },
    { name: 'auth.ts', type: 'file', indent: 2, delay: 0.4, status: 'found' },
    { name: 'pages', type: 'folder', indent: 1, delay: 0.5 },
    { name: 'index.tsx', type: 'file', indent: 2, delay: 0.6, status: 'scanning' },
    { name: 'dashboard.tsx', type: 'file', indent: 2, delay: 0.7, status: 'found' },
    { name: 'components', type: 'folder', indent: 1, delay: 0.8 },
  ]

  return (
    <div ref={ref} className="font-mono text-xs space-y-1 p-3 bg-zinc-950/50 rounded-xl">
      {files.map((file, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.3, delay: file.delay }}
          className="flex items-center gap-2"
          style={{ paddingLeft: `${file.indent * 16}px` }}
        >
          {file.type === 'folder' ? (
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          <span className={file.type === 'folder' ? 'text-zinc-300' : 'text-zinc-500'}>{file.name}</span>
          {file.status === 'found' && (
            <motion.span
              initial={{ scale: 0 }}
              animate={isInView ? { scale: 1 } : {}}
              transition={{ delay: file.delay + 0.3, type: 'spring' }}
              className="ml-auto text-emerald-400"
            >
              &#10003;
            </motion.span>
          )}
          {file.status === 'scanning' && (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="ml-auto text-amber-400 text-[10px]"
            >
              scanning...
            </motion.span>
          )}
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 1 }}
        className="mt-3 pt-2 border-t border-zinc-800 text-emerald-400 flex items-center gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>24 endpoints discovered</span>
      </motion.div>
    </div>
  )
}

// Animated Code Fix for Self-Healing
function AnimatedCodeFix() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const [phase, setPhase] = useState<'bug' | 'fixing' | 'fixed'>('bug')

  useEffect(() => {
    if (isInView) {
      const timer1 = setTimeout(() => setPhase('fixing'), 1500)
      const timer2 = setTimeout(() => setPhase('fixed'), 3000)
      return () => { clearTimeout(timer1); clearTimeout(timer2) }
    }
  }, [isInView])

  return (
    <div ref={ref} className="font-mono text-xs space-y-1 relative overflow-hidden">
      {/* Bug code */}
      <motion.div
        animate={{
          opacity: phase === 'bug' ? 1 : 0,
          y: phase === 'bug' ? 0 : -20
        }}
        className="absolute inset-0"
      >
        <div className="text-zinc-600">{'// checkout.ts'}</div>
        <div className="text-red-400/80 bg-red-500/10 px-2 py-1 rounded">
          <span className="text-zinc-500">const query = </span>
          <span>{"`SELECT * WHERE id = ${id}`"}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-red-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>SQL Injection detected</span>
        </div>
      </motion.div>

      {/* Fixing animation */}
      <motion.div
        animate={{
          opacity: phase === 'fixing' ? 1 : 0,
          scale: phase === 'fixing' ? 1 : 0.95
        }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 mx-auto mb-2"
          >
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.div>
          <span className="text-amber-400">Generating fix...</span>
        </div>
      </motion.div>

      {/* Fixed code */}
      <motion.div
        animate={{
          opacity: phase === 'fixed' ? 1 : 0,
          y: phase === 'fixed' ? 0 : 20
        }}
        className={phase !== 'fixed' ? 'invisible' : ''}
      >
        <div className="text-zinc-600">{'// checkout.ts (fixed)'}</div>
        <div className="text-emerald-400/80 bg-emerald-500/10 px-2 py-1 rounded">
          <span className="text-zinc-500">const result = </span>
          <span>{'db("users").where({ id })'}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-emerald-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Fixed & verified</span>
        </div>
      </motion.div>
    </div>
  )
}

// Animated Pipeline for Deploy Verification
function AnimatedPipeline() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  const steps = [
    { name: 'Build', icon: '🔨', delay: 0 },
    { name: 'Deploy', icon: '🚀', delay: 0.4 },
    { name: 'Test', icon: '🧪', delay: 0.8 },
    { name: 'Verify', icon: '✓', delay: 1.2 },
  ]

  return (
    <div ref={ref} className="flex items-center justify-between px-2">
      {steps.map((step, i) => (
        <Fragment key={step.name}>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={isInView ? { scale: 1, opacity: 1 } : {}}
            transition={{ delay: step.delay, type: 'spring', stiffness: 200 }}
            className="flex flex-col items-center gap-1"
          >
            <motion.div
              animate={isInView ? {
                backgroundColor: ['rgba(34, 197, 94, 0)', 'rgba(34, 197, 94, 0.2)']
              } : {}}
              transition={{ delay: step.delay + 0.3 }}
              className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg"
            >
              {step.icon}
            </motion.div>
            <span className="text-[10px] text-zinc-500">{step.name}</span>
          </motion.div>
          {i < steps.length - 1 && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ delay: step.delay + 0.2, duration: 0.3 }}
              className="flex-1 h-0.5 bg-gradient-to-r from-emerald-500/50 to-emerald-500/20 mx-1 origin-left"
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}

// Visual Diff Mockup
function VisualDiffMockup() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  return (
    <div ref={ref} className="relative">
      {/* Before/After comparison */}
      <div className="flex gap-2">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="flex-1 bg-zinc-900 rounded-lg p-2 border border-zinc-800"
        >
          <div className="text-[10px] text-zinc-600 mb-1">Before</div>
          <div className="h-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded flex items-center justify-center">
            <div className="w-12 h-4 bg-zinc-700 rounded" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.4 }}
          className="flex-1 bg-zinc-900 rounded-lg p-2 border border-purple-500/30"
        >
          <div className="text-[10px] text-purple-400 mb-1">After</div>
          <div className="h-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded flex items-center justify-center relative">
            <div className="w-12 h-4 bg-purple-500/30 rounded border border-purple-500/50" />
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.8 }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center"
            >
              <span className="text-[8px] text-white">!</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 1 }}
        className="mt-2 text-center text-[10px] text-purple-400"
      >
        1 visual change detected
      </motion.div>
    </div>
  )
}

// Slack Message Mockup
function SlackMessageMockup() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="bg-[#1a1d21] rounded-xl p-3 border border-zinc-800"
    >
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs">D</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">DevLoop</span>
            <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-800">APP</span>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.3 }}
            className="mt-1 text-sm text-zinc-300"
          >
            <span className="text-emerald-400">All tests passing</span> for my-saas-app
          </motion.div>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={isInView ? { opacity: 1, height: 'auto' } : {}}
            transition={{ delay: 0.5 }}
            className="mt-2 p-2 rounded bg-zinc-900/50 border-l-2 border-emerald-500"
          >
            <div className="text-[11px] text-zinc-400">
              <div>Tests: 24/24 passed</div>
              <div>Duration: 4.2s</div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

// Animated Terminal for One Command
function AnimatedTerminalCommand() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const [charIndex, setCharIndex] = useState(0)
  const command = 'npx create-devloop'

  useEffect(() => {
    if (isInView && charIndex < command.length) {
      const timer = setTimeout(() => setCharIndex(c => c + 1), 80)
      return () => clearTimeout(timer)
    }
  }, [isInView, charIndex, command.length])

  return (
    <div ref={ref} className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-zinc-500">$</span>
        <span className="text-emerald-400">{command.slice(0, charIndex)}</span>
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="w-2 h-5 bg-emerald-400"
        />
      </div>
      {charIndex >= command.length && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-3 space-y-1 text-xs"
        >
          <div className="text-zinc-400">Setting up DevLoop...</div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span>&#10003;</span>
            <span>Ready in 12s</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// =============================================================================
// TYPES
// =============================================================================
interface User {
  id: string
  email: string
  created_at: string
}

interface DashboardSummary {
  total_projects: number
  total_qa_runs: number
  passed_runs: number
  failed_runs: number
  license_key: string | null
  plan: string | null
  subscription_active: boolean
}

interface Project {
  id: string
  name: string
  description: string | null
  api_url: string | null
  app_url: string | null
  stack: string | null
  github_repo: string | null
  slack_webhook_url: string | null
  slack_notify_on_pass: boolean
  slack_notify_on_fail: boolean
  qa_schedule: 'none' | 'hourly' | 'daily' | 'weekly'
  next_scheduled_run: string | null
  created_at: string
  last_qa_run_at: string | null
  last_qa_status: string | null
  production_url: string | null
  production_api_url: string | null
  enable_production_testing: boolean
  production_test_schedule: 'none' | 'hourly' | 'daily' | 'weekly'
  health_check_endpoint: string | null
  health_check_status: string | null
  last_health_check_at: string | null
}

// =============================================================================
// AUTH CONTEXT
// =============================================================================
const useAuth = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(null)

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(setUser)
        .catch(() => logout())
    }
  }, [token])

  return { token, user, login, logout, isAuthenticated: !!token }
}

// =============================================================================
// LANDING PAGE
// =============================================================================
function LandingPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)

  const handleCheckout = async (plan: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      })

      if (res.ok) {
        const { checkout_url } = await res.json()
        window.location.href = checkout_url
      }
    } catch (err) {
      console.error('Checkout error:', err)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText('npx create-devloop')
  }

  const faqItems = [
    {
      question: 'What is DevLoop?',
      answer: 'DevLoop is the last mile of AI coding. While Copilot and Cursor help you write code, DevLoop actually ships it. Describe what you want in plain English, and DevLoop builds it, tests it, deploys it, and verifies it works in production.'
    },
    {
      question: 'How is this different from Copilot/Cursor?',
      answer: 'Copilot and Cursor are code completion tools - they help you write code faster. DevLoop completes the entire development loop: it understands your codebase, generates complete features, writes tests, deploys to production, and verifies everything works. You describe, DevLoop ships.'
    },
    {
      question: 'What tech stacks are supported?',
      answer: 'DevLoop works with any tech stack - React, Vue, Angular, Node.js, Python, Ruby, Go, and more. It scans your codebase to understand your architecture and generates code that fits your existing patterns.'
    },
    {
      question: 'Do I need to write any code?',
      answer: 'Nope! Just describe what you want built in plain English. DevLoop handles everything: understanding your codebase, generating the implementation, writing tests, deploying, and verifying. You can review the PR before it ships if you want.'
    },
    {
      question: 'How is this different from CI/CD?',
      answer: 'CI/CD runs tests and deploys code you wrote. DevLoop writes the code for you. It\'s an autonomous development agent that takes your description, implements the feature, tests it, deploys it, and confirms it works. CI/CD is part of your pipeline; DevLoop IS the pipeline.'
    },
    {
      question: 'Is my code secure?',
      answer: 'Yes. DevLoop never stores your source code. It runs locally in your environment or in isolated secure containers. All API communication is encrypted, and we\'re SOC 2 compliant.'
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0b] overflow-x-hidden">
      <Navbar activePage="home" showFeaturesPricing={true} />

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8" style={{
        background: `
          radial-gradient(ellipse at top, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at bottom right, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
          #0a0a0b
        `
      }}>
        {/* Background effects - floating orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-20 left-1/2 w-[600px] h-[300px] bg-violet-500/8 rounded-full blur-[100px]"></div>
          {/* Subtle grid pattern overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-700 bg-zinc-800/50 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-sm text-zinc-300 font-medium">Now with GitHub Actions + Slack Alerts</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6"
          >
            <span className="text-white">The last mile</span>
            <br />
            <span className="text-zinc-400">
              of AI coding.
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl sm:text-2xl text-zinc-400 max-w-3xl mx-auto mb-10 leading-relaxed"
          >
            AI writes your code. DevLoop ships it. Describe what you want,
            <span className="text-white font-medium"> get it working in production.</span>
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
          >
            <a
              href="#pricing"
              className="group relative px-8 py-4 text-lg font-semibold text-[#0a0a0b] bg-white rounded-xl hover:bg-zinc-100 transition-all shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
            >
              <span className="relative z-10">Start Shipping Faster</span>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-cyan-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
            <a
              href="/docs"
              className="px-8 py-4 text-lg font-semibold text-white border border-zinc-700 rounded-xl hover:bg-zinc-800/50 transition-all"
            >
              View Documentation
            </a>
          </motion.div>

          {/* Code snippet */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-zinc-900/80 border border-zinc-800 font-mono text-sm"
          >
            <span className="text-zinc-500">$</span>
            <span className="text-zinc-200">npx create-devloop</span>
            <button
              onClick={copyToClipboard}
              className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-white"
              title="Copy to clipboard"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </motion.div>
        </div>

        {/* 3D Visual Demo */}
        <Hero3DVisual />
      </section>

      {/* ===== SOCIAL PROOF ===== */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-y border-zinc-800/50">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-zinc-500 text-sm font-medium mb-6">DEVELOPERS WHO SHIP WHILE THEY SLEEP</p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-50">
            {['Indie Hackers', 'YC Startups', 'Open Source', 'Agencies', 'SaaS Teams'].map((name) => (
              <span key={name} className="text-zinc-400 font-semibold text-lg">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES SECTION - PREMIUM BENTO GRID ===== */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />

        <div className="mx-auto max-w-6xl relative z-10">
          <SectionTitle
            badge="Features"
            title="From description to production"
            subtitle="DevLoop completes the autonomous development loop: understand, build, test, deploy, verify."
          />

          {/* Premium Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Auto-Discovery - Large Hero Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0 }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/10 via-zinc-900/80 to-zinc-900 border border-emerald-500/20 p-6 md:col-span-2 lg:col-span-2 min-h-[380px] hover:border-emerald-500/40 transition-all duration-500 hover:shadow-[0_0_60px_-12px_rgba(16,185,129,0.3)]"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.2),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Always Learning
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Understands Your Codebase</h3>
                    <p className="text-zinc-400 text-sm max-w-sm">
                      Reads your entire project, learns your patterns, frameworks, and architecture before building.
                    </p>
                  </div>
                </div>

                {/* Animated File Tree Visual */}
                <div className="flex-1 mt-4">
                  <AnimatedFileTree />
                </div>

                {/* Feature tags */}
                <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-zinc-800">
                  {['API Routes', 'Page Routes', 'WebSockets', 'GraphQL'].map((tag) => (
                    <span key={tag} className="text-xs text-zinc-500 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Self-Healing - Tall Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-zinc-900/80 to-zinc-900 border border-amber-500/20 p-6 min-h-[380px] hover:border-amber-500/40 transition-all duration-500 hover:shadow-[0_0_60px_-12px_rgba(245,158,11,0.3)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(245,158,11,0.15),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 h-full flex flex-col">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Writes and Fixes Code</h3>
                <p className="text-zinc-400 text-sm mb-6">Generates components, API routes, and tests. Fixes what breaks.</p>

                {/* Animated Code Fix Visual */}
                <div className="flex-1 min-h-[120px]">
                  <AnimatedCodeFix />
                </div>
              </div>
            </motion.div>

            {/* Deploy Verification - Medium Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500/10 via-zinc-900/80 to-zinc-900 border border-cyan-500/20 p-6 min-h-[200px] hover:border-cyan-500/40 transition-all duration-500 hover:shadow-[0_0_60px_-12px_rgba(6,182,212,0.3)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.15),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 h-full flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Ships to Production</h3>
                <p className="text-zinc-400 text-sm mb-4">Deploys, verifies live, rolls back if needed.</p>

                {/* Pipeline Animation */}
                <div className="mt-auto">
                  <AnimatedPipeline />
                </div>
              </div>
            </motion.div>

            {/* Visual Testing - Medium Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-500/10 via-zinc-900/80 to-zinc-900 border border-purple-500/20 p-6 min-h-[200px] hover:border-purple-500/40 transition-all duration-500 hover:shadow-[0_0_60px_-12px_rgba(168,85,247,0.3)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.15),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 h-full flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Verifies Everything Works</h3>
                <p className="text-zinc-400 text-sm mb-4">Runs tests, checks screenshots, validates APIs.</p>

                {/* Visual Diff Mockup */}
                <div className="mt-auto">
                  <VisualDiffMockup />
                </div>
              </div>
            </motion.div>

            {/* Slack Alerts - Medium Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500/10 via-zinc-900/80 to-zinc-900 border border-rose-500/20 p-6 min-h-[200px] hover:border-rose-500/40 transition-all duration-500 hover:shadow-[0_0_60px_-12px_rgba(244,63,94,0.3)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(244,63,94,0.15),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-5 h-5 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Keeps You Informed</h3>
                <p className="text-zinc-400 text-sm mb-4">Slack alerts when features ship or issues arise.</p>

                {/* Slack Message Mockup */}
                <div className="mt-auto">
                  <SlackMessageMockup />
                </div>
              </div>
            </motion.div>

            {/* Production Testing - Medium Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-500/10 via-zinc-900/80 to-zinc-900 border border-red-500/20 p-6 min-h-[200px] hover:border-red-500/40 transition-all duration-500 hover:shadow-[0_0_60px_-12px_rgba(239,68,68,0.3)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.15),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Production Testing</h3>
                <p className="text-zinc-400 text-sm mb-4">Smoke tests, health monitoring, and live validation on production.</p>

                {/* Production Test Mockup */}
                <div className="mt-auto space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-zinc-400">Health Check</span>
                    <span className="text-emerald-400 ml-auto">45ms</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-zinc-400">API Smoke Tests</span>
                    <span className="text-emerald-400 ml-auto">5/5 passed</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-zinc-400">Public Endpoints</span>
                    <span className="text-emerald-400 ml-auto">OK</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* One Command Setup - Wide Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-800 via-zinc-900/80 to-zinc-900 border border-zinc-700 p-6 md:col-span-2 lg:col-span-3 hover:border-zinc-500 transition-all duration-500 hover:shadow-[0_0_60px_-12px_rgba(255,255,255,0.1)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">One Command to Ship</h3>
                  </div>
                  <p className="text-zinc-400 text-sm max-w-md">Describe what you want, DevLoop handles the rest. No setup, no babysitting, just results.</p>
                </div>

                {/* Animated Terminal */}
                <div className="flex-1 max-w-md">
                  <AnimatedTerminalCommand />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== GETTING STARTED - PREMIUM REDESIGN ===== */}
      <section id="how-it-works" className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Premium background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 via-transparent to-zinc-900/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.08),transparent_60%)]" />

        <div className="mx-auto max-w-6xl relative z-10">
          <SectionTitle
            badge="Getting Started"
            title="Describe it. Ship it. Done."
            subtitle="From idea to production in three steps."
          />

          {/* Steps with connecting line */}
          <div className="relative">
            {/* Connecting gradient line - hidden on mobile */}
            <div className="hidden lg:block absolute top-24 left-[16.67%] right-[16.67%] h-0.5">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/50 via-cyan-500/50 to-emerald-500/50 blur-sm" />
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 via-cyan-500/30 to-emerald-500/30" />
            </div>

            <div className="grid lg:grid-cols-3 gap-12 lg:gap-8">
              {/* Step 01 - Install */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative"
              >
                {/* Step number with glow */}
                <div className="relative mb-6">
                  <span className="text-7xl lg:text-8xl font-bold bg-gradient-to-br from-violet-400 via-violet-500 to-purple-600 bg-clip-text text-transparent">
                    01
                  </span>
                  <div className="absolute inset-0 bg-violet-500/20 blur-3xl -z-10" />
                </div>

                <h3 className="text-2xl font-bold text-white mb-4">Install</h3>

                {/* Premium Terminal Window */}
                <div className="group relative rounded-xl overflow-hidden border border-zinc-700/50 bg-[#0d0d0d] shadow-2xl shadow-violet-500/10 hover:shadow-violet-500/20 hover:border-violet-500/30 transition-all duration-500">
                  {/* macOS window header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <span className="ml-2 text-xs text-zinc-500 font-medium">Terminal</span>
                    <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs text-zinc-500 hover:text-white px-2 py-1 rounded hover:bg-zinc-800">
                      Copy
                    </button>
                  </div>

                  {/* Terminal content with typing effect simulation */}
                  <div className="p-5 font-mono text-sm space-y-2">
                    <div className="flex items-center">
                      <span className="text-emerald-400 mr-2">$</span>
                      <span className="text-cyan-300">npx create-devloop</span>
                    </div>
                    <div className="text-zinc-500 text-xs mt-3">Output:</div>
                    <div className="text-emerald-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      DevLoop installed
                    </div>
                    <div className="text-emerald-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Config created
                    </div>
                    <div className="text-zinc-300 flex items-center gap-2">
                      <span className="text-yellow-400">?</span>
                      Enter license key: <span className="text-zinc-600">****</span>
                    </div>
                    <div className="text-emerald-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Activated!
                    </div>
                  </div>
                </div>

                <p className="text-zinc-400 text-sm mt-5 leading-relaxed">
                  One command sets everything up. Enter your license key and you're ready to go.
                </p>
              </motion.div>

              {/* Step 02 - Run */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="relative"
              >
                {/* Step number with glow */}
                <div className="relative mb-6">
                  <span className="text-7xl lg:text-8xl font-bold bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
                    02
                  </span>
                  <div className="absolute inset-0 bg-cyan-500/20 blur-3xl -z-10" />
                </div>

                <h3 className="text-2xl font-bold text-white mb-4">Describe</h3>

                {/* Premium Terminal Window */}
                <div className="group relative rounded-xl overflow-hidden border border-zinc-700/50 bg-[#0d0d0d] shadow-2xl shadow-cyan-500/10 hover:shadow-cyan-500/20 hover:border-cyan-500/30 transition-all duration-500">
                  {/* macOS window header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <span className="ml-2 text-xs text-zinc-500 font-medium">Terminal</span>
                    <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs text-zinc-500 hover:text-white px-2 py-1 rounded hover:bg-zinc-800">
                      Copy
                    </button>
                  </div>

                  {/* Terminal content */}
                  <div className="p-5 font-mono text-sm space-y-2">
                    <div className="flex items-center">
                      <span className="text-emerald-400 mr-2">$</span>
                      <span className="text-cyan-300">devloop build <span className="text-yellow-400">'add stripe checkout'</span></span>
                    </div>
                    <div className="text-zinc-400 mt-3 flex items-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      Planning implementation...
                    </div>
                    <div className="text-emerald-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Creating <span className="text-white font-semibold">CheckoutForm.tsx</span>
                    </div>
                    <div className="text-emerald-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Creating <span className="text-white font-semibold">/api/checkout</span> route
                    </div>
                    <div className="text-emerald-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Writing <span className="text-white font-semibold">8</span> tests
                    </div>
                  </div>
                </div>

                <p className="text-zinc-400 text-sm mt-5 leading-relaxed">
                  Describe what you want in plain English. DevLoop reads your codebase and builds it.
                </p>
              </motion.div>

              {/* Step 03 - Ship */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="relative"
              >
                {/* Step number with glow */}
                <div className="relative mb-6">
                  <span className="text-7xl lg:text-8xl font-bold bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 bg-clip-text text-transparent">
                    03
                  </span>
                  <div className="absolute inset-0 bg-emerald-500/20 blur-3xl -z-10" />
                </div>

                <h3 className="text-2xl font-bold text-white mb-4">Ship</h3>

                {/* Premium Terminal Window */}
                <div className="group relative rounded-xl overflow-hidden border border-zinc-700/50 bg-[#0d0d0d] shadow-2xl shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:border-emerald-500/30 transition-all duration-500">
                  {/* macOS window header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <span className="ml-2 text-xs text-zinc-500 font-medium">Terminal</span>
                    <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs text-zinc-500 hover:text-white px-2 py-1 rounded hover:bg-zinc-800">
                      Copy
                    </button>
                  </div>

                  {/* Terminal content */}
                  <div className="p-5 font-mono text-sm space-y-2">
                    <div className="flex items-center">
                      <span className="text-emerald-400 mr-2">$</span>
                      <span className="text-cyan-300">devloop deploy <span className="text-yellow-400">--verify</span></span>
                    </div>
                    <div className="text-emerald-400 mt-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Deployed to production
                    </div>
                    <div className="text-emerald-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Health check passed
                    </div>
                    <div className="text-emerald-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      All systems <span className="text-emerald-300 font-semibold">green</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-zinc-800 text-zinc-500 text-xs">
                      Production verified in 2.3s
                    </div>
                  </div>
                </div>

                <p className="text-zinc-400 text-sm mt-5 leading-relaxed">
                  DevLoop deploys, runs tests, and verifies production is working. You just approve.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <SectionTitle
            badge="Pricing"
            title="Simple, transparent pricing"
            subtitle="Start free, upgrade when you need more. No credit card required."
          />

          <StaggeredGrid className="grid md:grid-cols-3 gap-6">
            <PricingCard
              delay={0}
              name="Free"
              price={0}
              description="For exploring DevLoop"
              features={[
                '1 project',
                'Unlimited builds',
                'API testing',
                'Manual runs only',
                'Email alerts',
              ]}
              onSelect={() => window.location.href = '/dashboard'}
            />
            <PricingCard
              delay={1}
              name="Pro"
              price={39}
              description="For indie hackers & small teams"
              features={[
                '5 projects',
                'Unlimited builds',
                'API & UI testing',
                'Auto-fix suggestions',
                'Hourly scheduled runs',
                'Slack integration',
                'GitHub Actions',
                'Priority support',
              ]}
              popular
              onSelect={() => handleCheckout('pro')}
            />
            <PricingCard
              delay={2}
              name="Team"
              price={79}
              description="For teams shipping at scale"
              features={[
                '15 projects',
                'Unlimited builds',
                'Everything in Pro',
                'Team access controls',
                'Visual diff testing',
                'Custom integrations',
                'Dedicated support',
              ]}
              onSelect={() => handleCheckout('team')}
            />
          </StaggeredGrid>

          <p className="text-center text-sm text-zinc-500 mt-8">
            Need more? <a href="/fair-use" className="text-white hover:underline">Read our fair use policy</a> for details on soft throttling for paid plans.
            <br />
            Annual billing available at checkout (2 months free).
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-zinc-900/30">
        <div className="mx-auto max-w-3xl">
          <SectionTitle
            badge="FAQ"
            title="Frequently asked questions"
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {faqItems.map((item, index) => (
              <FAQItem
                key={index}
                question={item.question}
                answer={item.answer}
                isOpen={openFAQ === index}
                onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl border border-zinc-700 bg-gradient-to-b from-zinc-800/50 to-transparent p-12 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-zinc-600/20 via-transparent to-transparent pointer-events-none"></div>
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Stop babysitting deployments.
              </h2>
              <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
                Let DevLoop ship features while you focus on what's next.
              </p>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold text-[#0a0a0b] bg-white rounded-xl hover:bg-zinc-100 transition-all shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== FOOTER - Premium 4-column layout ===== */}
      <footer className="border-t border-white/5 bg-black">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 lg:gap-12">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-3 mb-4">
                <Logo size={28} variant="mark" color="white" />
                <span className="text-lg font-semibold text-white">DevLoop</span>
              </Link>
              <p className="text-sm text-gray-500 leading-relaxed">
                Autonomous development.<br />
                Describe it. Ship it. Done.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-medium text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#features" className="text-gray-500 hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-gray-500 hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/docs" className="text-gray-500 hover:text-white transition-colors">Docs</Link></li>
                <li><Link to="/dashboard" className="text-gray-500 hover:text-white transition-colors">Dashboard</Link></li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h4 className="font-medium text-white mb-4">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/privacy" className="text-gray-500 hover:text-white transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="text-gray-500 hover:text-white transition-colors">Terms</Link></li>
                <li><a href="#" className="text-gray-500 hover:text-white transition-colors">Fair Use</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-8 mt-12 border-t border-white/5 gap-4">
            <p className="text-sm text-gray-600">
              &copy; {new Date().getFullYear()} DevLoop. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              All systems operational
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// =============================================================================
// AUTH PAGES
// =============================================================================
function AuthVerify() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token')
      if (!token) {
        setStatus('error')
        setErrorMsg('No token provided')
        return
      }

      try {
        const res = await fetch(`${API_URL}/api/v1/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        if (res.ok) {
          const data = await res.json()
          login(data.access_token)
          setStatus('success')
          setTimeout(() => navigate('/dashboard'), 1500)
        } else {
          const errorData = await res.json().catch(() => ({}))
          setStatus('error')
          setErrorMsg(errorData.detail || 'Invalid or expired link')
        }
      } catch {
        setStatus('error')
        setErrorMsg('Failed to verify. Please try again.')
      }
    }

    verifyToken()
  }, [searchParams, login, navigate])

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="text-center">
        {status === 'loading' && <div className="text-zinc-400">Verifying your magic link...</div>}
        {status === 'success' && <div className="text-cyan-400">Login successful! Redirecting to dashboard...</div>}
        {status === 'error' && (
          <div>
            <div className="text-red-400 mb-4">{errorMsg}</div>
            <Link to="/dashboard" className="text-violet-400 hover:text-violet-300 underline">Try again</Link>
          </div>
        )}
      </div>
    </div>
  )
}

function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      login(token)
      setStatus('success')
      setTimeout(() => navigate('/dashboard'), 1500)
    } else {
      setStatus('error')
    }
  }, [searchParams, login, navigate])

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="text-center">
        {status === 'loading' && <div className="text-zinc-400">Verifying...</div>}
        {status === 'success' && <div className="text-cyan-400">Login successful! Redirecting...</div>}
        {status === 'error' && <div className="text-red-400">Invalid or expired link. <Link to="/" className="underline">Try again</Link></div>}
      </div>
    </div>
  )
}

function CheckoutSuccess() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => navigate('/dashboard'), 3000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 mx-auto mb-6 rounded-full bg-cyan-500/10 flex items-center justify-center"
        >
          <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
        <p className="text-zinc-400 mb-6">Check your email for the magic link to access your dashboard and license key.</p>
        <p className="text-zinc-500 text-sm">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}

// =============================================================================
// DASHBOARD LOGIN FORM
// =============================================================================
function DashboardLoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setMessage('')

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (res.ok) {
        setMessage('Check your email for the magic link!')
      } else {
        setMessage('Something went wrong. Please try again.')
      }
    } catch {
      setMessage('Something went wrong. Please try again.')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Magic Link'}
      </button>
      {message && (
        <p className={`text-center text-sm ${message.includes('Check') ? 'text-cyan-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </form>
  )
}

// =============================================================================
// DASHBOARD PAGE
// =============================================================================
function Dashboard() {
  const { token, user, logout, isAuthenticated } = useAuth()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [requiresUpgrade, setRequiresUpgrade] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', api_url: '', app_url: '', stack: '' })
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [_activeTab, _setActiveTab] = useState<'overview' | 'projects' | 'settings'>('overview')
  const [projectSettings, setProjectSettings] = useState({
    name: '',
    description: '',
    api_url: '',
    app_url: '',
    github_repo: '',
    slack_webhook_url: '',
    slack_notify_on_pass: false,
    slack_notify_on_fail: true,
    qa_schedule: 'none' as 'none' | 'hourly' | 'daily' | 'weekly',
    production_url: '',
    production_api_url: '',
    enable_production_testing: false,
    production_test_schedule: 'none' as 'none' | 'hourly' | 'daily' | 'weekly',
    health_check_endpoint: '/health'
  })
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [runningProductionTest, setRunningProductionTest] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    const fetchData = async () => {
      try {
        const summaryRes = await fetch(`${API_URL}/api/v1/dashboard/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (summaryRes.status === 403) {
          setRequiresUpgrade(true)
          setLoading(false)
          return
        }

        const projectsRes = await fetch(`${API_URL}/api/v1/dashboard/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (summaryRes.ok) setSummary(await summaryRes.json())
        if (projectsRes.ok) setProjects(await projectsRes.json())
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      }
      setLoading(false)
    }

    fetchData()
  }, [token])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/api/v1/dashboard/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newProject)
      })

      if (res.ok) {
        const project = await res.json()
        setProjects([project, ...projects])
        setShowNewProject(false)
        setNewProject({ name: '', description: '', api_url: '', app_url: '', stack: '' })
      }
    } catch (err) {
      console.error('Create project error:', err)
    }
  }

  const handleManageBilling = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/billing/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })

      if (res.ok) {
        const { portal_url } = await res.json()
        window.location.href = portal_url
      }
    } catch (err) {
      console.error('Billing portal error:', err)
    }
  }

  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(plan)
    try {
      const res = await fetch(`${API_URL}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email: user?.email })
      })

      if (res.ok) {
        const { checkout_url } = await res.json()
        window.location.href = checkout_url
      }
    } catch (err) {
      console.error('Checkout error:', err)
    }
    setCheckoutLoading(null)
  }

  const handleUpdateProject = async (projectId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/dashboard/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(projectSettings)
      })

      if (res.ok) {
        const updated = await res.json()
        setProjects(projects.map(p => p.id === projectId ? updated : p))
        setEditingProject(null)
      }
    } catch (err) {
      console.error('Update project error:', err)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      const res = await fetch(`${API_URL}/api/v1/dashboard/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        setProjects(projects.filter(p => p.id !== projectId))
      }
    } catch (err) {
      console.error('Delete project error:', err)
    }
  }

  const handleRunProductionTest = async (projectId: string) => {
    setRunningProductionTest(projectId)
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/production-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })

      if (res.ok) {
        // Refresh projects to get updated health status
        const projectsRes = await fetch(`${API_URL}/api/v1/dashboard/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (projectsRes.ok) setProjects(await projectsRes.json())
      }
    } catch (err) {
      console.error('Production test error:', err)
    }
    setRunningProductionTest(null)
  }

  const openProjectSettings = (project: Project) => {
    setProjectSettings({
      name: project.name,
      description: project.description || '',
      api_url: project.api_url || '',
      app_url: project.app_url || '',
      github_repo: project.github_repo || '',
      slack_webhook_url: project.slack_webhook_url || '',
      slack_notify_on_pass: project.slack_notify_on_pass,
      slack_notify_on_fail: project.slack_notify_on_fail,
      qa_schedule: project.qa_schedule || 'none',
      production_url: project.production_url || '',
      production_api_url: project.production_api_url || '',
      enable_production_testing: project.enable_production_testing || false,
      production_test_schedule: project.production_test_schedule || 'none',
      health_check_endpoint: project.health_check_endpoint || '/health'
    })
    setEditingProject(project)
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0b]">
        <Navbar activePage="dashboard" />
        <div className="pt-32 px-6">
          <div className="mx-auto max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Welcome to DevLoop</h1>
              <p className="text-zinc-400">Sign in to access your dashboard</p>
            </div>
            <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30">
              <DashboardLoginForm />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    )
  }

  // Requires upgrade
  if (requiresUpgrade) {
    return (
      <div className="min-h-screen bg-[#0a0a0b]">
        <Navbar activePage="dashboard" user={user} onLogout={logout} />
        <div className="pt-32 px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Choose a Plan</h1>
            <p className="text-zinc-400 mb-8">Select a plan to start using DevLoop</p>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                { name: 'Pro', price: 39, desc: '5 projects, 30 runs/day' },
                { name: 'Team', price: 79, desc: '15 projects, 50 runs/day' },
              ].map((plan) => (
                <div key={plan.name} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-zinc-400 text-sm mb-4">{plan.desc}</p>
                  <div className="text-3xl font-bold text-white mb-4">${plan.price}<span className="text-zinc-500 text-sm">/mo</span></div>
                  <button
                    onClick={() => handleCheckout(plan.name.toLowerCase())}
                    disabled={checkoutLoading === plan.name.toLowerCase()}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50"
                  >
                    {checkoutLoading === plan.name.toLowerCase() ? 'Loading...' : 'Get Started'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <Navbar activePage="dashboard" user={user} onLogout={logout} />

      <div className="pt-24 px-6 pb-12">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-zinc-400">Manage your projects and test runs</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleManageBilling}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Manage Billing
              </button>
              <button
                onClick={() => setShowNewProject(true)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:from-violet-500 hover:to-purple-500 transition-all"
              >
                New Project
              </button>
            </div>
          </div>

          {/* Premium Stats Cards */}
          {summary && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                {
                  label: 'Projects',
                  value: summary.total_projects,
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  ),
                  gradient: 'from-violet-500/20 to-purple-500/20',
                  iconBg: 'bg-violet-500/10',
                  iconColor: 'text-violet-400'
                },
                {
                  label: 'Total Builds',
                  value: summary.total_qa_runs,
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ),
                  gradient: 'from-blue-500/20 to-cyan-500/20',
                  iconBg: 'bg-blue-500/10',
                  iconColor: 'text-blue-400'
                },
                {
                  label: 'Shipped',
                  value: summary.passed_runs,
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ),
                  gradient: 'from-emerald-500/20 to-green-500/20',
                  iconBg: 'bg-emerald-500/10',
                  iconColor: 'text-emerald-400',
                  valueColor: 'text-emerald-400'
                },
                {
                  label: 'Failed',
                  value: summary.failed_runs,
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ),
                  gradient: 'from-red-500/20 to-orange-500/20',
                  iconBg: 'bg-red-500/10',
                  iconColor: 'text-red-400',
                  valueColor: 'text-red-400'
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`group relative p-5 rounded-xl border border-white/[0.08] bg-gradient-to-br ${stat.gradient} backdrop-blur-sm hover:border-white/[0.15] transition-all duration-300 hover:-translate-y-0.5 overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <div className="text-zinc-400 text-sm mb-1 font-medium">{stat.label}</div>
                      <div className={`text-3xl font-bold tracking-tight ${stat.valueColor || 'text-white'}`}>{stat.value}</div>
                    </div>
                    <div className={`${stat.iconBg} ${stat.iconColor} p-2.5 rounded-lg`}>
                      {stat.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* License Key */}
          {summary?.license_key && (
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-zinc-400 text-sm">Your License Key</div>
                  <div className="text-white font-mono">{summary.license_key}</div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(summary.license_key!)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Projects List */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Projects</h2>
            {projects.length === 0 ? (
              <div className="p-8 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
                <p className="text-zinc-400 mb-4">No projects yet. Create your first project to get started.</p>
                <button
                  onClick={() => setShowNewProject(true)}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium"
                >
                  Create Project
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {projects.map((project) => (
                  <div key={project.id} className="group relative p-5 rounded-xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 hover:border-white/[0.15] hover:from-zinc-900 hover:to-zinc-800/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                    <div className="relative flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">{project.name}</h3>
                            {project.description && <p className="text-zinc-400 text-sm mt-0.5 line-clamp-1">{project.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-4 text-xs">
                          {/* QA Status Indicator */}
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                            project.last_qa_status === 'passed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : project.last_qa_status === 'failed'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              project.last_qa_status === 'passed' ? 'bg-emerald-400' :
                              project.last_qa_status === 'failed' ? 'bg-red-400' : 'bg-zinc-400'
                            }`} />
                            {project.last_qa_status === 'passed' ? 'QA Passed' : project.last_qa_status === 'failed' ? 'QA Failed' : 'No QA runs'}
                          </div>
                          {/* Production Health Status - Only show when production testing is enabled */}
                          {project.enable_production_testing && (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                              project.health_check_status === 'healthy'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : project.health_check_status === 'degraded'
                                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                : project.health_check_status === 'down'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                            }`}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              {project.health_check_status === 'healthy' ? 'Prod Healthy' :
                               project.health_check_status === 'degraded' ? 'Prod Degraded' :
                               project.health_check_status === 'down' ? 'Prod Down' : 'Prod Unknown'}
                            </div>
                          )}
                          {project.qa_schedule !== 'none' && (
                            <span className="text-zinc-500 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {project.qa_schedule}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        {/* Run Production Test Button - Only show when production testing is enabled */}
                        {project.enable_production_testing && (
                          <button
                            onClick={() => handleRunProductionTest(project.id)}
                            disabled={runningProductionTest === project.id}
                            className={`p-2 rounded-lg transition-all ${
                              runningProductionTest === project.id
                                ? 'text-red-400 bg-red-500/10 animate-pulse'
                                : 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10'
                            }`}
                            title="Run Production Test"
                          >
                            {runningProductionTest === project.id ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => openProjectSettings(project)}
                          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      <AnimatePresence>
        {showNewProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
            onClick={() => setShowNewProject(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-2xl border border-zinc-800 bg-zinc-900"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-white mb-4">New Project</h2>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <input
                  type="text"
                  placeholder="Project name"
                  value={newProject.name}
                  onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newProject.description}
                  onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                />
                <input
                  type="url"
                  placeholder="API URL (optional)"
                  value={newProject.api_url}
                  onChange={e => setNewProject({ ...newProject, api_url: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                />
                <input
                  type="url"
                  placeholder="App URL (optional)"
                  value={newProject.app_url}
                  onChange={e => setNewProject({ ...newProject, app_url: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewProject(false)}
                    className="flex-1 py-3 rounded-xl border border-zinc-700 text-white hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Settings Modal */}
      <AnimatePresence>
        {editingProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => setEditingProject(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg p-6 rounded-2xl border border-zinc-800 bg-zinc-900 my-8"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-white mb-4">Project Settings</h2>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={projectSettings.name}
                    onChange={e => setProjectSettings({ ...projectSettings, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={projectSettings.description}
                    onChange={e => setProjectSettings({ ...projectSettings, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">API URL</label>
                  <input
                    type="url"
                    value={projectSettings.api_url}
                    onChange={e => setProjectSettings({ ...projectSettings, api_url: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">App URL</label>
                  <input
                    type="url"
                    value={projectSettings.app_url}
                    onChange={e => setProjectSettings({ ...projectSettings, app_url: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">GitHub Repo</label>
                  <input
                    type="text"
                    value={projectSettings.github_repo}
                    onChange={e => setProjectSettings({ ...projectSettings, github_repo: e.target.value })}
                    placeholder="owner/repo"
                    className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Slack Webhook URL</label>
                  <input
                    type="url"
                    value={projectSettings.slack_webhook_url}
                    onChange={e => setProjectSettings({ ...projectSettings, slack_webhook_url: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={projectSettings.slack_notify_on_pass}
                      onChange={e => setProjectSettings({ ...projectSettings, slack_notify_on_pass: e.target.checked })}
                      className="rounded bg-zinc-800 border-zinc-700"
                    />
                    Notify on pass
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={projectSettings.slack_notify_on_fail}
                      onChange={e => setProjectSettings({ ...projectSettings, slack_notify_on_fail: e.target.checked })}
                      className="rounded bg-zinc-800 border-zinc-700"
                    />
                    Notify on fail
                  </label>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Test Schedule</label>
                  <select
                    value={projectSettings.qa_schedule}
                    onChange={e => setProjectSettings({ ...projectSettings, qa_schedule: e.target.value as 'none' | 'hourly' | 'daily' | 'weekly' })}
                    className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="none">None</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                {/* Production Testing Section */}
                <div className="col-span-2 pt-4 mt-4 border-t border-zinc-700">
                  <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Production Testing
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={projectSettings.enable_production_testing}
                          onChange={e => setProjectSettings({ ...projectSettings, enable_production_testing: e.target.checked })}
                          className="rounded bg-zinc-800 border-zinc-700 text-red-500 focus:ring-red-500"
                        />
                        Enable Production Testing
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Production URL</label>
                      <input
                        type="url"
                        placeholder="https://yourapp.com"
                        value={projectSettings.production_url}
                        onChange={e => setProjectSettings({ ...projectSettings, production_url: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-red-500"
                        disabled={!projectSettings.enable_production_testing}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Production API URL</label>
                      <input
                        type="url"
                        placeholder="https://api.yourapp.com"
                        value={projectSettings.production_api_url}
                        onChange={e => setProjectSettings({ ...projectSettings, production_api_url: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-red-500"
                        disabled={!projectSettings.enable_production_testing}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Health Check Endpoint</label>
                      <input
                        type="text"
                        placeholder="/health"
                        value={projectSettings.health_check_endpoint}
                        onChange={e => setProjectSettings({ ...projectSettings, health_check_endpoint: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-red-500"
                        disabled={!projectSettings.enable_production_testing}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Production Test Schedule</label>
                      <select
                        value={projectSettings.production_test_schedule}
                        onChange={e => setProjectSettings({ ...projectSettings, production_test_schedule: e.target.value as 'none' | 'hourly' | 'daily' | 'weekly' })}
                        className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-red-500"
                        disabled={!projectSettings.enable_production_testing}
                      >
                        <option value="none">Manual Only</option>
                        <option value="hourly">Every Hour</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingProject(null)}
                  className="flex-1 py-3 rounded-xl border border-zinc-700 text-white hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateProject(editingProject.id)}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// =============================================================================
// DOCS PAGE - PREMIUM REDESIGN (Vercel/Stripe inspired)
// =============================================================================

// Premium Code Block Component with copy functionality
function CodeBlock({ children, filename }: { children: string; filename?: string }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative rounded-lg overflow-hidden border border-zinc-800 bg-[#0d0d0d]">
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800">
          <span className="text-xs text-zinc-500 font-medium">{filename}</span>
          <button
            onClick={copyToClipboard}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-zinc-500 hover:text-white px-2 py-1 rounded hover:bg-zinc-800"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      <div className="relative">
        {!filename && (
          <button
            onClick={copyToClipboard}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-zinc-500 hover:text-white px-2 py-1 rounded hover:bg-zinc-800"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
        <pre className="p-4 overflow-x-auto text-sm font-mono">
          <code className="text-zinc-300">{children}</code>
        </pre>
      </div>
    </div>
  )
}

// Callout Component
function Callout({ type, children }: { type: 'tip' | 'note' | 'warning'; children: React.ReactNode }) {
  const styles = {
    tip: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', icon: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
    note: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', icon: 'text-blue-400', iconBg: 'bg-blue-500/10' },
    warning: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', icon: 'text-amber-400', iconBg: 'bg-amber-500/10' },
  }
  const s = styles[type]
  const icons = { tip: 'Tip', note: 'Note', warning: 'Warning' }

  return (
    <div className={`flex gap-3 p-4 rounded-lg border ${s.bg} ${s.border}`}>
      <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${s.iconBg} ${s.icon} flex-shrink-0`}>
        {type === 'tip' ? '!' : type === 'note' ? 'i' : '!'}
      </div>
      <div>
        <span className={`text-xs font-semibold ${s.icon} uppercase tracking-wide`}>{icons[type]}</span>
        <p className="text-zinc-300 text-sm mt-1">{children}</p>
      </div>
    </div>
  )
}

function DocsPage() {
  const [activeSection, setActiveSection] = useState('quickstart')
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Simplified sidebar structure without numbered badges
  const sidebarGroups = [
    {
      title: 'Getting Started',
      items: [
        { id: 'quickstart', label: 'Quick Start' },
        { id: 'installation', label: 'Installation' },
        { id: 'configuration', label: 'Configuration' },
      ]
    },
    {
      title: 'Core Concepts',
      items: [
        { id: 'firstproject', label: 'First Project' },
        { id: 'autofix', label: 'Auto-Fix' },
      ]
    },
    {
      title: 'CLI Reference',
      items: [
        { id: 'commands', label: 'CLI Commands' },
        { id: 'scheduling', label: 'Scheduling' },
      ]
    },
    {
      title: 'Integrations',
      items: [
        { id: 'integrations', label: 'GitHub & Slack' },
        { id: 'api', label: 'API Reference' },
      ]
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <Navbar activePage="docs" />

      {/* Fixed Header with Search and Breadcrumbs */}
      <div className="fixed top-[73px] left-0 right-0 z-40 bg-[#0a0a0b]/95 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm">
            <Link to="/docs" className="text-zinc-500 hover:text-white transition-colors">Docs</Link>
            <span className="text-zinc-700">/</span>
            <span className="text-white capitalize">{activeSection.replace(/([A-Z])/g, ' $1').trim()}</span>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 px-4 py-2 pl-10 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600 hidden sm:block">Cmd+K</span>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-zinc-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="pt-36 pb-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex gap-8">
            {/* Clean Sidebar - Vercel style */}
            <nav className={`lg:w-60 flex-shrink-0 ${mobileMenuOpen ? 'fixed inset-0 z-50 bg-[#0a0a0b] pt-36 px-6 lg:relative lg:pt-0 lg:px-0' : 'hidden lg:block'}`}>
              <div className="lg:sticky lg:top-36 space-y-6 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2">
                {mobileMenuOpen && (
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="lg:hidden absolute top-4 right-4 p-2 text-zinc-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {sidebarGroups.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-3">
                      {group.title}
                    </h3>
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveSection(item.id)
                            setMobileMenuOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                            activeSection === item.id
                              ? 'bg-violet-500/10 text-violet-400 border-l-2 border-violet-500 -ml-[2px] pl-[14px]'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </nav>

            {/* Content Area - max-width for readability */}
            <div className="flex-1 min-w-0 max-w-3xl">
              <div className="space-y-10">
                {/* Quick Start - Premium Design */}
                {activeSection === 'quickstart' && (
                  <section className="space-y-8">
                    <div>
                      <h1 className="text-3xl font-bold text-white mb-3">Quick Start</h1>
                      <p className="text-zinc-400 text-lg">Get DevLoop running in your project in under 5 minutes.</p>
                    </div>

                    <Callout type="tip">
                      You can also use <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-violet-400">npx devloop init</code> for interactive setup without installing globally.
                    </Callout>

                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold text-white mb-4">1. Install DevLoop</h2>
                        <CodeBlock filename="Terminal">{`npm install -g devloop`}</CodeBlock>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-white mb-4">2. Initialize in Your Project</h2>
                        <CodeBlock filename="Terminal">{`cd your-project
devloop init`}</CodeBlock>
                        <p className="text-zinc-400 text-sm mt-3">DevLoop will auto-detect your tech stack and create a configuration file.</p>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-white mb-4">3. Run Your First Test</h2>
                        <CodeBlock filename="Terminal">{`devloop run`}</CodeBlock>
                        <div className="mt-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
                          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Expected Output</div>
                          <div className="font-mono text-sm space-y-1">
                            <div className="text-zinc-400">Scanning codebase...</div>
                            <div className="text-emerald-400 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Found 24 endpoints
                            </div>
                            <div className="text-emerald-400 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Generated 47 tests
                            </div>
                            <div className="text-emerald-400 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              All tests passed
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Callout type="warning">
                      Requires Node.js 18+ and npm, yarn, or pnpm.
                    </Callout>

                    {/* Footer Navigation */}
                    <div className="flex items-center justify-between pt-8 border-t border-zinc-800">
                      <div></div>
                      <button
                        onClick={() => setActiveSection('installation')}
                        className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
                      >
                        Installation
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </section>
                )}

                {/* Installation */}
                {activeSection === 'installation' && (
                  <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Installation</h2>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">Prerequisites</h3>
                      <ul className="space-y-2 text-zinc-300">
                        <li className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Node.js 18.0 or higher
                        </li>
                        <li className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          npm, yarn, or pnpm
                        </li>
                        <li className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          A DevLoop account (sign up at devloop.dev)
                        </li>
                      </ul>
                    </div>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">Install via npm</h3>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm">
                        <div className="text-cyan-400">npm install -g devloop</div>
                      </div>
                    </div>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">Or use npx (no install)</h3>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm">
                        <div className="text-cyan-400">npx devloop init</div>
                      </div>
                    </div>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">Authenticate</h3>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm">
                        <div className="text-zinc-500"># Login with your DevLoop account</div>
                        <div className="text-cyan-400">devloop login</div>
                        <div className="mt-4 text-zinc-500"># Or use a license key</div>
                        <div className="text-cyan-400">devloop auth --key YOUR_LICENSE_KEY</div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Configuration */}
                {activeSection === 'configuration' && (
                  <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Configuration</h2>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">devloop.config.js</h3>
                      <p className="text-zinc-400 mb-4">Create this file in your project root to customize DevLoop:</p>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                        <pre>{`module.exports = {
  // Your API endpoint (for API testing)
  apiUrl: 'https://api.yourapp.com',

  // Your app URL (for UI testing)
  appUrl: 'https://yourapp.com',

  // Tech stack (auto-detected if not specified)
  stack: 'nextjs', // react, vue, angular, express, etc.

  // Test scheduling
  schedule: 'daily', // none, hourly, daily, weekly

  // Slack notifications
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    notifyOnPass: false,
    notifyOnFail: true,
    channel: '#devloop-alerts'
  },

  // GitHub integration
  github: {
    repo: 'owner/repo',
    createPRs: true,      // Auto-create PRs for fixes
    autoMerge: false      // Auto-merge passing PRs
  },

  // Auto-fix settings
  autoFix: {
    enabled: true,
    maxFixesPerRun: 5,
    requireApproval: true // Require manual approval
  },

  // Ignore patterns
  ignore: [
    'node_modules/**',
    'dist/**',
    '**/*.test.ts'
  ]
}`}</pre>
                      </div>
                    </div>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">Environment Variables</h3>
                      <div className="space-y-3">
                        {[
                          { name: 'DEVLOOP_LICENSE_KEY', desc: 'Your DevLoop license key' },
                          { name: 'DEVLOOP_API_URL', desc: 'Override the API URL' },
                          { name: 'SLACK_WEBHOOK_URL', desc: 'Slack webhook for notifications' },
                          { name: 'GITHUB_TOKEN', desc: 'GitHub token for PR creation' },
                        ].map((env) => (
                          <div key={env.name} className="flex items-start gap-4">
                            <code className="px-3 py-1 bg-zinc-800 rounded font-mono text-sm text-violet-400 flex-shrink-0">{env.name}</code>
                            <span className="text-zinc-400 text-sm">{env.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* First Project Walkthrough */}
                {activeSection === 'firstproject' && (
                  <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Your First Project: A Complete Walkthrough</h2>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">Scenario: SaaS Application</h3>
                      <p className="text-zinc-400 mb-4">Let's say you have a Next.js SaaS app with an API. Here's how to set up DevLoop:</p>

                      <div className="space-y-6">
                        <div>
                          <h4 className="text-white font-medium mb-2">Step 1: Initialize DevLoop</h4>
                          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm">
                            <div className="text-cyan-400">cd my-saas-app</div>
                            <div className="text-cyan-400">devloop init</div>
                            <div className="mt-2 text-zinc-500"># DevLoop will auto-detect your stack</div>
                            <div className="text-emerald-400 mt-2">Detected: Next.js 14, TypeScript, Prisma</div>
                            <div className="text-emerald-400">Created devloop.config.js</div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-white font-medium mb-2">Step 2: Configure Your Endpoints</h4>
                          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-zinc-300">
                            <pre>{`// devloop.config.js
module.exports = {
  apiUrl: 'http://localhost:3000/api',
  appUrl: 'http://localhost:3000',
  stack: 'nextjs'
}`}</pre>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-white font-medium mb-2">Step 3: Run Your First Test</h4>
                          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm">
                            <div className="text-cyan-400">devloop run</div>
                            <div className="mt-2 text-zinc-500"># Output:</div>
                            <div className="text-zinc-400 mt-2">Scanning codebase...</div>
                            <div className="text-zinc-400">Found 24 API endpoints</div>
                            <div className="text-zinc-400">Found 12 page routes</div>
                            <div className="text-zinc-400">Running security checks...</div>
                            <div className="text-amber-400 mt-2">Issues found: 2</div>
                            <div className="text-red-400 pl-4">auth.ts:42 - Missing input validation</div>
                            <div className="text-red-400 pl-4">users.ts:89 - SQL injection risk</div>
                            <div className="text-emerald-400 mt-2">Auto-fixing issues...</div>
                            <div className="text-emerald-400">All issues resolved!</div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-white font-medium mb-2">Step 4: Review Changes</h4>
                          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm">
                            <div className="text-cyan-400">git diff</div>
                            <div className="mt-2 text-zinc-500"># Review the auto-generated fixes</div>
                            <div className="text-cyan-400 mt-2">devloop approve</div>
                            <div className="text-zinc-500"># Or reject: devloop reject</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* CLI Commands */}
                {activeSection === 'commands' && (
                  <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-4">CLI Commands</h2>

                    <div className="space-y-4">
                      {[
                        { cmd: 'devloop init', desc: 'Initialize DevLoop in your project', flags: ['--force', '--template <name>'] },
                        { cmd: 'devloop run', desc: 'Run full test suite (scan, test, fix)', flags: ['--fix', '--no-fix', '--dry-run'] },
                        { cmd: 'devloop scan', desc: 'Scan codebase for issues (no fixes)', flags: ['--security', '--performance'] },
                        { cmd: 'devloop test', desc: 'Run generated tests only', flags: ['--coverage', '--watch'] },
                        { cmd: 'devloop fix', desc: 'Apply auto-fixes for found issues', flags: ['--all', '--interactive'] },
                        { cmd: 'devloop deploy', desc: 'Deploy and verify production', flags: ['--verify', '--rollback'] },
                        { cmd: 'devloop status', desc: 'Show project status and history', flags: ['--json', '--verbose'] },
                        { cmd: 'devloop login', desc: 'Authenticate with DevLoop', flags: ['--token'] },
                        { cmd: 'devloop config', desc: 'View or edit configuration', flags: ['--edit', '--reset'] },
                      ].map((item) => (
                        <div key={item.cmd} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
                          <div className="flex items-start justify-between">
                            <code className="px-3 py-1 bg-zinc-800 rounded font-mono text-cyan-400">{item.cmd}</code>
                          </div>
                          <p className="text-zinc-400 text-sm mt-2">{item.desc}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.flags.map((flag) => (
                              <span key={flag} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-500 font-mono">{flag}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Integrations */}
                {activeSection === 'integrations' && (
                  <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Integrations</h2>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                          GitHub
                        </h3>
                        <p className="text-zinc-400 text-sm mb-4">Auto-create PRs for fixes, integrate with GitHub Actions.</p>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-300">
                          <pre>{`github:
  repo: owner/repo
  createPRs: true`}</pre>
                        </div>
                      </div>

                      <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>
                          Slack
                        </h3>
                        <p className="text-zinc-400 text-sm mb-4">Get instant notifications when issues are found or fixed.</p>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-300">
                          <pre>{`slack:
  webhookUrl: $SLACK_URL
  notifyOnFail: true`}</pre>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Auto-Fix */}
                {activeSection === 'autofix' && (
                  <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Auto-Fix System</h2>

                    <div className="p-6 rounded-xl border border-amber-500/20 bg-amber-500/5">
                      <h3 className="text-lg font-semibold text-white mb-4">How Auto-Fix Works</h3>
                      <ol className="space-y-3 text-zinc-300">
                        <li className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm flex-shrink-0">1</span>
                          <span>DevLoop scans your codebase and identifies issues (bugs, security vulnerabilities, etc.)</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm flex-shrink-0">2</span>
                          <span>AI analyzes the context and generates a fix</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm flex-shrink-0">3</span>
                          <span>The fix is applied locally and tests are run to verify</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm flex-shrink-0">4</span>
                          <span>You review and approve/reject the changes</span>
                        </li>
                      </ol>
                    </div>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">Types of Issues DevLoop Can Fix</h3>
                      <div className="grid md:grid-cols-2 gap-3">
                        {[
                          'Null/undefined checks',
                          'Type errors',
                          'SQL injection vulnerabilities',
                          'XSS vulnerabilities',
                          'Unhandled promise rejections',
                          'Memory leaks',
                          'Race conditions',
                          'Input validation',
                        ].map((item) => (
                          <div key={item} className="flex items-center gap-2 text-zinc-300 text-sm">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* Scheduling */}
                {activeSection === 'scheduling' && (
                  <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Scheduled Test Runs</h2>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">Available Schedules</h3>
                      <div className="space-y-3">
                        {[
                          { schedule: 'none', desc: 'Manual runs only' },
                          { schedule: 'hourly', desc: 'Every hour (Pro & Team plans)' },
                          { schedule: 'daily', desc: 'Once per day at midnight UTC' },
                          { schedule: 'weekly', desc: 'Every Monday at midnight UTC' },
                        ].map((item) => (
                          <div key={item.schedule} className="flex items-center gap-4">
                            <code className="px-3 py-1 bg-zinc-800 rounded font-mono text-sm text-violet-400 w-24">{item.schedule}</code>
                            <span className="text-zinc-400 text-sm">{item.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">GitHub Actions Integration</h3>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                        <pre>{`# .github/workflows/devloop.yml
name: DevLoop Tests
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devloop/action@v1
        with:
          license-key: \${{ secrets.DEVLOOP_KEY }}
          auto-fix: true`}</pre>
                      </div>
                    </div>
                  </section>
                )}

                {/* API Reference */}
                {activeSection === 'api' && (
                  <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-4">API Reference</h2>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">REST API Endpoints</h3>
                      <div className="space-y-4">
                        {[
                          { method: 'POST', path: '/api/v1/test/run', desc: 'Trigger a test run' },
                          { method: 'GET', path: '/api/v1/test/runs', desc: 'List all test runs' },
                          { method: 'GET', path: '/api/v1/test/runs/:id', desc: 'Get run details' },
                          { method: 'GET', path: '/api/v1/projects', desc: 'List projects' },
                          { method: 'POST', path: '/api/v1/projects', desc: 'Create a project' },
                        ].map((item) => (
                          <div key={item.path} className="flex items-start gap-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                              item.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>{item.method}</span>
                            <code className="text-zinc-300 font-mono text-sm flex-1">{item.path}</code>
                            <span className="text-zinc-500 text-sm">{item.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                      <h3 className="text-lg font-semibold text-white mb-4">Authentication</h3>
                      <p className="text-zinc-400 text-sm mb-4">All API requests require a Bearer token in the Authorization header:</p>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-zinc-300">
                        <pre>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.devloop.dev/api/v1/projects`}</pre>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// PRIVACY PAGE
// =============================================================================
function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <Navbar activePage="home" />
      <div className="pt-24 px-6 pb-12">
        <div className="mx-auto max-w-3xl prose prose-invert">
          <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
          <div className="space-y-6 text-zinc-300">
            <p>Last updated: {new Date().toLocaleDateString()}</p>

            <h2 className="text-xl font-semibold text-white mt-8">Information We Collect</h2>
            <p>We collect information you provide directly to us, such as when you create an account, subscribe to our service, or contact us for support.</p>

            <h2 className="text-xl font-semibold text-white mt-8">How We Use Your Information</h2>
            <p>We use the information we collect to provide, maintain, and improve our services, process transactions, and send you technical notices and support messages.</p>

            <h2 className="text-xl font-semibold text-white mt-8">Code Security</h2>
            <p>DevLoop never stores your source code. Our CLI tools run locally in your environment, and only test results and metadata are transmitted to our servers.</p>

            <h2 className="text-xl font-semibold text-white mt-8">Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us at <a href="mailto:privacy@devloop.dev" className="text-violet-400 hover:text-violet-300">privacy@devloop.dev</a>.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// TERMS PAGE
// =============================================================================
function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <Navbar activePage="home" />
      <div className="pt-24 px-6 pb-12">
        <div className="mx-auto max-w-3xl prose prose-invert">
          <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>
          <div className="space-y-6 text-zinc-300">
            <p>Last updated: {new Date().toLocaleDateString()}</p>

            <h2 className="text-xl font-semibold text-white mt-8">Acceptance of Terms</h2>
            <p>By accessing or using DevLoop, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>

            <h2 className="text-xl font-semibold text-white mt-8">Use License</h2>
            <p>DevLoop grants you a limited, non-exclusive, non-transferable license to use our software in accordance with your subscription plan.</p>

            <h2 className="text-xl font-semibold text-white mt-8">Payment Terms</h2>
            <p>Subscriptions are billed monthly or annually. You may cancel at any time, and your access will continue until the end of your billing period.</p>

            <h2 className="text-xl font-semibold text-white mt-8">Limitation of Liability</h2>
            <p>DevLoop shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.</p>

            <h2 className="text-xl font-semibold text-white mt-8">Contact</h2>
            <p>For questions about these Terms, contact us at <a href="mailto:legal@devloop.dev" className="text-violet-400 hover:text-violet-300">legal@devloop.dev</a>.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// FAIR USE POLICY PAGE
// =============================================================================
function FairUsePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <Navbar activePage="home" />
      <div className="pt-24 px-6 pb-12">
        <div className="mx-auto max-w-3xl prose prose-invert">
          <h1 className="text-3xl font-bold text-white mb-8">Fair Use Policy</h1>
          <div className="space-y-6 text-zinc-300">
            <p>Last updated: {new Date().toLocaleDateString()}</p>

            <h2 className="text-xl font-semibold text-white mt-8">Overview</h2>
            <p>
              DevLoop is designed to help developers ship with confidence through automated testing.
              This Fair Use Policy outlines how our usage limits work to ensure a great experience for all users.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8">Daily Run Limits</h2>
            <p>Each plan includes a daily limit on test runs:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong className="text-white">Free:</strong> 5 runs per day (hard limit)</li>
              <li><strong className="text-white">Pro ($39/mo):</strong> 30 runs per day (soft throttle)</li>
              <li><strong className="text-white">Team ($79/mo):</strong> 50 runs per day (soft throttle)</li>
            </ul>
            <p className="text-sm text-zinc-400 mt-2">Limits reset daily at midnight UTC.</p>

            <h2 className="text-xl font-semibold text-white mt-8">Hard Limits vs Soft Throttling</h2>

            <h3 className="text-lg font-medium text-white mt-6">Hard Limits (Free Plan)</h3>
            <p>
              On the Free plan, once you reach your daily limit of 5 runs, additional runs are blocked
              until the next day. This ensures free users can explore DevLoop while maintaining
              system resources for paying customers.
            </p>

            <h3 className="text-lg font-medium text-white mt-6">Soft Throttling (Pro & Team Plans)</h3>
            <p>
              Paid plans use soft throttling instead of hard blocks. When you exceed your daily limit,
              you can still run tests, but with progressive delays:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>First 3 runs over limit: No delay</li>
              <li>4th run over limit: 30 second delay</li>
              <li>5th run over limit: 60 second delay</li>
              <li>6th run over limit: 2 minute delay</li>
              <li>7th run over limit: 5 minute delay</li>
              <li>8+ runs over limit: 10 minute delay</li>
            </ul>
            <p className="mt-4">
              This approach ensures you're never blocked from testing when you need it most,
              while encouraging reasonable usage patterns.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8">Why We Have Limits</h2>
            <p>
              DevLoop uses AI-powered analysis for every test run, which has real infrastructure costs.
              Our limits are designed to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Keep pricing affordable for individual developers and small teams</li>
              <li>Ensure consistent performance for all users</li>
              <li>Prevent abuse while allowing flexibility for legitimate high-usage scenarios</li>
            </ul>

            <h2 className="text-xl font-semibold text-white mt-8">Need More?</h2>
            <p>
              If you consistently need more runs than your plan allows, consider upgrading:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Free to Pro: 6x more daily runs plus advanced features</li>
              <li>Pro to Team: Nearly 2x more daily runs plus team features</li>
            </ul>
            <p className="mt-4">
              For enterprise needs with higher limits, contact us at{' '}
              <a href="mailto:sales@devloop.dev" className="text-violet-400 hover:text-violet-300">
                sales@devloop.dev
              </a>
              .
            </p>

            <h2 className="text-xl font-semibold text-white mt-8">Questions?</h2>
            <p>
              If you have questions about this policy or your usage limits, contact us at{' '}
              <a href="mailto:support@devloop.dev" className="text-violet-400 hover:text-violet-300">
                support@devloop.dev
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// FEATURES PAGE
// =============================================================================
function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <Navbar activePage="home" />
      <div className="pt-24 px-6 pb-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-white mb-4">Features</h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Everything you need to ship with confidence. DevLoop automates your entire testing workflow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'Autonomous API Testing',
                description: 'DevLoop automatically discovers and tests your API endpoints. No test cases to write - it scans your codebase and generates comprehensive tests.',
                features: ['Endpoint discovery', 'Schema validation', 'Response time tracking', 'Auth flow testing']
              },
              {
                title: 'AI-Powered Visual Testing',
                description: 'Screenshots every page across desktop, tablet, and mobile viewports. AI detects layout issues, broken elements, and visual regressions.',
                features: ['Multi-viewport capture', 'AI anomaly detection', 'Layout verification', 'Accessibility checks']
              },
              {
                title: 'Production Monitoring',
                description: 'Continuous health checks and smoke tests on your production environment. Know when something breaks before your users do.',
                features: ['Health checks', 'Uptime monitoring', 'Response time tracking', 'Alert fatigue prevention']
              },
              {
                title: 'GitHub Integration',
                description: 'Run DevLoop on every PR automatically. Block merges until tests pass. Clear status checks right in your PR.',
                features: ['PR status checks', 'Auto-run on push', 'Detailed reports', 'Merge blocking']
              },
              {
                title: 'Slack Alerts',
                description: 'Get instant notifications when something breaks. Configure alerts for failures only, or get summaries of all runs.',
                features: ['Instant notifications', 'Configurable alerts', 'Rich formatting', 'Channel routing']
              },
              {
                title: 'Scheduled Testing',
                description: 'Run tests on your schedule - hourly, daily, or weekly. Catch issues before your users encounter them.',
                features: ['Flexible scheduling', 'Smart timing', 'Overlap prevention', 'Timezone support']
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30"
              >
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-zinc-400 text-sm mb-4">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN APP
// =============================================================================
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/fair-use" element={<FairUsePage />} />
        <Route path="/auth/verify" element={<AuthVerify />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

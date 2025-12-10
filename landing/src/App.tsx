import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams, Link } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'https://devloop-api.fly.dev'

// Shared Navbar Component
type NavPage = 'home' | 'docs' | 'dashboard'

interface NavbarProps {
  activePage: NavPage
  user?: { email: string } | null
  onLogout?: () => void
  showFeaturesPricing?: boolean
}

function Navbar({ activePage, user, onLogout, showFeaturesPricing = false }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinkClass = (page: NavPage) => {
    const isActive = activePage === page
    return `text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-zinc-400 hover:text-white'}`
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-[#0a0a0f]/90 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-xl font-bold text-white">DevLoop</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link to="/" className={navLinkClass('home')}>Home</Link>
          {showFeaturesPricing && (
            <>
              <a href="#features" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">Features</a>
              <a href="#pricing" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">Pricing</a>
            </>
          )}
          {!showFeaturesPricing && (
            <Link to="/#pricing" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">Pricing</Link>
          )}
          <Link to="/docs" className={navLinkClass('docs')}>Docs</Link>
          {user ? (
            <>
              <span className="text-zinc-500 text-sm truncate max-w-[150px]">{user.email}</span>
              <button onClick={onLogout} className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">Logout</button>
            </>
          ) : (
            <Link to="/dashboard" className={`px-4 py-2 rounded-lg ${activePage === 'dashboard' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'} text-sm font-medium transition-colors`}>Dashboard</Link>
          )}
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
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800/50 bg-[#0a0a0f]/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-3">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className={`block px-4 py-2 rounded-lg transition-colors ${activePage === 'home' ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'}`}>Home</Link>
            {showFeaturesPricing && (
              <>
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors">Features</a>
                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors">Pricing</a>
              </>
            )}
            {!showFeaturesPricing && (
              <Link to="/#pricing" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors">Pricing</Link>
            )}
            <Link to="/docs" onClick={() => setMobileMenuOpen(false)} className={`block px-4 py-2 rounded-lg transition-colors ${activePage === 'docs' ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'}`}>Docs</Link>
            {user ? (
              <>
                <span className="block px-4 py-2 text-zinc-500 text-sm">{user.email}</span>
                <button onClick={() => { onLogout?.(); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors">Logout</button>
              </>
            ) : (
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className={`block px-4 py-2 rounded-lg transition-colors ${activePage === 'dashboard' ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'}`}>Dashboard</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

// Hook for scroll-triggered animations
const useScrollAnimation = (threshold = 0.1) => {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold, rootMargin: '0px 0px -50px 0px' }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [threshold])

  return { ref, isVisible }
}

// Animated Terminal Component
const AnimatedTerminal = () => {
  const [lines, setLines] = useState<{text: string, type: string, visible: boolean}[]>([])
  const [currentLine, setCurrentLine] = useState(0)
  const [currentChar, setCurrentChar] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const { ref, isVisible } = useScrollAnimation(0.3)

  const terminalContent = [
    { text: '$ npx create-devloop', type: 'command', delay: 50 },
    { text: 'Setting up DevLoop in: ~/my-saas', type: 'output', delay: 30 },
    { text: 'Enter your license key: DL-XXXX-XXXX-XXXX', type: 'prompt', delay: 30 },
    { text: '✓ License verified!', type: 'success', delay: 30 },
    { text: '✓ Created .devloop/ and scripts/', type: 'success', delay: 30 },
    { text: '', type: 'empty', delay: 0 },
    { text: '$ devloop production-test --full', type: 'command', delay: 50 },
    { text: '', type: 'empty', delay: 0 },
    { text: '─── Health Check ───', type: 'divider', delay: 20 },
    { text: '✓ /health               200 OK     [45ms]  healthy', type: 'api-success', delay: 25 },
    { text: '', type: 'empty', delay: 0 },
    { text: '─── API Smoke Tests ───', type: 'divider', delay: 20 },
    { text: '✓ GET  /health          200 OK     [12ms]', type: 'api-success', delay: 25 },
    { text: '✓ GET  /                200 OK     [8ms]', type: 'api-success', delay: 25 },
    { text: '✓ POST /api/auth/login  200 OK     [156ms]', type: 'api-success', delay: 25 },
    { text: '✓ GET  /api/users       200 OK     [45ms]', type: 'api-success', delay: 25 },
    { text: '✓ POST /api/checkout    200 OK     [234ms]', type: 'api-success', delay: 25 },
    { text: 'API: 5/5 endpoints passed', type: 'summary', delay: 30 },
    { text: '', type: 'empty', delay: 0 },
    { text: '─── UI Tests (Production) ───', type: 'divider', delay: 20 },
    { text: '✓ page_loads            passed     [1,245ms]', type: 'ui-success', delay: 25 },
    { text: '✓ returns_html          passed     [0ms]', type: 'ui-success', delay: 25 },
    { text: '✓ response_time_ok      passed     [1,245ms]', type: 'ui-success', delay: 25 },
    { text: 'UI: 3/3 tests passed', type: 'summary', delay: 30 },
    { text: '', type: 'empty', delay: 0 },
    { text: '─── AI Vision Analysis ───', type: 'divider', delay: 20 },
    { text: '✓ No broken layouts detected', type: 'ai-success', delay: 25 },
    { text: '✓ All buttons clickable', type: 'ai-success', delay: 25 },
    { text: '✓ Mobile responsive verified', type: 'ai-success', delay: 25 },
    { text: '', type: 'empty', delay: 0 },
    { text: '══════════════════════════════════', type: 'divider-bold', delay: 20 },
    { text: '✓ PRODUCTION TESTS PASSED', type: 'success-bold', delay: 30 },
    { text: '  Health: healthy | API: 5/5 | UI: 3/3', type: 'summary-small', delay: 30 },
    { text: '══════════════════════════════════', type: 'divider-bold', delay: 20 },
  ]

  const typeNextChar = useCallback(() => {
    if (currentLine >= terminalContent.length) return

    const line = terminalContent[currentLine]

    if (line.type === 'empty') {
      setLines(prev => [...prev, { text: '', type: 'empty', visible: true }])
      setCurrentLine(prev => prev + 1)
      setCurrentChar(0)
      return
    }

    if (currentChar < line.text.length) {
      setLines(prev => {
        const newLines = [...prev]
        if (newLines.length === currentLine) {
          newLines.push({ text: line.text.slice(0, currentChar + 1), type: line.type, visible: true })
        } else {
          newLines[currentLine] = { text: line.text.slice(0, currentChar + 1), type: line.type, visible: true }
        }
        return newLines
      })
      setCurrentChar(prev => prev + 1)
    } else {
      setCurrentLine(prev => prev + 1)
      setCurrentChar(0)
    }
  }, [currentLine, currentChar, terminalContent])

  useEffect(() => {
    if (!isVisible || currentLine >= terminalContent.length) return

    const line = terminalContent[currentLine]
    const delay = line.type === 'command' ? line.delay : (currentChar === 0 ? 200 : line.delay)

    const timer = setTimeout(typeNextChar, delay)
    return () => clearTimeout(timer)
  }, [isVisible, currentLine, currentChar, typeNextChar, terminalContent])

  useEffect(() => {
    if (isVisible && !isTyping) {
      setIsTyping(true)
    }
  }, [isVisible, isTyping])

  const getLineClass = (type: string) => {
    switch (type) {
      case 'command': return 'text-zinc-200'
      case 'output': return 'text-zinc-500'
      case 'prompt': return 'text-blue-400'
      case 'success': return 'text-green-400'
      case 'success-bold': return 'text-green-400 font-bold text-base'
      case 'info': return 'text-blue-400'
      case 'divider': return 'text-zinc-600'
      case 'divider-bold': return 'text-zinc-500 font-bold'
      case 'feature': return 'text-indigo-400'
      case 'api-success': return 'text-green-400 font-mono'
      case 'ui-success': return 'text-cyan-400 font-mono'
      case 'ai-success': return 'text-purple-400'
      case 'summary': return 'text-zinc-300 font-semibold mt-1'
      case 'summary-small': return 'text-zinc-500 text-xs'
      default: return 'text-zinc-400'
    }
  }

  return (
    <div ref={ref} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors"></div>
        <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors"></div>
        <span className="ml-4 text-sm text-zinc-500 font-mono">devloop ~ terminal</span>
      </div>
      <div className="p-4 sm:p-6 font-mono text-xs sm:text-sm min-h-[450px] sm:min-h-[520px] max-h-[600px] overflow-y-auto">
        <div className="space-y-1">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`${getLineClass(line.type)} ${line.type === 'command' ? 'flex items-center gap-2' : 'pl-4'}`}
            >
              {line.type === 'command' && <span className="text-green-400">$</span>}
              {line.text}
            </div>
          ))}
          {currentLine < terminalContent.length && (
            <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1"></span>
          )}
        </div>
      </div>
    </div>
  )
}

// Scroll Reveal Component
const ScrollReveal = ({
  children,
  className = '',
  delay = 0,
  direction = 'up'
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
}) => {
  const { ref, isVisible } = useScrollAnimation(0.1)

  const getTransform = () => {
    switch (direction) {
      case 'up': return 'translateY(40px)'
      case 'down': return 'translateY(-40px)'
      case 'left': return 'translateX(40px)'
      case 'right': return 'translateX(-40px)'
      default: return 'translateY(40px)'
    }
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translate(0)' : getTransform(),
        transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// Types
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
  // Production Testing
  production_url: string | null
  production_api_url: string | null
  enable_production_testing: boolean
  production_test_schedule: 'none' | 'hourly' | 'daily' | 'weekly'
  health_check_endpoint: string | null
  health_check_status: string | null
  last_health_check_at: string | null
}

// Auth Context
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

// Landing Page
function LandingPage() {
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

  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-x-hidden">
      <Navbar activePage="home" showFeaturesPricing={true} />

      {/* Hero Section */}
      <section className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6">
        {/* Background gradient effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-float delay-200"></div>
          <div className="absolute top-40 left-1/2 w-72 h-72 bg-pink-500/15 rounded-full blur-3xl animate-float delay-400"></div>
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 mb-6 sm:mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-sm text-indigo-300 font-medium">New: Scheduled QA + GitHub Actions + Slack Alerts</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-fade-in delay-100">
            <span className="text-white">Ship faster.</span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
              Break nothing.
            </span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed px-4 animate-fade-in delay-200">
            AI-powered QA that runs on schedule, integrates with GitHub, and alerts you on Slack.
            <span className="text-white font-medium"> Built for indie hackers who ship fast.</span>
          </p>

          <div className="max-w-lg mx-auto px-4 animate-fade-in delay-300">
            <a
              href="#pricing"
              className="inline-block px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold text-lg hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              View Plans & Pricing
            </a>
            <p className="text-zinc-500 text-sm mt-4">
              Starting at $19/month. Cancel anytime.
            </p>
          </div>

          {/* Quick install code */}
          <div className="mt-8 sm:mt-12 flex justify-center px-4 animate-fade-in delay-400">
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800 font-mono text-sm">
              <span className="text-zinc-500">$</span>
              <span className="text-zinc-200">npx create-devloop</span>
              <button
                onClick={() => navigator.clipboard.writeText('npx create-devloop')}
                className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-white"
                title="Copy to clipboard"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 border-y border-zinc-800/50">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <ScrollReveal delay={0}>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">30s</div>
                <div className="text-sm text-zinc-500">Setup Time</div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">100%</div>
                <div className="text-sm text-zinc-500">API Coverage</div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">3x</div>
                <div className="text-sm text-zinc-500">Faster Debugging</div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={300}>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">24/7</div>
                <div className="text-sm text-zinc-500">Autonomous Testing</div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Terminal Demo - Animated */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <ScrollReveal className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">See it in action</h2>
            <p className="text-zinc-400">Watch DevLoop set up and run tests automatically.</p>
          </ScrollReveal>
          <AnimatedTerminal />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <ScrollReveal className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 mb-4">
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Features</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              QA that runs while you sleep
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Set it up once, ship with confidence forever. DevLoop catches bugs before your users do.
            </p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <ScrollReveal delay={0}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Auto-Discovery</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Automatically discovers your API endpoints and UI routes. No manual test writing required.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">API Testing</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Tests every endpoint with authentication, validates responses, checks error handling.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-pink-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">UI Screenshots</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Captures screenshots at multiple viewports. Catch visual regressions automatically.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-cyan-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">AI Vision</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  AI analyzes screenshots to verify UI looks correct. Catches broken layouts and missing elements.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={400}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-orange-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Auto-Fix Loop</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  When tests fail, DevLoop AI analyzes the failure and attempts to fix it automatically.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={500}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-green-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Verify & Report</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  After fixes, re-runs tests to verify. Generates detailed reports with screenshots.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={600}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Scheduled QA</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Run tests hourly, daily, or weekly. Catch regressions before they reach production.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={700}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-gray-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-500/20 to-gray-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">GitHub Actions</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  One-click GitHub workflow setup. Run QA on every push and PR automatically.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={800}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-yellow-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Slack Alerts</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Get instant notifications when tests fail. Know about issues before your users do.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={900}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-red-500/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Production Testing</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Continuous smoke tests, health monitoring, and UI validation on your live production environment.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-zinc-800/50">
        <div className="mx-auto max-w-6xl">
          <ScrollReveal>
            <div className="text-center mb-12 sm:mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 mb-4">
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Pricing</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                Choose the plan that fits your needs. All plans include full access to all features.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {/* Solo Plan */}
            <ScrollReveal delay={0}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-all duration-300 h-full">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium mb-3">
                  Starter
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">Solo</h3>
                <p className="text-zinc-400 text-sm">Perfect for indie hackers</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl sm:text-5xl font-bold text-white">$19</span>
                <span className="text-zinc-400">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  1 project
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  Full QA suite + AI Vision
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  Scheduled QA (hourly/daily)
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  GitHub Actions + Slack
                </li>
              </ul>
              <button
                onClick={() => handleCheckout('solo')}
                className="w-full py-3.5 px-4 rounded-xl bg-zinc-800 text-white font-semibold hover:bg-zinc-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started - $19/mo
              </button>
              </div>
            </ScrollReveal>

            {/* Pro Plan */}
            <ScrollReveal delay={100}>
              <div className="group relative p-6 sm:p-8 rounded-2xl border-2 border-indigo-500 bg-gradient-to-b from-indigo-500/10 to-transparent shadow-xl shadow-indigo-500/10 h-full">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold shadow-lg">
                Most Popular
              </div>
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium mb-3">
                  Best Value
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">Pro</h3>
                <p className="text-zinc-400 text-sm">For growing projects</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl sm:text-5xl font-bold text-white">$39</span>
                <span className="text-zinc-400">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">5 projects</span>
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  Everything in Solo
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">Visual diff testing</span>
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">Auto-generate tests</span>
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">Production testing</span>
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">Priority support</span>
                </li>
              </ul>
              <button
                onClick={() => handleCheckout('pro')}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started - $39/mo
              </button>
              </div>
            </ScrollReveal>

            {/* Team Plan */}
            <ScrollReveal delay={200}>
              <div className="group p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-all duration-300 sm:col-span-2 lg:col-span-1 h-full">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium mb-3">
                  Enterprise
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">Team</h3>
                <p className="text-zinc-400 text-sm">For teams and agencies</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl sm:text-5xl font-bold text-white">$79</span>
                <span className="text-zinc-400">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">Unlimited projects</span>
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  Everything in Pro
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">Team license sharing</span>
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">Custom integrations</span>
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  Dedicated support
                </li>
              </ul>
              <button
                onClick={() => handleCheckout('team')}
                className="w-full py-3.5 px-4 rounded-xl bg-zinc-800 text-white font-semibold hover:bg-zinc-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started - $79/mo
              </button>
              </div>
            </ScrollReveal>
          </div>

          {/* Money back guarantee */}
          <ScrollReveal delay={300}>
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-2 text-zinc-400 text-sm">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Cancel anytime. 7-day money-back guarantee.</span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-zinc-800/50">
        <div className="mx-auto max-w-3xl">
          <ScrollReveal>
            <div className="text-center mb-12 sm:mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 mb-4">
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">FAQ</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                Frequently asked questions
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-4 sm:space-y-6">
            <ScrollReveal delay={0}>
              <div className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">How does the license key work?</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  After subscribing, you'll receive a license key (DL-XXXX-XXXX-XXXX) in your dashboard.
                  The CLI verifies this key on each run (cached for 24 hours) to ensure your subscription is active.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">What happens if I cancel?</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  You'll have a 7-day grace period after cancellation. After that, your license key will be revoked
                  and the CLI will stop working until you resubscribe.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">How does the AI auto-fix work?</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  DevLoop uses advanced AI to analyze test failures and automatically generate fixes.
                  No additional API keys needed - everything is included with your subscription.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <div className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">What tech stacks are supported?</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  DevLoop works with any web application - React, Vue, Next.js, Express, FastAPI, Django, Rails, and more.
                  It tests HTTP endpoints and captures browser screenshots, so it's stack-agnostic.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={400}>
              <div className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Can I use it in CI/CD?</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Yes! Run the QA scripts in your CI pipeline. Set your license key as an environment variable
                  (DEVLOOP_LICENSE_KEY) and it will work in GitHub Actions, CircleCI, etc.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-zinc-800/50 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
        </div>

        <ScrollReveal>
          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              Stop shipping bugs.
            </h2>
            <p className="text-lg sm:text-xl text-zinc-400 mb-8">
              Start your free trial today and ship with confidence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#pricing"
                className="w-full sm:w-auto inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                View Pricing
              </a>
              <Link
                to="/docs"
                className="w-full sm:w-auto inline-block px-8 py-4 rounded-xl bg-zinc-800 text-white font-semibold hover:bg-zinc-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <footer className="py-10 sm:py-12 px-4 sm:px-6 border-t border-zinc-800/50">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-white font-bold text-xs">D</span>
              </div>
              <span className="text-base font-semibold text-white">DevLoop</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-400">
              <Link to="/docs" className="hover:text-white transition-colors">Docs</Link>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-zinc-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
            <span>Built for indie hackers who ship fast</span>
            <span>&copy; {new Date().getFullYear()} DevLoop. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Auth Verify Page - handles magic link verification
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
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        {status === 'loading' && (
          <div className="text-zinc-400">Verifying your magic link...</div>
        )}
        {status === 'success' && (
          <div className="text-green-400">Login successful! Redirecting to dashboard...</div>
        )}
        {status === 'error' && (
          <div>
            <div className="text-red-400 mb-4">{errorMsg}</div>
            <Link to="/dashboard" className="text-indigo-400 hover:text-indigo-300 underline">Try again</Link>
          </div>
        )}
      </div>
    </div>
  )
}

// Auth Callback Page (legacy, redirects to verify)
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
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        {status === 'loading' && (
          <div className="text-zinc-400">Verifying...</div>
        )}
        {status === 'success' && (
          <div className="text-green-400">Login successful! Redirecting...</div>
        )}
        {status === 'error' && (
          <div className="text-red-400">Invalid or expired link. <Link to="/" className="underline">Try again</Link></div>
        )}
      </div>
    </div>
  )
}

// Checkout Success Page
function CheckoutSuccess() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redirect to dashboard after a moment
    const timer = setTimeout(() => navigate('/dashboard'), 3000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
        <p className="text-zinc-400 mb-6">
          Check your email for the magic link to access your dashboard and license key.
        </p>
        <p className="text-zinc-500 text-sm">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}

// Dashboard Login Form
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
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 transition-all disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Magic Link'}
      </button>
      {message && (
        <p className={`text-center text-sm ${message.includes('Check') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </form>
  )
}

// Dashboard Page
function Dashboard() {
  const { token, user, logout, isAuthenticated } = useAuth()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [requiresUpgrade, setRequiresUpgrade] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', api_url: '', app_url: '', stack: '' })
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'settings'>('overview')
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
        },
        body: JSON.stringify({
          return_url: `${window.location.origin}/dashboard`
        })
      })

      if (res.ok) {
        const { portal_url } = await res.json()
        window.location.href = portal_url
      }
    } catch (err) {
      console.error('Portal error:', err)
    }
  }

  const openProjectSettings = (project: Project) => {
    setEditingProject(project)
    setProjectSettings({
      name: project.name,
      description: project.description || '',
      api_url: project.api_url || '',
      app_url: project.app_url || '',
      github_repo: project.github_repo || '',
      slack_webhook_url: project.slack_webhook_url || '',
      slack_notify_on_pass: project.slack_notify_on_pass,
      slack_notify_on_fail: project.slack_notify_on_fail,
      qa_schedule: project.qa_schedule,
      production_url: project.production_url || '',
      production_api_url: project.production_api_url || '',
      enable_production_testing: project.enable_production_testing || false,
      production_test_schedule: project.production_test_schedule || 'none',
      health_check_endpoint: project.health_check_endpoint || '/health'
    })
  }

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProject) return

    try {
      const res = await fetch(`${API_URL}/api/v1/dashboard/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(projectSettings)
      })

      if (res.ok) {
        const updated = await res.json()
        setProjects(projects.map(p => p.id === updated.id ? updated : p))
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
        setEditingProject(null)
      }
    } catch (err) {
      console.error('Delete project error:', err)
    }
  }

  const [showGitHubWorkflow, setShowGitHubWorkflow] = useState(false)
  const [githubWorkflow, setGithubWorkflow] = useState<{workflow: string, license_key: string | null, instructions: string[]} | null>(null)

  // Production Test Results
  interface ProductionTestRun {
    id: string
    status: string
    run_type: string
    endpoints_tested: number
    endpoints_passed: number
    endpoints_failed: number
    ui_tests_passed: number
    ui_tests_failed: number
    api_results?: Array<{endpoint: string, method: string, status_code: number, response_time_ms: number, passed: boolean, error?: string}>
    ui_results?: Array<{test_name: string, passed: boolean, duration_ms: number, error?: string}>
    health_results?: {status: string, response_time_ms: number, endpoint: string}
    created_at: string
    duration_ms?: number
  }
  const [showTestResults, setShowTestResults] = useState(false)
  const [testResults, setTestResults] = useState<ProductionTestRun[]>([])
  const [loadingTestResults, setLoadingTestResults] = useState(false)

  const handleCopyGitHubAction = async (projectId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/dashboard/projects/${projectId}/github-workflow`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setGithubWorkflow(data)
        setShowGitHubWorkflow(true)
      }
    } catch (err) {
      console.error('Get workflow error:', err)
    }
  }

  const fetchTestResults = async (projectId: string) => {
    setLoadingTestResults(true)
    try {
      const res = await fetch(`${API_URL}/api/v1/dashboard/projects/${projectId}/production-runs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setTestResults(data.runs || [])
        setShowTestResults(true)
      }
    } catch (err) {
      console.error('Fetch test results error:', err)
    } finally {
      setLoadingTestResults(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold">D</span>
              </div>
              <span className="text-2xl font-semibold text-white">DevLoop</span>
            </Link>
            <h1 className="text-2xl font-bold text-white mb-2">Sign in to Dashboard</h1>
            <p className="text-zinc-400">Enter your email to receive a magic link</p>
          </div>

          <DashboardLoginForm />

          <div className="mt-8 text-center">
            <p className="text-zinc-500 text-sm">
              Don't have an account?{' '}
              <Link to="/#pricing" className="text-indigo-400 hover:text-indigo-300">
                View pricing
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-zinc-400">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  const handleCheckout = async (plan: 'solo' | 'pro' | 'team') => {
    setCheckoutLoading(plan)
    try {
      const res = await fetch(`${API_URL}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          email: user?.email,
          success_url: `${window.location.origin}/dashboard?checkout=success`,
          cancel_url: `${window.location.origin}/dashboard?checkout=cancelled`,
        })
      })

      if (res.ok) {
        const { checkout_url } = await res.json()
        window.location.href = checkout_url
      } else {
        const error = await res.json()
        alert(error.detail || 'Failed to start checkout')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Failed to start checkout. Please try again.')
    }
    setCheckoutLoading(null)
  }

  // Upgrade Required Screen for Free Users
  if (requiresUpgrade) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Navbar activePage="dashboard" user={user} onLogout={logout} />

        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 sm:py-20 pt-24">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">Upgrade to Access Dashboard</h1>
            <p className="text-lg text-zinc-400 mb-8 max-w-xl mx-auto">
              The DevLoop dashboard is available for paid subscribers. Choose a plan to unlock powerful QA automation features.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
              <h3 className="text-lg font-semibold text-white mb-2">Solo</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-white">$19</span>
                <span className="text-zinc-400">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  1 project
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Unlimited QA runs
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Email support
                </li>
              </ul>
              <button
                onClick={() => handleCheckout('solo')}
                disabled={checkoutLoading !== null}
                className="block w-full py-2.5 px-4 rounded-lg bg-zinc-800 text-white text-sm font-medium text-center hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkoutLoading === 'solo' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing...
                  </span>
                ) : 'Subscribe to Solo'}
              </button>
            </div>

            <div className="p-6 rounded-2xl border-2 border-indigo-500 bg-zinc-900/50 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-500 text-white text-xs font-medium">
                Popular
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-white">$39</span>
                <span className="text-zinc-400">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  5 projects
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Scheduled QA runs
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Slack integration
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Priority support
                </li>
              </ul>
              <button
                onClick={() => handleCheckout('pro')}
                disabled={checkoutLoading !== null}
                className="block w-full py-2.5 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium text-center hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkoutLoading === 'pro' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing...
                  </span>
                ) : 'Subscribe to Pro'}
              </button>
            </div>

            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
              <h3 className="text-lg font-semibold text-white mb-2">Team</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-white">$79</span>
                <span className="text-zinc-400">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Unlimited projects
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Team collaboration
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  GitHub Actions
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Dedicated support
                </li>
              </ul>
              <button
                onClick={() => handleCheckout('team')}
                disabled={checkoutLoading !== null}
                className="block w-full py-2.5 px-4 rounded-lg bg-zinc-800 text-white text-sm font-medium text-center hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkoutLoading === 'team' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing...
                  </span>
                ) : 'Subscribe to Team'}
              </button>
            </div>
          </div>

          <p className="text-center text-zinc-500 text-sm mt-8">
            Have questions?{' '}
            <a href="mailto:support@devloop.dev" className="text-indigo-400 hover:text-indigo-300">Contact us</a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar activePage="dashboard" user={user} onLogout={logout} />

      {/* Dashboard Tab Navigation */}
      <div className="border-b border-zinc-800/50 bg-[#0a0a0f] pt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-1 sm:gap-2 py-3">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'projects' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
            >
              Projects
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Welcome Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Welcome back!</h1>
          <p className="text-zinc-400 text-sm mt-1">Here's an overview of your QA automation.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="p-4 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-zinc-400 text-xs sm:text-sm">Plan</div>
                <div className="text-lg sm:text-2xl font-bold text-white capitalize truncate">
                  {summary?.plan || 'Free'}
                </div>
              </div>
            </div>
            {summary?.subscription_active && (
              <span className="inline-block mt-2 sm:mt-3 px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                Active
              </span>
            )}
          </div>

          <div className="p-4 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <div className="text-zinc-400 text-xs sm:text-sm">Projects</div>
                <div className="text-lg sm:text-2xl font-bold text-white">
                  {summary?.total_projects || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <div className="text-zinc-400 text-xs sm:text-sm">QA Runs</div>
                <div className="text-lg sm:text-2xl font-bold text-white">
                  {summary?.total_qa_runs || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <div className="text-zinc-400 text-xs sm:text-sm">Pass Rate</div>
                <div className="text-lg sm:text-2xl font-bold text-white">
                  {summary && summary.total_qa_runs > 0
                    ? `${Math.round((summary.passed_runs / summary.total_qa_runs) * 100)}%`
                    : '-'}
                </div>
              </div>
            </div>
            {summary && summary.total_qa_runs > 0 && (
              <div className="mt-2 sm:mt-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="text-green-400">{summary.passed_runs} passed</span>
                  <span>/</span>
                  <span className="text-red-400">{summary.failed_runs} failed</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* License Key */}
        {summary?.license_key && (
          <div className="p-4 sm:p-6 rounded-xl border border-indigo-500/30 bg-indigo-500/5 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-zinc-400 text-xs sm:text-sm mb-1">Your License Key</div>
                <div className="text-base sm:text-xl font-mono text-white break-all">{summary.license_key}</div>
                <p className="text-zinc-500 text-xs sm:text-sm mt-2 hidden sm:block">
                  Use this key when running `npx create-devloop` or set DEVLOOP_LICENSE_KEY in your environment.
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(summary.license_key!)
                  alert('License key copied!')
                }}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2 justify-center sm:flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Key
              </button>
            </div>
          </div>
        )}

        {/* Projects Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Projects</h2>
            <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Manage your QA automation projects</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {summary?.subscription_active && (
              <button
                onClick={handleManageBilling}
                className="px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs sm:text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span className="hidden sm:inline">Manage Billing</span>
                <span className="sm:hidden">Billing</span>
              </button>
            )}
            <button
              onClick={() => setShowNewProject(true)}
              className="px-3 sm:px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs sm:text-sm hover:bg-indigo-500 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>

        {/* New Project Form */}
        {showNewProject && (
          <div className="p-4 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Create New Project</h3>
                <p className="text-zinc-500 text-xs">Add a new project to monitor with QA automation</p>
              </div>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm text-zinc-400 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="My SaaS"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm text-zinc-400 mb-1">API URL</label>
                  <input
                    type="url"
                    value={newProject.api_url}
                    onChange={(e) => setNewProject({ ...newProject, api_url: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="http://localhost:8000"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm text-zinc-400 mb-1">App URL</label>
                  <input
                    type="url"
                    value={newProject.app_url}
                    onChange={(e) => setNewProject({ ...newProject, app_url: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="http://localhost:3000"
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProject(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Project
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Projects List */}
        {projects.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p className="text-zinc-400 text-sm sm:text-base mb-2">No projects yet</p>
            <p className="text-zinc-600 text-xs sm:text-sm">Create your first project to start QA automation</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-4 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h3 className="text-base sm:text-lg font-semibold text-white truncate">{project.name}</h3>
                      {project.last_qa_status && (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          project.last_qa_status === 'passed'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : project.last_qa_status === 'failed'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        }`}>
                          {project.last_qa_status}
                        </span>
                      )}
                      {project.qa_schedule !== 'none' && (
                        <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {project.qa_schedule}
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-zinc-400 text-xs sm:text-sm mt-1 line-clamp-1">{project.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-zinc-500">
                      {project.api_url && (
                        <span className="flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                          </svg>
                          {project.api_url}
                        </span>
                      )}
                      {project.app_url && (
                        <span className="flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                          </svg>
                          {project.app_url}
                        </span>
                      )}
                      {project.github_repo && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                          </svg>
                          GitHub
                        </span>
                      )}
                      {project.slack_webhook_url && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                          </svg>
                          Slack
                        </span>
                      )}
                    </div>
                    {project.next_scheduled_run && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-indigo-400">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Next run: {new Date(project.next_scheduled_run).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                    {project.last_qa_run_at && (
                      <div className="text-zinc-500 text-xs">
                        Last: {new Date(project.last_qa_run_at).toLocaleDateString()}
                      </div>
                    )}
                    <button
                      onClick={() => openProjectSettings(project)}
                      className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                      title="Project Settings"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Project Settings Modal */}
        {editingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-white">Project Settings</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5 hidden sm:block">{editingProject.name}</p>
                  </div>
                  <button
                    onClick={() => setEditingProject(null)}
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdateProject} className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* Basic Info */}
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-xs sm:text-sm font-medium text-zinc-400 uppercase tracking-wider">Basic Info</h3>
                  <div>
                    <label className="block text-xs sm:text-sm text-zinc-400 mb-1">Project Name</label>
                    <input
                      type="text"
                      value={projectSettings.name}
                      onChange={(e) => setProjectSettings({ ...projectSettings, name: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm text-zinc-400 mb-1">API URL</label>
                      <input
                        type="url"
                        value={projectSettings.api_url}
                        onChange={(e) => setProjectSettings({ ...projectSettings, api_url: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="http://localhost:8000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm text-zinc-400 mb-1">App URL</label>
                      <input
                        type="url"
                        value={projectSettings.app_url}
                        onChange={(e) => setProjectSettings({ ...projectSettings, app_url: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="http://localhost:3000"
                      />
                    </div>
                  </div>
                </div>

                {/* Scheduled QA */}
                <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-5 border-t border-zinc-800">
                  <h3 className="text-xs sm:text-sm font-medium text-zinc-400 uppercase tracking-wider">Scheduled QA</h3>
                  <div>
                    <label className="block text-xs sm:text-sm text-zinc-400 mb-1">Schedule Frequency</label>
                    <select
                      value={projectSettings.qa_schedule}
                      onChange={(e) => setProjectSettings({ ...projectSettings, qa_schedule: e.target.value as typeof projectSettings.qa_schedule })}
                      className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="none">No Schedule (Manual Only)</option>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily (2 AM UTC)</option>
                      <option value="weekly">Weekly (Monday 2 AM UTC)</option>
                    </select>
                    <p className="text-xs text-zinc-500 mt-1">
                      Automatically run QA tests on a schedule
                    </p>
                  </div>
                </div>

                {/* GitHub Integration */}
                <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-5 border-t border-zinc-800">
                  <h3 className="text-xs sm:text-sm font-medium text-zinc-400 uppercase tracking-wider">GitHub Integration</h3>
                  <div>
                    <label className="block text-xs sm:text-sm text-zinc-400 mb-1">Repository</label>
                    <input
                      type="text"
                      value={projectSettings.github_repo}
                      onChange={(e) => setProjectSettings({ ...projectSettings, github_repo: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="owner/repo"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Connect to receive PR comments and QA status checks
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyGitHubAction(editingProject.id)}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs sm:text-sm hover:bg-zinc-700 transition-colors w-full sm:w-auto justify-center sm:justify-start"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    Copy GitHub Action
                  </button>
                </div>

                {/* Slack Integration */}
                <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-5 border-t border-zinc-800">
                  <h3 className="text-xs sm:text-sm font-medium text-zinc-400 uppercase tracking-wider">Slack Notifications</h3>
                  <div>
                    <label className="block text-xs sm:text-sm text-zinc-400 mb-1">Webhook URL</label>
                    <input
                      type="url"
                      value={projectSettings.slack_webhook_url}
                      onChange={(e) => setProjectSettings({ ...projectSettings, slack_webhook_url: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={projectSettings.slack_notify_on_fail}
                        onChange={(e) => setProjectSettings({ ...projectSettings, slack_notify_on_fail: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-900"
                      />
                      <span className="text-xs sm:text-sm text-zinc-300">Notify on failure</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={projectSettings.slack_notify_on_pass}
                        onChange={(e) => setProjectSettings({ ...projectSettings, slack_notify_on_pass: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-900"
                      />
                      <span className="text-xs sm:text-sm text-zinc-300">Notify on success</span>
                    </label>
                  </div>
                  {projectSettings.slack_webhook_url && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_URL}/api/v1/dashboard/projects/${editingProject.id}/test-slack`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` }
                          })
                          const data = await res.json()
                          alert(data.success ? 'Test notification sent!' : `Failed: ${data.message}`)
                        } catch {
                          alert('Failed to send test notification')
                        }
                      }}
                      className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs sm:text-sm hover:bg-zinc-700 transition-colors w-full sm:w-auto justify-center sm:justify-start"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Test Slack Notification
                    </button>
                  )}
                </div>

                {/* Production Testing */}
                <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-5 border-t border-zinc-800">
                  <h3 className="text-xs sm:text-sm font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Production Testing
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={projectSettings.enable_production_testing}
                      onChange={(e) => setProjectSettings({ ...projectSettings, enable_production_testing: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-red-500 focus:ring-red-500 focus:ring-offset-zinc-900"
                    />
                    <span className="text-xs sm:text-sm text-zinc-300">Enable Production Testing</span>
                  </label>
                  {projectSettings.enable_production_testing && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm text-zinc-400 mb-1">Production URL</label>
                          <input
                            type="url"
                            value={projectSettings.production_url}
                            onChange={(e) => setProjectSettings({ ...projectSettings, production_url: e.target.value })}
                            className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                            placeholder="https://myapp.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm text-zinc-400 mb-1">Production API URL</label>
                          <input
                            type="url"
                            value={projectSettings.production_api_url}
                            onChange={(e) => setProjectSettings({ ...projectSettings, production_api_url: e.target.value })}
                            className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                            placeholder="https://api.myapp.com"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm text-zinc-400 mb-1">Health Check Endpoint</label>
                          <input
                            type="text"
                            value={projectSettings.health_check_endpoint}
                            onChange={(e) => setProjectSettings({ ...projectSettings, health_check_endpoint: e.target.value })}
                            className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                            placeholder="/health"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm text-zinc-400 mb-1">Test Schedule</label>
                          <select
                            value={projectSettings.production_test_schedule}
                            onChange={(e) => setProjectSettings({ ...projectSettings, production_test_schedule: e.target.value as 'none' | 'hourly' | 'daily' | 'weekly' })}
                            className="w-full px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                          >
                            <option value="none">Manual Only</option>
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_URL}/api/v1/dashboard/projects/${editingProject.id}/production-test`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                              },
                              body: JSON.stringify({ run_type: 'full' })
                            })
                            const data = await res.json()
                            if (res.ok) {
                              alert(`Production test started! Status: ${data.status}`)
                            } else {
                              alert(`Failed: ${data.detail || 'Unknown error'}`)
                            }
                          } catch {
                            alert('Failed to trigger production test')
                          }
                        }}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs sm:text-sm hover:bg-red-500/20 transition-colors w-full sm:w-auto justify-center sm:justify-start"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Run Production Tests Now
                      </button>
                      <button
                        type="button"
                        onClick={() => fetchTestResults(editingProject.id)}
                        disabled={loadingTestResults}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs sm:text-sm hover:bg-zinc-700 transition-colors w-full sm:w-auto justify-center sm:justify-start disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {loadingTestResults ? 'Loading...' : 'View Results'}
                      </button>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 sm:pt-5 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(editingProject.id)}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs sm:text-sm hover:bg-red-500/20 transition-colors text-center"
                  >
                    Delete Project
                  </button>
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingProject(null)}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs sm:text-sm hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs sm:text-sm hover:bg-indigo-500 transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* GitHub Workflow Modal */}
        {showGitHubWorkflow && githubWorkflow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    <h2 className="text-lg sm:text-xl font-semibold text-white">GitHub Actions Workflow</h2>
                  </div>
                  <button
                    onClick={() => setShowGitHubWorkflow(false)}
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* Instructions */}
                <div className="space-y-2">
                  <h3 className="text-xs sm:text-sm font-medium text-zinc-400 uppercase tracking-wider">Setup Instructions</h3>
                  <ol className="space-y-2">
                    {githubWorkflow.instructions.map((instruction, i) => (
                      <li key={i} className="text-xs sm:text-sm text-zinc-300">{instruction}</li>
                    ))}
                  </ol>
                </div>

                {/* Workflow */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">.github/workflows/devloop.yml</h3>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(githubWorkflow.workflow)
                        alert('Workflow copied to clipboard!')
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 overflow-x-auto font-mono whitespace-pre-wrap">
                    {githubWorkflow.workflow}
                  </pre>
                </div>

                {/* License Key */}
                {githubWorkflow.license_key && (
                  <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-indigo-300 font-medium">Your License Key</div>
                        <div className="text-lg font-mono text-white mt-1">{githubWorkflow.license_key}</div>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(githubWorkflow.license_key!)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-500 transition-colors"
                      >
                        Copy Key
                      </button>
                    </div>
                    <p className="text-xs text-indigo-400 mt-2">
                      Add this as DEVLOOP_LICENSE_KEY secret in your GitHub repository settings.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setShowGitHubWorkflow(false)}
                  className="w-full py-3 px-4 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Results Modal */}
        {showTestResults && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h2 className="text-lg sm:text-xl font-semibold text-white">Production Test Results</h2>
                  </div>
                  <button
                    onClick={() => setShowTestResults(false)}
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {testResults.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-zinc-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-zinc-400">No test runs yet. Run your first production test!</p>
                  </div>
                ) : (
                  testResults.map((run) => (
                    <div key={run.id} className="border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            run.status === 'passed' ? 'bg-green-500/10 text-green-400' :
                            run.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                            'bg-yellow-500/10 text-yellow-400'
                          }`}>
                            {run.status.toUpperCase()}
                          </span>
                          <span className="text-zinc-400 text-sm">{run.run_type}</span>
                        </div>
                        <div className="text-zinc-500 text-xs">
                          {new Date(run.created_at).toLocaleString()}
                          {run.duration_ms && <span className="ml-2">({run.duration_ms}ms)</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
                          <div className="text-lg font-semibold text-green-400">{run.endpoints_passed}</div>
                          <div className="text-xs text-zinc-500">API Passed</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
                          <div className="text-lg font-semibold text-red-400">{run.endpoints_failed}</div>
                          <div className="text-xs text-zinc-500">API Failed</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
                          <div className="text-lg font-semibold text-green-400">{run.ui_tests_passed}</div>
                          <div className="text-xs text-zinc-500">UI Passed</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
                          <div className="text-lg font-semibold text-red-400">{run.ui_tests_failed}</div>
                          <div className="text-xs text-zinc-500">UI Failed</div>
                        </div>
                      </div>

                      {run.health_results && (
                        <div className="mb-3 p-2 bg-zinc-800/30 rounded-lg">
                          <span className="text-xs text-zinc-400">Health: </span>
                          <span className={`text-xs font-medium ${
                            run.health_results.status === 'healthy' ? 'text-green-400' :
                            run.health_results.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {run.health_results.status}
                          </span>
                          <span className="text-xs text-zinc-500 ml-2">
                            {run.health_results.endpoint} ({run.health_results.response_time_ms}ms)
                          </span>
                        </div>
                      )}

                      {run.api_results && run.api_results.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-zinc-400 mb-1">API Endpoints:</div>
                          {run.api_results.map((result, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className={result.passed ? 'text-green-400' : 'text-red-400'}>
                                {result.passed ? '✓' : '✗'}
                              </span>
                              <span className="text-zinc-300">{result.method} {result.endpoint}</span>
                              <span className="text-zinc-500">({result.status_code}) {result.response_time_ms}ms</span>
                              {result.error && <span className="text-red-400">{result.error}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {run.ui_results && run.ui_results.length > 0 && (
                        <div className="space-y-1 mt-2">
                          <div className="text-xs text-zinc-400 mb-1">UI Tests:</div>
                          {run.ui_results.map((result, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className={result.passed ? 'text-green-400' : 'text-red-400'}>
                                {result.passed ? '✓' : '✗'}
                              </span>
                              <span className="text-zinc-300">{result.test_name}</span>
                              <span className="text-zinc-500">({result.duration_ms}ms)</span>
                              {result.error && <span className="text-red-400">{result.error}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}

                <button
                  onClick={() => setShowTestResults(false)}
                  className="w-full py-3 px-4 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Documentation Page
function DocsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar activePage="docs" />

      {/* Docs Content */}
      <div className="pt-24 pb-20 px-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-white mb-8">Documentation</h1>

          {/* Quick Start */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4" id="quick-start">Quick Start</h2>
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">1. Get a License</h3>
                  <p className="text-zinc-400 text-sm mb-2">Sign up and subscribe to get your license key (DL-XXXX-XXXX-XXXX).</p>
                  <Link to="/#pricing" className="text-indigo-400 hover:text-indigo-300 text-sm">View pricing &rarr;</Link>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">2. Install</h3>
                  <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm">
                    <span className="text-green-400">$</span>
                    <span className="text-zinc-300 ml-2">npx create-devloop</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">3. Configure</h3>
                  <p className="text-zinc-400 text-sm">Edit the generated config files for your project:</p>
                  <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                    <li><code className="text-indigo-400">.devloop/config.md</code> - Project conventions</li>
                    <li><code className="text-indigo-400">.devloop/test-accounts.md</code> - Test credentials</li>
                    <li><code className="text-indigo-400">.devloop/features.md</code> - Feature documentation</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">4. Run Tests</h3>
                  <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm space-y-1">
                    <div><span className="text-green-400">$</span><span className="text-zinc-300 ml-2">./scripts/qa.sh smoke</span><span className="text-zinc-500 ml-4"># Quick health check</span></div>
                    <div><span className="text-green-400">$</span><span className="text-zinc-300 ml-2">./scripts/qa.sh all</span><span className="text-zinc-500 ml-4"># Full test suite</span></div>
                    <div><span className="text-green-400">$</span><span className="text-zinc-300 ml-2">./scripts/qa.sh fix</span><span className="text-zinc-500 ml-4"># Auto-fix failures</span></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* What Gets Created */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4" id="structure">Project Structure</h2>
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <pre className="text-sm text-zinc-300 overflow-x-auto">{`your-project/
├── .devloop/
│   ├── config.md            # Project config & conventions
│   ├── features.md          # Feature documentation
│   ├── test-accounts.md     # QA credentials
│   ├── task.md              # Current task (for AI)
│   └── qa/                  # Test results & screenshots
├── scripts/
│   ├── qa.sh                # Main QA runner
│   ├── qa-api.sh            # API endpoint tests
│   ├── qa-ui.sh             # UI screenshot tests
│   ├── qa-fix.sh            # Auto-fix loop
│   ├── quick.sh             # Shortcut commands
│   └── context.sh           # Generate codebase context
└── .devloop.json            # DevLoop configuration`}</pre>
            </div>
          </section>

          {/* Commands */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4" id="commands">Commands Reference</h2>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                <h3 className="text-lg font-medium text-white mb-3">QA Testing</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-400 border-b border-zinc-800">
                        <th className="pb-2">Command</th>
                        <th className="pb-2">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-300">
                      <tr className="border-b border-zinc-800/50">
                        <td className="py-2 font-mono text-indigo-400">./scripts/qa.sh smoke</td>
                        <td className="py-2">Quick health check</td>
                      </tr>
                      <tr className="border-b border-zinc-800/50">
                        <td className="py-2 font-mono text-indigo-400">./scripts/qa.sh api</td>
                        <td className="py-2">API tests only</td>
                      </tr>
                      <tr className="border-b border-zinc-800/50">
                        <td className="py-2 font-mono text-indigo-400">./scripts/qa.sh ui</td>
                        <td className="py-2">UI tests only</td>
                      </tr>
                      <tr className="border-b border-zinc-800/50">
                        <td className="py-2 font-mono text-indigo-400">./scripts/qa.sh all</td>
                        <td className="py-2">Full test suite</td>
                      </tr>
                      <tr className="border-b border-zinc-800/50">
                        <td className="py-2 font-mono text-indigo-400">./scripts/qa.sh report</td>
                        <td className="py-2">Generate report</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-mono text-indigo-400">./scripts/qa.sh fix</td>
                        <td className="py-2">Auto-fix failures with AI</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                <h3 className="text-lg font-medium text-white mb-3">Quick Commands</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-400 border-b border-zinc-800">
                        <th className="pb-2">Command</th>
                        <th className="pb-2">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-300">
                      <tr className="border-b border-zinc-800/50">
                        <td className="py-2 font-mono text-indigo-400">./scripts/quick.sh qa</td>
                        <td className="py-2">Run full QA suite</td>
                      </tr>
                      <tr className="border-b border-zinc-800/50">
                        <td className="py-2 font-mono text-indigo-400">./scripts/quick.sh smoke</td>
                        <td className="py-2">Quick smoke test</td>
                      </tr>
                      <tr className="border-b border-zinc-800/50">
                        <td className="py-2 font-mono text-indigo-400">./scripts/quick.sh qa-fix</td>
                        <td className="py-2">Auto-fix with AI</td>
                      </tr>
                      <tr className="border-b border-zinc-800/50">
                        <td className="py-2 font-mono text-indigo-400">./scripts/quick.sh ai "prompt"</td>
                        <td className="py-2">Run DevLoop AI</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-mono text-indigo-400">./scripts/quick.sh status</td>
                        <td className="py-2">Show project status</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* Environment Variables */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4" id="env">Environment Variables</h2>
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-400 border-b border-zinc-800">
                      <th className="pb-2">Variable</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Default</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 font-mono text-indigo-400">DEVLOOP_LICENSE_KEY</td>
                      <td className="py-2">Your license key</td>
                      <td className="py-2 text-zinc-500">(required)</td>
                    </tr>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 font-mono text-indigo-400">DEVLOOP_API_URL</td>
                      <td className="py-2">API base URL</td>
                      <td className="py-2 text-zinc-500">http://localhost:3000/api</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono text-indigo-400">DEVLOOP_APP_URL</td>
                      <td className="py-2">App base URL</td>
                      <td className="py-2 text-zinc-500">http://localhost:3000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4" id="how-it-works">How It Works</h2>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                <h3 className="text-lg font-medium text-white mb-2">1. API Testing</h3>
                <p className="text-zinc-400 text-sm mb-4">Automatically tests your API endpoints with health checks, auth flows, CRUD operations, and error handling.</p>
                <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm space-y-1">
                  <div className="text-green-400">API Tests</div>
                  <div className="text-green-400">=========</div>
                  <div className="text-zinc-300">GET /api/health - <span className="text-green-400">200 OK</span></div>
                  <div className="text-zinc-300">POST /api/auth/login - <span className="text-green-400">200 OK</span></div>
                  <div className="text-zinc-300">GET /api/users - <span className="text-green-400">200 OK</span> (authenticated)</div>
                  <div className="text-zinc-300">POST /api/users - <span className="text-red-400">500 Internal Server Error</span></div>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                <h3 className="text-lg font-medium text-white mb-2">2. UI Testing</h3>
                <p className="text-zinc-400 text-sm mb-4">Captures screenshots at multiple viewports: Desktop (1920x1080), Tablet (768x1024), Mobile (375x667).</p>
                <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm space-y-1">
                  <div className="text-green-400">UI Tests</div>
                  <div className="text-green-400">========</div>
                  <div className="text-zinc-300">Homepage - <span className="text-green-400">3 screenshots captured</span></div>
                  <div className="text-zinc-300">Login page - <span className="text-green-400">3 screenshots captured</span></div>
                  <div className="text-zinc-300">Dashboard - <span className="text-green-400">3 screenshots captured</span></div>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                <h3 className="text-lg font-medium text-white mb-2">3. AI Vision Checks</h3>
                <p className="text-zinc-400 text-sm mb-4">DevLoop AI analyzes screenshots to check for broken layouts, missing elements, and visual regressions.</p>
              </div>

              <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                <h3 className="text-lg font-medium text-white mb-2">4. Auto-Fix Loop</h3>
                <p className="text-zinc-400 text-sm mb-4">When tests fail, DevLoop AI analyzes failures and automatically fixes issues, then re-runs tests to verify.</p>
                <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm space-y-1">
                  <div className="text-yellow-400">Attempt 1 of 3</div>
                  <div className="text-zinc-300">Found 2 failures:</div>
                  <div className="text-red-400">- API: POST /api/users - 500 Error</div>
                  <div className="text-red-400">- UI: Dashboard - missing sidebar</div>
                  <div className="text-zinc-500 mt-2">Running DevLoop AI to fix issues...</div>
                  <div className="text-zinc-500">[AI makes code changes]</div>
                  <div className="text-zinc-500">Re-running tests...</div>
                  <div className="text-green-400 mt-2">All failures fixed!</div>
                </div>
              </div>
            </div>
          </section>

          {/* CI/CD */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4" id="ci-cd">CI/CD Integration</h2>
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <h3 className="text-lg font-medium text-white mb-3">GitHub Actions</h3>
              <pre className="text-sm text-zinc-300 overflow-x-auto bg-zinc-950 rounded-lg p-4">{`name: QA
on: [push, pull_request]

jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Start app
        run: npm start &

      - name: Run QA
        env:
          DEVLOOP_LICENSE_KEY: \${{ secrets.DEVLOOP_LICENSE_KEY }}
          DEVLOOP_API_URL: http://localhost:3000/api
          DEVLOOP_APP_URL: http://localhost:3000
        run: ./scripts/qa.sh all`}</pre>
            </div>
          </section>

          {/* Supported Stacks */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4" id="stacks">Supported Stacks</h2>
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <p className="text-zinc-400 text-sm mb-4">DevLoop auto-detects your project type. The QA scripts are stack-agnostic - they test HTTP endpoints and capture browser screenshots.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-zinc-300 text-sm"><span className="text-indigo-400">Node.js</span> - Express, Fastify, Nest.js</div>
                <div className="text-zinc-300 text-sm"><span className="text-indigo-400">React</span> - Create React App, Vite</div>
                <div className="text-zinc-300 text-sm"><span className="text-indigo-400">Next.js</span> - App Router, Pages Router</div>
                <div className="text-zinc-300 text-sm"><span className="text-indigo-400">Vue</span> - Vue CLI, Nuxt</div>
                <div className="text-zinc-300 text-sm"><span className="text-indigo-400">Python</span> - Flask, FastAPI, Django</div>
                <div className="text-zinc-300 text-sm"><span className="text-indigo-400">Go</span> - Gin, Echo, Chi</div>
              </div>
            </div>
          </section>

          {/* Requirements */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4" id="requirements">Requirements</h2>
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <ul className="space-y-2 text-sm text-zinc-300">
                <li>Node.js 18+</li>
                <li>curl (for API tests)</li>
                <li>Chrome/Chromium (for UI screenshots, optional)</li>
              </ul>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-800/50">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">D</span>
            </div>
            <span className="text-sm text-zinc-500">DevLoop</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/#pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Main App with Router
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/auth/verify" element={<AuthVerify />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

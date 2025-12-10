import { useState } from 'react'

function App() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    // Simulate API call - replace with actual waitlist endpoint
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-[#0a0a0f]/80 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="text-xl font-semibold text-white">DevLoop</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-zinc-400 hover:text-white transition-colors text-sm">Features</a>
            <a href="#how-it-works" className="text-zinc-400 hover:text-white transition-colors text-sm">How it Works</a>
            <a href="https://github.com" className="text-zinc-400 hover:text-white transition-colors text-sm">GitHub</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-sm text-zinc-400">Now in beta</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="text-white">Ship faster.</span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Break nothing.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Autonomous QA that finds bugs, fixes them, and verifies the fix.
            Built for indie hackers who ship fast.
          </p>

          {/* CTA Form */}
          <div className="max-w-md mx-auto">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Joining...' : 'Join Waitlist'}
                </button>
              </form>
            ) : (
              <div className="p-4 rounded-lg bg-green-900/20 border border-green-800/50">
                <p className="text-green-400 font-medium">You're on the list! We'll be in touch soon.</p>
              </div>
            )}
            <p className="text-zinc-500 text-sm mt-4">
              Get early access. No spam, ever.
            </p>
          </div>
        </div>
      </section>

      {/* Terminal Demo */}
      <section className="py-16 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-2xl">
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-4 text-sm text-zinc-500 font-mono">terminal</span>
            </div>
            {/* Terminal Content */}
            <div className="p-6 font-mono text-sm">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-green-400">$</span>
                  <span className="text-zinc-300">npx create-devloop</span>
                </div>
                <div className="text-zinc-500 pl-4">
                  <p>Setting up DevLoop in: ~/my-saas</p>
                  <p className="text-green-400 mt-2">Created .claude/</p>
                  <p className="text-green-400">Created scripts/</p>
                  <p className="text-green-400">Created .cursorrules</p>
                </div>
                <div className="flex items-start gap-2 mt-4">
                  <span className="text-green-400">$</span>
                  <span className="text-zinc-300">./scripts/qa.sh smoke</span>
                </div>
                <div className="text-zinc-500 pl-4">
                  <p className="text-blue-400">Running Smoke Test...</p>
                  <p className="text-green-400">✓ API is healthy</p>
                  <p className="text-green-400">✓ UI is accessible</p>
                  <p className="text-green-400">✓ Auth endpoint responding</p>
                  <p className="mt-2 text-green-400 font-bold">Smoke test passed!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              QA that runs while you sleep
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Set it up once, ship with confidence forever. DevLoop catches bugs before your users do.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Auto-Discovery</h3>
              <p className="text-zinc-400 text-sm">
                Automatically discovers your API endpoints and UI routes. No manual test writing required.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">API Testing</h3>
              <p className="text-zinc-400 text-sm">
                Tests every endpoint with authentication, validates responses, checks error handling.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">UI Screenshots</h3>
              <p className="text-zinc-400 text-sm">
                Captures screenshots at multiple viewports. Catch visual regressions automatically.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI Vision</h3>
              <p className="text-zinc-400 text-sm">
                Claude analyzes screenshots to verify UI looks correct. Catches broken layouts and missing elements.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Auto-Fix Loop</h3>
              <p className="text-zinc-400 text-sm">
                When tests fail, Claude CLI analyzes the failure and attempts to fix it automatically.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Verify & Report</h3>
              <p className="text-zinc-400 text-sm">
                After fixes, re-runs tests to verify. Generates detailed reports with screenshots.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 border-t border-zinc-800/50">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Three commands. That's it.
            </h2>
            <p className="text-lg text-zinc-400">
              Set up in 30 seconds, run forever.
            </p>
          </div>

          <div className="space-y-12">
            {/* Step 1 */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                <span className="text-indigo-400 font-bold">1</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Install DevLoop</h3>
                <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 font-mono text-sm">
                  <span className="text-green-400">$</span>
                  <span className="text-zinc-300 ml-2">npx create-devloop</span>
                </div>
                <p className="text-zinc-400 text-sm mt-2">
                  Scaffolds .claude folder, scripts, and configuration for your project.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <span className="text-purple-400 font-bold">2</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Run QA Suite</h3>
                <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 font-mono text-sm">
                  <span className="text-green-400">$</span>
                  <span className="text-zinc-300 ml-2">./scripts/qa.sh all</span>
                </div>
                <p className="text-zinc-400 text-sm mt-2">
                  Tests API endpoints, takes screenshots, runs AI vision checks.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
                <span className="text-pink-400 font-bold">3</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Auto-Fix Failures</h3>
                <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 font-mono text-sm">
                  <span className="text-green-400">$</span>
                  <span className="text-zinc-300 ml-2">./scripts/qa-fix.sh</span>
                </div>
                <p className="text-zinc-400 text-sm mt-2">
                  Claude analyzes failures and fixes them. Loops until all tests pass.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 border-t border-zinc-800/50">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Stop shipping bugs.
          </h2>
          <p className="text-lg text-zinc-400 mb-8">
            Join the waitlist for early access.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Joining...' : 'Join Waitlist'}
              </button>
            </form>
          ) : (
            <div className="p-4 rounded-lg bg-green-900/20 border border-green-800/50 max-w-md mx-auto">
              <p className="text-green-400 font-medium">You're on the list!</p>
            </div>
          )}
        </div>
      </section>

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
            <a href="https://github.com" className="hover:text-white transition-colors">GitHub</a>
            <a href="https://twitter.com" className="hover:text-white transition-colors">Twitter</a>
            <span>Built for indie hackers</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App

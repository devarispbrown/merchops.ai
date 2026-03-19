'use client'

import {
  Menu,
  X,
  ShoppingBag,
  Users,
  Shield,
  Zap,
  CheckCircle,
  ArrowRight,
  Inbox,
  Link2,
  Clock,
  Target,
  Package,
  Mail,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { CampaignCard } from '../CampaignCard'
import { DraftEditorMock } from '../DraftEditorMock'
import { FAQItem } from '../FAQItem'
import { FadeInUp } from '../FadeInUp'
import { OutcomeMock } from '../OutcomeMock'
import { PricingCard } from '../PricingCard'

export function LandingPage() {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
      })
    }
    setMobileMenuOpen(false)
  }

  const navigateToSignup = () => {
    router.push('/signup?returnTo=/app')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-gray-900">
                MerchOps<span className="text-teal-500">.ai</span>
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                How it works
              </button>
              <button
                onClick={() => scrollToSection('who-its-for')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Who it&apos;s for
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Pricing
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                FAQ
              </button>
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Log in
              </Link>
              <button
                onClick={navigateToSignup}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 transition-colors"
              >
                Start free trial
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100">
              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 py-2"
                >
                  How it works
                </button>
                <button
                  onClick={() => scrollToSection('who-its-for')}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 py-2"
                >
                  Who it&apos;s for
                </button>
                <button
                  onClick={() => scrollToSection('pricing')}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 py-2"
                >
                  Pricing
                </button>
                <button
                  onClick={() => scrollToSection('faq')}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 py-2"
                >
                  FAQ
                </button>
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 py-2"
                >
                  Log in
                </Link>
                <button
                  onClick={navigateToSignup}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 transition-colors"
                >
                  Start free trial
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-16 md:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                Campaigns ready to send.
                <br />
                <span className="text-teal-500">Not another dashboard.</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                MerchOps turns your Shopify data into Klaviyo campaign drafts
                — winback, discovery, and restock — ready to review and send.
                You approve. It schedules.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                  onClick={navigateToSignup}
                  className="px-6 py-3 text-base font-medium text-white bg-teal-500 rounded-xl hover:bg-teal-600 transition-colors"
                >
                  Start free trial
                </button>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="px-6 py-3 text-base font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  See how it works
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-8">
                Draft-first by default. Nothing sends without your approval.
              </p>

              <div className="space-y-3">
                {[
                  "Product picks customers haven't bought yet",
                  'Inventory-aware, margin-safe recommendations',
                  'On-brand copy that sounds like you',
                ].map((bullet, index) => (
                  <div
                    key={index}
                    className="flex items-center text-sm text-gray-600"
                  >
                    <CheckCircle className="w-5 h-5 text-teal-500 mr-3 flex-shrink-0" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Campaign Inbox Mock */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Inbox className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-900">
                    Campaign Inbox
                  </span>
                </div>
                <span className="text-xs text-gray-500">3 ready to send</span>
              </div>

              <div className="space-y-4">
                <CampaignCard
                  type="Winback"
                  title="90-day lapsers"
                  confidence="Green"
                  audienceSize="2,184"
                  offer="Free shipping over $75"
                  why="They've purchased before. They're drifting."
                  products={[
                    { name: '$42', color: 'rose' },
                    { name: '$28', color: 'amber' },
                    { name: '$65', color: 'orange' },
                  ]}
                />
                <CampaignCard
                  type="Product discovery"
                  title="New picks"
                  confidence="Green"
                  audienceSize="1,420"
                  why="Excludes what they already bought."
                  products={[
                    { name: 'Oak', color: 'sky' },
                    { name: 'Ivy', color: 'violet' },
                    { name: 'Elm', color: 'emerald' },
                  ]}
                />
                <CampaignCard
                  type="Restock spotlight"
                  title="Back in stock"
                  confidence="Yellow"
                  audienceSize="860"
                  why="High intent customers + inventory is healthy."
                  showDraftOnly
                  products={[
                    { name: '$38', color: 'slate' },
                    { name: '$54', color: 'stone' },
                    { name: '$71', color: 'zinc' },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 md:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <FadeInUp>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
              The tools aren&apos;t the problem.
              <br />
              <span className="text-gray-500">Execution is.</span>
            </h2>
          </FadeInUp>

          <div className="space-y-6 text-gray-600 leading-relaxed">
            <p>
              You already have Shopify Email or Klaviyo. They&apos;re fine. You don&apos;t
              need more features.
            </p>

            <p>You need the weekly decisions handled:</p>

            <ul className="space-y-2">
              {[
                'What should I send this week?',
                'Who should get it?',
                'Which products?',
                "What offer won't kill margin?",
                'How do I stay on brand?',
              ].map((item, index) => (
                <li key={index} className="inline-flex items-center justify-center w-full">
                  <span className="text-gray-400 mr-2">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xl font-semibold text-gray-900 mt-8">
            Blank calendar = lost revenue.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="py-16 md:py-20 px-4 sm:px-6 bg-white"
      >
        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
              Connect. Review. Send.
            </h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              Get your first campaign drafts within 24 hours of connecting your
              store.
            </p>
          </FadeInUp>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Connect Shopify',
                description:
                  'One-click OAuth. MerchOps reads your catalog, orders, and customer history. Setup takes 5 minutes.',
                icon: ShoppingBag,
                delay: 0,
              },
              {
                step: '2',
                title: 'Get your campaign inbox',
                description:
                  'Within 24 hours, see your first drafts: winback, discovery, restocks, and promos tailored to your store.',
                icon: Inbox,
                delay: 150,
              },
              {
                step: '3',
                title: 'Approve and send',
                description:
                  'Review each campaign, tweak if needed, then push directly to Klaviyo as a draft — or export to Shopify Email.',
                icon: Zap,
                delay: 300,
              },
            ].map((item) => (
              <FadeInUp key={item.step} delay={item.delay}>
              <div
                className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100 hover:border-teal-200 transition-colors duration-200"
              >
                <div className="w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center text-xl font-bold mx-auto mb-6">
                  {item.step}
                </div>
                <item.icon className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
              </FadeInUp>
            ))}
          </div>

          <FadeInUp>
          <div className="mt-12 bg-teal-50 rounded-2xl p-8 border border-teal-100">
            <h4 className="font-semibold text-gray-900 text-lg text-center mb-8">
              What to expect in your first 30 days
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { week: 'Week 1', text: 'First campaign drafts arrive', accent: false },
                { week: 'Weeks 2–3', text: 'Refine your voice and preferences', accent: false },
                { week: 'Week 4', text: 'Consistent campaign flow, 2–5x per week', accent: false },
                { week: 'Milestone', text: 'Autopilot available when you\u2019re ready', accent: true },
              ].map((item) => (
                <div key={item.week} className="text-center">
                  <span className={`inline-block text-xs font-semibold uppercase tracking-wide mb-2 ${item.accent ? 'text-teal-700' : 'text-teal-600'}`}>
                    {item.week}
                  </span>
                  <p className="text-sm text-gray-700 font-medium leading-snug">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
          </FadeInUp>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <FadeInUp>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
              MerchOps runs the campaign decisions for you.
            </h2>
          </FadeInUp>

          <div className="space-y-8">
            {/* Card 1: What it feels like + One click to send */}
            <div className="bg-teal-50 rounded-2xl p-8 border border-teal-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                What it feels like
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                It&apos;s like having a retention merchandiser who shows up every day
                with:
              </p>
              <ul className="space-y-2 mb-6">
                {[
                  'A clear campaign idea',
                  'The right audience',
                  'The right products',
                  'Ready-to-send creative',
                ].map((item, index) => (
                  <li key={index} className="flex items-center text-gray-600">
                    <ArrowRight className="w-4 h-4 text-teal-500 mr-2" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="border-t border-teal-200 pt-6">
                <p className="text-gray-700 leading-relaxed">
                  You approve in one click. MerchOps schedules through your
                  existing tools.
                </p>
              </div>
            </div>

            {/* Card 2: What you see */}
            <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                What you see
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Every draft includes:
              </p>
              <ul className="space-y-2 mb-6">
                {[
                  'Audience size',
                  'Product picks + alternates',
                  'Confidence score',
                  '"Why this campaign" explanation',
                ].map((item, index) => (
                  <li key={index} className="flex items-center text-gray-600">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2" />
                    {item}
                  </li>
                ))}
              </ul>
              <DraftEditorMock />
            </div>
          </div>
        </div>
      </section>

      {/* ROI + Track What Works — merged section */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
              Time back. Revenue forward.
            </h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              MerchOps handles the decision work so you can spend your time on
              what only you can do.
            </p>
          </FadeInUp>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                metric: '2\u20135 hrs',
                description: 'saved per week on campaign planning',
              },
              {
                metric: '3\u20135x',
                description: 'more campaigns sent vs. manual',
              },
              {
                metric: '<60 sec',
                description: 'from opportunity to ready-to-send draft',
              },
              {
                metric: '100%',
                description: 'of campaigns include why-now reasoning',
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center"
              >
                <p className="text-3xl font-bold text-teal-500 mb-2">
                  {item.metric}
                </p>
                <p className="text-sm text-gray-600 leading-snug">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 text-center mt-6 mb-12">
            Based on typical store activity during beta testing period
          </p>

          <div className="border-t border-gray-100 pt-12">
            <div className="max-w-3xl mx-auto">
              <FadeInUp>
                <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                  Track what works.
                </h3>
                <p className="text-gray-600 max-w-xl mx-auto text-center mb-10">
                  Every campaign you approve builds a track record. MerchOps shows
                  you what landed, what missed, and why — so each draft gets better
                  than the last.
                </p>
              </FadeInUp>
              <OutcomeMock />
            </div>
          </div>
        </div>
      </section>

      {/* Who This Is For - NEW SECTION */}
      <section id="who-its-for" className="py-16 md:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
              Is MerchOps right for you?
            </h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              MerchOps works best for established Shopify stores ready to send
              consistent campaigns.
            </p>
          </FadeInUp>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Good Fit */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Great fit
                </h3>
              </div>
              <ul className="space-y-4">
                {[
                  {
                    icon: Users,
                    text: '500+ customers in your list',
                  },
                  {
                    icon: Package,
                    text: '50+ SKUs in your catalog',
                  },
                  {
                    icon: Mail,
                    text: 'Want to send 2-5 campaigns per week',
                  },
                  {
                    icon: Target,
                    text: 'Using Shopify Email or Klaviyo',
                  },
                ].map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-sm text-gray-600"
                  >
                    <item.icon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Not Yet */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Not yet</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'Just launched with <100 customers',
                  'Single product or very small catalog',
                  'Not ready to send regular emails',
                  'Need full email platform (we integrate, not replace)',
                ].map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-sm text-gray-500"
                  >
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full mt-2 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Details - NEW SECTION */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
              Works with your existing tools.
            </h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              MerchOps doesn&apos;t replace Shopify Email or Klaviyo. It makes them
              easier to use.
            </p>
          </FadeInUp>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Klaviyo */}
            <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Klaviyo
                  </h3>
                  <p className="text-sm text-gray-500">Full API integration</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'Push campaign drafts directly to Klaviyo',
                  'Auto-create segments and sync customer lists',
                  'Trigger your existing Klaviyo flows from opportunities',
                  'Frequency cap coordination across campaigns',
                  'Respects your suppression and unsubscribe lists',
                ].map((item, index) => (
                  <li
                    key={index}
                    className="flex items-center text-sm text-gray-600"
                  >
                    <CheckCircle className="w-4 h-4 text-purple-500 mr-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Shopify Email */}
            <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Shopify Email
                  </h3>
                  <p className="text-sm text-gray-500">Native integration</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'Create email drafts directly in Shopify Email',
                  'Audience segments sync automatically',
                  'Products pull from your catalog',
                  'Review and send from Shopify admin',
                ].map((item, index) => (
                  <li
                    key={index}
                    className="flex items-center text-sm text-gray-600"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 bg-amber-50 rounded-xl p-6 border border-amber-100">
            <div className="flex items-start gap-4">
              <Link2 className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">
                  No migration required
                </h4>
                <p className="text-sm text-gray-600">
                  Your deliverability stays intact. MerchOps pushes campaigns
                  through your existing sender reputation. No new domains, no
                  warmup period.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-slate-50 rounded-xl p-6 border border-slate-200">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-slate-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">
                  Your data stays safe
                </h4>
                <p className="text-sm text-gray-600">
                  MerchOps uses read-only Shopify access with minimal scopes. Your data is encrypted at rest, never shared, and fully deleted if you cancel. We never store payment information.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust + Guardrails Section - SIMPLIFIED */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <FadeInUp>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Safe by default.
              <br />
              <span className="text-teal-500">Calm by design.</span>
            </h2>
          </FadeInUp>

          <p className="text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
            MerchOps starts in draft-only mode. You control frequency, tone, and
            discount rules. No spam. No weird voice. No surprises.
          </p>

          <div className="grid sm:grid-cols-3 gap-6 mb-8">
            {[
              {
                title: 'Draft-only by default',
                description: 'Nothing sends without your explicit approval',
              },
              {
                title: 'You set the frequency',
                description: 'Choose 2x, 3x, or 5x per week',
              },
              {
                title: 'Your voice, your rules',
                description: 'Minimal, warm, playful, or luxury tone',
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-gray-50 rounded-xl p-6 border border-gray-100"
              >
                <h4 className="font-semibold text-gray-900 mb-2">
                  {item.title}
                </h4>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>

          <p className="text-lg font-semibold text-gray-900">
            Pause everything anytime. No questions asked.
          </p>
        </div>
      </section>

      {/* Pricing Section - WITH REVENUE BANDS */}
      <section id="pricing" className="py-16 md:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Pricing that scales with your store.
              </h2>
              <p className="text-gray-600 mb-2">
                Start with a 14-day free trial. No credit card required.
              </p>
              <p className="text-sm text-amber-600 font-medium">
                Beta pricing ends soon — lock in 50% off for your first 3 months
              </p>
            </div>
          </FadeInUp>

          <div className="grid md:grid-cols-3 gap-8">
            <FadeInUp delay={0}>
              <PricingCard
                name="Starter"
                price="$49"
                betaPrice="$25"
                subtitle="Best for stores under $50K/mo"
                features={[
                  'Up to 3 campaign drafts per week',
                  'Draft-only mode',
                  'Shopify Email export',
                  'Email support',
                ]}
                ctaText="Start free trial"
                urgencyNote="Limited beta spots available"
                roiAnchor="One recovered customer pays for itself"
              />
            </FadeInUp>
            <FadeInUp delay={100}>
              <PricingCard
                name="Growth"
                price="$149"
                betaPrice="$75"
                subtitle="Best for stores $50K-$500K/mo"
                features={[
                  'Daily campaign inbox (up to 5/week)',
                  'Shopify Email + Klaviyo',
                  'Inventory + margin guardrails',
                  'Priority support',
                  'Voice customization',
                ]}
                highlighted
                ctaText="Start free trial"
                urgencyNote="Limited beta spots available"
                roiAnchor="Less than one hour of agency time per month"
              />
            </FadeInUp>
            <FadeInUp delay={200}>
              <PricingCard
                name="Pro"
                price="$399"
                betaPrice="$200"
                subtitle="Best for stores $500K+/mo"
                features={[
                  'Everything in Growth',
                  'Autopilot scheduling',
                  'Advanced cohorts + A/B testing',
                  'Dedicated onboarding',
                  'Custom integrations',
                ]}
                ctaText="Start free trial"
                urgencyNote="Limited beta spots available"
                roiAnchor="Replaces $2,000+/mo in retention marketing labor"
              />
            </FadeInUp>
          </div>

        </div>
      </section>

      {/* FAQ Section - UPDATED */}
      <section id="faq" className="py-16 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <FadeInUp>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
              FAQ
            </h2>
          </FadeInUp>

          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6 md:p-8">
            <FAQItem
              question="Does MerchOps replace Shopify Email or Klaviyo?"
              answer="No. MerchOps drafts campaigns and pushes them into the tools you already use. Your deliverability, templates, and sender reputation stay intact."
            />
            <FAQItem
              question="How long until I see my first campaign drafts?"
              answer="Within 24 hours of connecting your Shopify store. Setup takes about 5 minutes, then MerchOps analyzes your catalog and customer history to generate your first drafts."
            />
            <FAQItem
              question="Will it spam my customers?"
              answer="No. Frequency caps and exclusions are built in. Draft-only is the default—nothing sends without your approval. You control exactly how often campaigns go out."
            />
            <FAQItem
              question="Will it sound like AI?"
              answer="MerchOps generates copy in your chosen tone — minimal, warm, playful, or luxury — and you can refine every draft before sending. Over time, your edits help improve future suggestions."
            />
            <FAQItem
              question="What if it doesn't work for my store?"
              answer="Start with a 14-day free trial, no credit card required. If MerchOps isn't a fit, cancel anytime—no questions asked, no long-term commitment."
            />
            <FAQItem
              question="Can I control discounts and which products get featured?"
              answer='Yes. Set discount ceilings, mark products as "never discount," and exclude specific items or collections. MerchOps respects your rules on every campaign.'
            />
            <FAQItem
              question="How does MerchOps work with my existing Klaviyo flows?"
              answer="MerchOps coordinates with Klaviyo in three ways: it creates campaign drafts directly in Klaviyo with AI-generated copy matched to your brand voice, it can trigger your existing flows by enrolling the right customer profiles, and it checks frequency caps so customers aren't double-emailed. Your suppression lists and unsubscribes are always respected."
            />
            <FAQItem
              question="Can MerchOps create segments in Klaviyo?"
              answer="Yes. When MerchOps detects an opportunity — like a win-back cohort of customers dormant for 60+ days — it automatically creates a synced list in Klaviyo with those profiles. You can use these lists in your own campaigns and flows too."
            />
            <FAQItem
              question="Can MerchOps trigger my existing Klaviyo flows?"
              answer="Yes. Instead of creating a new campaign, you can choose to trigger an existing Klaviyo flow from any MerchOps opportunity. MerchOps creates the events that your flow listens for, enrolling the right customer profiles automatically."
            />
            <FAQItem
              question="What data does MerchOps access, and is it secure?"
              answer="MerchOps uses read-only Shopify OAuth with minimal scopes to read your catalog, orders, and customer history. All data is encrypted at rest and in transit. We never store payment information or share your data. If you cancel, your data is fully deleted within 30 days."
            />
          </div>
        </div>
      </section>

      {/* Final CTA Section - WITH RISK REVERSAL */}
      <section id="cta" className="py-16 md:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <FadeInUp>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Stop staring at a blank campaign calendar.
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Connect your store. Get campaigns ready to send. Stay on brand.
            </p>
          </FadeInUp>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={navigateToSignup}
              className="px-8 py-4 text-base font-medium text-white bg-teal-500 rounded-xl hover:bg-teal-600 transition-colors"
            >
              Start your free trial
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="px-8 py-4 text-base font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              See how it works
            </button>
          </div>

          {/* Risk Reversal */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 max-w-md mx-auto">
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-500" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-500" />
                <span>Cancel anytime, no questions asked</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            Draft-first by default. Nothing sends without your approval.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-xl font-bold text-gray-900">
              MerchOps<span className="text-teal-500">.ai</span>
            </span>

            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-700">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-700">
                Terms
              </Link>
              <a href="mailto:hello@merchops.ai" className="text-sm text-gray-500 hover:text-gray-700">
                Contact
              </a>
            </div>

            <p className="text-sm text-gray-400">© 2026 MerchOps.ai</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

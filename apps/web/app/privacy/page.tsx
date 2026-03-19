import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link href="/" className="text-xl font-bold text-gray-900">
            MerchOps<span className="text-teal-500">.ai</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        <p className="text-gray-600 leading-relaxed mb-12">
          Our privacy policy is being finalized and will be available before public launch. For
          questions, contact{' '}
          <a
            href="mailto:hello@merchops.ai"
            className="text-teal-600 hover:text-teal-700 underline"
          >
            hello@merchops.ai
          </a>
          .
        </p>

        <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          &larr; Back to home
        </Link>
      </main>
    </div>
  )
}

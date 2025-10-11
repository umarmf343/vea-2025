import Head from "next/head"
import Link from "next/link"

export default function Custom500() {
  return (
    <>
      <Head>
        <title>Server error | VEA Portal</title>
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">Internal server error</h1>
          <p className="text-gray-600">
            We encountered a problem while loading this page. Please try again or return to the dashboard.
          </p>
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </>
  )
}

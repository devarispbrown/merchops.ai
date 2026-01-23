import { redirect } from 'next/navigation'

import { LandingPage } from '@/components/marketing/pages/LandingPage'
import { auth } from '@/server/auth'

export default async function HomePage() {
  const session = await auth()

  if (session?.user) {
    redirect('/queue')
  }

  return <LandingPage />
}

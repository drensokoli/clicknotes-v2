import Link from "next/link"
import Image from "next/image"

import { LoginForm } from "@/components/login-form"

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <Image 
            src="/logo-blue.png" 
            alt="ClickNotes" 
            width={100} 
            height={100} 
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzNBM0E0NCIvPgo8L3N2Zz4="
          />
        </Link>
        <LoginForm />
      </div>
    </div>
  )
}

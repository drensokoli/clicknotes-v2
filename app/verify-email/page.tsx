"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = 'force-dynamic'

function VerifyEmailContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [token, setToken] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()

  const verifyEmail = useCallback(async (verificationToken: string) => {
    setIsLoading(true)
    setError("")
    setMessage("")

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: verificationToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify email")
      }

      setMessage("Email verified successfully! Redirecting to login...")
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    const tokenParam = searchParams.get("token")
    if (!tokenParam) {
      setError("Invalid verification link.")
      return
    }
    setToken(tokenParam)
    verifyEmail(tokenParam)
  }, [searchParams, verifyEmail])

  const resendVerification = async () => {
    setIsLoading(true)
    setError("")
    setMessage("")

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend verification")
      }

      setMessage("Verification email sent! Check your inbox.")
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

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
        
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Verify Email</CardTitle>
            <CardDescription>
              {isLoading ? "Verifying your email..." : "Email verification"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              {error && (
                <div className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
              
              {message && (
                <div className="text-sm text-center">
                  {message}
                </div>
              )}
              
              {error && !message && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    The verification link may have expired or is invalid.
                  </p>
                  <Button 
                    onClick={resendVerification} 
                    disabled={isLoading}
                    className="w-full hover:cursor-pointer"
                  >
                    {isLoading ? "Sending..." : "Resend Verification Email"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="text-center">
          <Link 
            href="/login" 
            className="text-primary hover:underline underline-offset-4"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
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
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}

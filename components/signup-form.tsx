"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { validateSignup, validatePassword } from "@/lib/validation"
import { PasswordStrengthIndicator } from "@/components/password-strength-indicator"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const router = useRouter()

  // Real-time password strength calculation
  useEffect(() => {
    if (password) {
      const validation = validatePassword(password)
      setPasswordStrength(validation.strength)
    }
  }, [password])

  // Mark field as touched when user interacts with it
  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }))
  }

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setFieldErrors({})

    // Comprehensive validation
    const validation = validateSignup({ name, email, password, confirmPassword })
    
    if (!validation.isValid) {
      setFieldErrors(validation.errors)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account")
      }

      // Redirect to verification pending page
      router.push(`/verification-pending?email=${encodeURIComponent(email)}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setIsLoading(true)
    try {
      await signIn("google", { callbackUrl: "/" })
    } catch {
      setError("An error occurred with Google sign-in.")
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>
            Sign up for ClickNotes to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSignup}>
            <div className="grid gap-6">
              <div className="flex flex-col gap-4">
                <Button 
                  type="button"
                  variant="outline" 
                  className="w-full"
                  onClick={handleGoogleSignup}
                  disabled={isLoading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 mr-2">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  Continue with Google
                </Button>
              </div>
              <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                <span className="bg-surface text-muted-foreground relative z-10 px-2">
                  Or continue with
                </span>
              </div>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => handleFieldBlur('name')}
                    required
                    disabled={isLoading}
                    className={touched.name && fieldErrors.name ? "border-red-500" : ""}
                  />
                                       {touched.name && fieldErrors.name && (
                       <p className="text-sm" style={{ color: 'var(--error-color)' }}>{fieldErrors.name}</p>
                     )}
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                    required
                    disabled={isLoading}
                    className={touched.email && fieldErrors.email ? "border-red-500" : ""}
                  />
                  {touched.email && fieldErrors.email && (
                    <p className="text-sm text-red-700 dark:text-red-400">{fieldErrors.email}</p>
                  )}
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput 
                    id="password" 
                    value={password}
                    placeholder="••••••••••••"
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => handleFieldBlur('password')}
                    required 
                    disabled={isLoading}
                    className={touched.password && fieldErrors.password ? "border-red-500" : ""}
                  />
                  {password && <PasswordStrengthIndicator strength={passwordStrength} />}
                  {touched.password && fieldErrors.password && (
                    <p className="text-sm text-red-700 dark:text-red-400">{fieldErrors.password}</p>
                  )}
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <PasswordInput 
                    id="confirmPassword" 
                    value={confirmPassword}
                    placeholder="••••••••••••"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => handleFieldBlur('confirmPassword')}
                    required 
                    disabled={isLoading}
                    className={touched.confirmPassword && fieldErrors.confirmPassword ? "border-red-500" : ""}
                  />
                  {touched.confirmPassword && fieldErrors.confirmPassword && (
                    <p className="text-sm text-red-700 dark:text-red-400">{fieldErrors.confirmPassword}</p>
                  )}
                </div>
                                     {error && (
                       <div className="text-sm text-center" style={{ color: 'var(--error-color)' }}>
                         {error}
                       </div>
                     )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
              </div>
              <div className="text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="underline underline-offset-4">
                  Sign in
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  )
}

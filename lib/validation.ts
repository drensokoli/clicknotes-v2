// Email validation using industry-standard regex
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email) {
    return { isValid: false, error: "Email is required" }
  }

  // Industry-standard email regex (RFC 5322 compliant)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Please enter a valid email address" }
  }

  // Check for common disposable email domains
  const disposableDomains = [
    'tempmail.org', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
    'yopmail.com', 'throwaway.email', 'temp-mail.org', 'sharklasers.com'
  ]
  
  const domain = email.split('@')[1]?.toLowerCase()
  if (disposableDomains.includes(domain)) {
    return { isValid: false, error: "Please use a valid email address (disposable emails not allowed)" }
  }

  // Check email length
  if (email.length > 254) {
    return { isValid: false, error: "Email address is too long" }
  }

  return { isValid: true }
}

// Comprehensive password validation
export function validatePassword(password: string): { isValid: boolean; errors: string[]; strength: 'weak' | 'medium' | 'strong' } {
  const errors: string[] = []
  let score = 0

  // Length requirements
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long")
  } else if (password.length >= 12) {
    score += 2
  } else {
    score += 1
  }

  // Character variety requirements
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  } else {
    score += 1
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  } else {
    score += 1
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number")
  } else {
    score += 1
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character")
  } else {
    score += 1
  }

  // Security checks
  if (password.length > 128) {
    errors.push("Password is too long (maximum 128 characters)")
  }

  // Check for common weak patterns
  const weakPatterns = [
    /123456/, /password/, /qwerty/, /abc123/, /letmein/,
    /admin/, /welcome/, /monkey/, /dragon/, /master/
  ]
  
  if (weakPatterns.some(pattern => pattern.test(password.toLowerCase()))) {
    errors.push("Password contains common weak patterns")
    score -= 1
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push("Password contains too many repeated characters")
    score -= 1
  }

  // Check for sequential characters
  if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) {
    errors.push("Password contains sequential characters")
    score -= 1
  }

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak'
  if (score >= 5 && errors.length === 0) {
    strength = 'strong'
  } else if (score >= 3 && errors.length <= 2) {
    strength = 'medium'
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength
  }
}

// Name validation
export function validateName(name: string): { isValid: boolean; error?: string } {
  if (!name) {
    return { isValid: false, error: "Name is required" }
  }

  if (name.trim().length < 2) {
    return { isValid: false, error: "Name must be at least 2 characters long" }
  }

  if (name.length > 50) {
    return { isValid: false, error: "Name is too long (maximum 50 characters)" }
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  if (!/^[a-zA-Z\s\-']+$/.test(name)) {
    return { isValid: false, error: "Name can only contain letters, spaces, hyphens, and apostrophes" }
  }

  return { isValid: true }
}

// Password confirmation validation
export function validatePasswordConfirmation(password: string, confirmPassword: string): { isValid: boolean; error?: string } {
  if (!confirmPassword) {
    return { isValid: false, error: "Please confirm your password" }
  }

  if (password !== confirmPassword) {
    return { isValid: false, error: "Passwords do not match" }
  }

  return { isValid: true }
}

// Comprehensive signup validation
export function validateSignup(data: {
  name: string
  email: string
  password: string
  confirmPassword: string
}): {
  isValid: boolean
  errors: Record<string, string>
  passwordStrength: 'weak' | 'medium' | 'strong'
} {
  const errors: Record<string, string> = {}
  
  // Validate name
  const nameValidation = validateName(data.name)
  if (!nameValidation.isValid) {
    errors.name = nameValidation.error!
  }

  // Validate email
  const emailValidation = validateEmail(data.email)
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error!
  }

  // Validate password
  const passwordValidation = validatePassword(data.password)
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.errors.join('. ')
  }

  // Validate password confirmation
  const confirmValidation = validatePasswordConfirmation(data.password, data.confirmPassword)
  if (!confirmValidation.isValid) {
    errors.confirmPassword = confirmValidation.error!
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    passwordStrength: passwordValidation.strength
  }
}

// Password strength indicator
export function getPasswordStrengthColor(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak':
      return 'text-red-500'
    case 'medium':
      return 'text-yellow-500'
    case 'strong':
      return 'text-green-500'
    default:
      return 'text-gray-500'
  }
}

export function getPasswordStrengthText(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak':
      return 'Weak'
    case 'medium':
      return 'Medium'
    case 'strong':
      return 'Strong'
    default:
      return 'Unknown'
  }
}

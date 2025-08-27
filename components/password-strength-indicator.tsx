"use client"

import { getPasswordStrengthColor, getPasswordStrengthText } from "@/lib/validation"

interface PasswordStrengthIndicatorProps {
  strength: 'weak' | 'medium' | 'strong'
  showText?: boolean
}

export function PasswordStrengthIndicator({ strength, showText = true }: PasswordStrengthIndicatorProps) {
  const getStrengthWidth = () => {
    switch (strength) {
      case 'weak':
        return 'w-1/3'
      case 'medium':
        return 'w-2/3'
      case 'strong':
        return 'w-full'
      default:
        return 'w-0'
    }
  }

  const getStrengthBgColor = () => {
    switch (strength) {
      case 'weak':
        return 'bg-red-600'
      case 'medium':
        return 'bg-amber-500'
      case 'strong':
        return 'bg-emerald-600'
      default:
        return 'bg-gray-300'
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Password strength</span>
        {showText && (
          <span className={`text-sm font-medium ${getPasswordStrengthColor(strength)}`}>
            {getPasswordStrengthText(strength)}
          </span>
        )}
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${getStrengthBgColor()} ${getStrengthWidth()}`}
        />
      </div>
      
      <div className="text-xs text-muted-foreground">
        {strength === 'weak' && 'Add more characters and variety'}
        {strength === 'medium' && 'Good, but could be stronger'}
        {strength === 'strong' && 'Excellent password strength!'}
      </div>
    </div>
  )
}

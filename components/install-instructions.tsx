"use client"

import { X, Share, Plus, Smartphone, Monitor } from "lucide-react"

interface InstallInstructionsProps {
  isVisible: boolean
  onClose: () => void
  deviceType: 'ios' | 'android' | 'other'
}

export function InstallInstructions({ isVisible, onClose, deviceType }: InstallInstructionsProps) {
  if (!isVisible) return null

  const getDeviceInstructions = () => {
    switch (deviceType) {
      case 'ios':
        return {
          title: "Install ClickNotes on iPhone/iPad",
          steps: [
            {
              icon: Share,
              title: "1. Tap the Share button",
              description: "Look for the share icon (📤) in your browser's toolbar at the bottom"
            },
            {
              icon: Plus,
              title: "2. Tap 'Add to Home Screen'",
              description: "This will install ClickNotes on your device for easy access"
            }
          ]
        }
      case 'android':
        return {
          title: "Install ClickNotes on Android",
          steps: [
            {
              icon: Share,
              title: "1. Tap the Menu button (⋮)",
              description: "Look for the three dots menu in your browser's toolbar"
            },
            {
              icon: Plus,
              title: "2. Tap 'Add to Home screen'",
              description: "This will install ClickNotes on your device"
            }
          ]
        }
      default:
        return {
          title: "Install ClickNotes",
          steps: [
            {
              icon: Monitor,
              title: "1. Look for Install option",
              description: "Check your browser's menu or address bar for an install option"
            },
            {
              icon: Smartphone,
              title: "2. Follow browser prompts",
              description: "Your browser will guide you through the installation process"
            }
          ]
        }
    }
  }

  const instructions = getDeviceInstructions()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-center flex-1">{instructions.title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors -mr-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-6">
          <p className="text-muted-foreground text-center text-sm leading-relaxed">
            To install ClickNotes on your device, follow these steps:
          </p>
          
          <div className="space-y-4">
            {instructions.steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={index} className="flex items-start gap-4">
                  <div className="bg-primary/10 text-primary rounded-full p-3 flex-shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          
          <div className="pt-4">
            <button
              onClick={onClose}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-xl font-semibold hover:bg-primary/90 transition-colors text-sm"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

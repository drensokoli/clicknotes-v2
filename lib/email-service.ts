import nodemailer from 'nodemailer'

// Email service configuration
export interface EmailConfig {
  provider: 'sendgrid' | 'resend' | 'smtp' | 'gmail'
  apiKey?: string
  fromEmail: string
  fromName: string
  // SMTP specific settings
  host?: string
  port?: number
  secure?: boolean
  user?: string
  password?: string
}

// Create transporter based on provider
export function createTransporter(config: EmailConfig) {
  switch (config.provider) {
    case 'sendgrid':
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: config.apiKey
        }
      })

    case 'resend':
      return nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 587,
        secure: false,
        auth: {
          user: 'resend',
          pass: config.apiKey
        },
        // Add connection timeout and greeting timeout
        connectionTimeout: 60000,
        greetingTimeout: 30000
      })

    case 'gmail':
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.user,
          pass: config.password
        }
      })

    case 'smtp':
      return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.password
        }
      })

    default:
      throw new Error(`Unsupported email provider: ${config.provider}`)
  }
}

// Email templates
export const emailTemplates = {
  passwordReset: (resetLink: string, userName: string) => ({
    subject: 'Reset Your ClickNotes Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Reset Your Password</h2>
        <p>Hi ${userName},</p>
        <p>You requested a password reset for your ClickNotes account.</p>
        <p>Click the button below to reset your password:</p>
        <a href="${resetLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        <p>Best regards,<br>The ClickNotes Team</p>
      </div>
    `,
    text: `
      Reset Your Password
      
      Hi ${userName},
      
      You requested a password reset for your ClickNotes account.
      
      Click this link to reset your password: ${resetLink}
      
      This link will expire in 1 hour.
      
      If you didn't request this reset, please ignore this email.
      
      Best regards,
      The ClickNotes Team
    `
  }),

  v2Launch: (userName: string, appUrl: string) => ({
    subject: 'ClickNotes v2 is here',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #2563eb;">ClickNotes v2 is here</h2>
        <p>Hi ${userName},</p>
        <p>We've just launched a new version of ClickNotes, and your library is already waiting for you - no setup needed.</p>
        <p>What's new:</p>
        <ul style="padding-left: 20px; line-height: 1.7;">
          <li><strong>No more Notion required.</strong> Your movies, TV series, and books now live directly in ClickNotes - just sign in and everything is there.</li>
          <li><strong>A real Library page.</strong> Browse everything you've saved, filter by type, status, genre, or era, and search your whole collection instantly.</li>
          <li><strong>Shuffle.</strong> Not sure what to watch or read next? Shuffle picks something for you from your saved list, using whatever filters you choose.</li>
          <li><strong>Faster browsing.</strong> Discover popular movies, series, and books with instant search and infinite scroll.</li>
        </ul>
        <p>Everything you had saved has already been carried over automatically.</p>
        <a href="${appUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Try ClickNotes v2</a>
        <p>Thanks for being an early ClickNotes user - we hope you enjoy the new version.</p>
        <p>Best regards,<br>The ClickNotes Team</p>
      </div>
    `,
    text: `
      ClickNotes v2 is here

      Hi ${userName},

      We've just launched a new version of ClickNotes, and your library is already waiting for you - no setup needed.

      What's new:
      - No more Notion required. Your movies, TV series, and books now live directly in ClickNotes - just sign in and everything is there.
      - A real Library page. Browse everything you've saved, filter by type, status, genre, or era, and search your whole collection instantly.
      - Shuffle. Not sure what to watch or read next? Shuffle picks something for you from your saved list, using whatever filters you choose.
      - Faster browsing. Discover popular movies, series, and books with instant search and infinite scroll.

      Everything you had saved has already been carried over automatically.

      Try it now: ${appUrl}

      Thanks for being an early ClickNotes user - we hope you enjoy the new version.

      Best regards,
      The ClickNotes Team
    `
  }),

  emailVerification: (verificationLink: string, userName: string) => ({
    subject: 'Verify Your ClickNotes Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Verify Your Email</h2>
        <p>Hi ${userName},</p>
        <p>Welcome to ClickNotes! Please verify your email address to complete your account setup.</p>
        <p>Click the button below to verify your email:</p>
        <a href="${verificationLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create this account, please ignore this email.</p>
        <p>Best regards,<br>The ClickNotes Team</p>
      </div>
    `,
    text: `
      Verify Your Email
      
      Hi ${userName},
      
      Welcome to ClickNotes! Please verify your email address to complete your account setup.
      
      Click this link to verify your email: ${verificationLink}
      
      This link will expire in 24 hours.
      
      If you didn't create this account, please ignore this email.
      
      Best regards,
      The ClickNotes Team
    `
  })
}

// Send email function
export async function sendEmail(
  config: EmailConfig,
  to: string,
  subject: string,
  html: string,
  text?: string
) {
  try {
    const transporter = createTransporter(config)
    
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
    }

    console.log('Attempting to send email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      provider: config.provider,
      host: config.provider === 'resend' ? 'smtp.resend.com' : 'custom'
    })

    const result = await transporter.sendMail(mailOptions)
    console.log('Email sent successfully:', result.messageId)
    return result
  } catch (error) {
    console.error('Failed to send email:', error)
    console.error('Email config used:', config)
    throw error
  }
}

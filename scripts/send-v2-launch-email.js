#!/usr/bin/env node

// One-time announcement: emails every ClickNotes user to let them know v2 has
// launched. Recipients are every user with an email in v2's `users` collection
// (the live app's own user list - already 1:1 with the old v1 user base as of
// the Notion migration, see scripts/migrate-notion-to-mongo.js).
//
// Sends via Resend's SMTP relay using the same nodemailer setup as
// lib/email-service.ts (the template text below mirrors emailTemplates.v2Launch
// there - kept inline here since this is a plain script, not compiled TS).
//
// Usage:
//   node scripts/send-v2-launch-email.js               # dry run - lists recipients, sends nothing
//   node scripts/send-v2-launch-email.js --apply        # actually sends
//
// Required env vars: MONGODB_URI, MONGODB_DB_NAME, EMAIL_API_KEY,
// EMAIL_FROM, EMAIL_FROM_NAME (all already in this app's .env)

const { MongoClient } = require('mongodb')
const nodemailer = require('nodemailer')

const APP_URL = 'https://clicknotes.site'
const SEND_DELAY_MS = 400 // stay well under Resend's rate limit

// Test/malformed accounts from dev - never real users, always excluded.
const EXCLUDED_EMAILS = new Set([
  'test@test',
  'test@test.com',
  'ds51318@ubt-uni.ne',
  'ds51318@ubt-unit.net',
  'ds51318@ubt-uni.net',
  'drensokooli@gmail.com',
])

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildEmail(userName) {
  const subject = 'ClickNotes v2 is here'
  const html = `
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
      <a href="${APP_URL}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Try ClickNotes v2</a>
      <p>Thanks for being an early ClickNotes user - we hope you enjoy the new version.</p>
      <p>Best regards,<br>The ClickNotes Team</p>
    </div>
  `
  const text = `ClickNotes v2 is here

Hi ${userName},

We've just launched a new version of ClickNotes, and your library is already waiting for you - no setup needed.

What's new:
- No more Notion required. Your movies, TV series, and books now live directly in ClickNotes - just sign in and everything is there.
- A real Library page. Browse everything you've saved, filter by type, status, genre, or era, and search your whole collection instantly.
- Shuffle. Not sure what to watch or read next? Shuffle picks something for you from your saved list, using whatever filters you choose.
- Faster browsing. Discover popular movies, series, and books with instant search and infinite scroll.

Everything you had saved has already been carried over automatically.

Try it now: ${APP_URL}

Thanks for being an early ClickNotes user - we hope you enjoy the new version.

Best regards,
The ClickNotes Team`

  return { subject, html, text }
}

async function main() {
  const shouldApply = process.argv.includes('--apply')
  console.log(shouldApply ? 'Mode: APPLY (will send real emails)' : 'Mode: DRY RUN (pass --apply to actually send)')
  console.log('')

  const mongoUri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'clicknotes'
  const resendApiKey = process.env.EMAIL_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'noreply@clicknotes.com'
  const fromName = process.env.EMAIL_FROM_NAME || 'ClickNotes'

  if (!mongoUri) {
    console.log('MONGODB_URI not set - aborting')
    return
  }
  if (shouldApply && !resendApiKey) {
    console.log('EMAIL_API_KEY not set - aborting')
    return
  }

  const client = new MongoClient(mongoUri)
  let transporter = null
  if (shouldApply) {
    transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: { user: 'resend', pass: resendApiKey },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
    })
  }

  let sent = 0
  let failed = 0

  const onlyArg = process.argv.find((arg) => arg.startsWith('--to='))
  const onlyEmail = onlyArg ? onlyArg.slice('--to='.length).toLowerCase() : null

  try {
    await client.connect()
    const db = client.db(dbName)
    let users = await db
      .collection('users')
      .find({ email: { $exists: true, $ne: null } })
      .toArray()

    if (onlyEmail) {
      users = users.filter((u) => u.email.toLowerCase() === onlyEmail)
      console.log(`--to filter: sending only to ${onlyEmail}\n`)
    } else {
      const before = users.length
      users = users.filter((u) => !EXCLUDED_EMAILS.has(u.email.toLowerCase()))
      const excluded = before - users.length
      if (excluded > 0) console.log(`Excluded ${excluded} test/malformed account(s)\n`)
    }

    console.log(`Found ${users.length} user(s) to notify\n`)

    for (const user of users) {
      const userName = user.name || 'there'
      const { subject, html, text } = buildEmail(userName)
      console.log(`${shouldApply ? 'Sending' : 'Would send'} to ${user.email} (${userName})`)

      if (shouldApply) {
        try {
          await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: user.email,
            subject,
            html,
            text,
          })
          sent++
        } catch (error) {
          failed++
          console.error(`  Failed to send to ${user.email}:`, error.message)
        }
        await delay(SEND_DELAY_MS)
      }
    }

    console.log('')
    if (shouldApply) {
      console.log(`Sent: ${sent}, Failed: ${failed}`)
    } else {
      console.log(`Dry run - would send to ${users.length} user(s). Pass --apply to actually send.`)
    }
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('Send failed:', error)
  process.exit(1)
})

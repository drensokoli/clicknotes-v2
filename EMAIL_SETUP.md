# Email Service Setup for ClickNotes

This document explains how to configure email services for the forgot password and email verification features.

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Email Service Configuration
# Choose one of the following providers: 'sendgrid', 'resend', 'gmail', 'smtp'
EMAIL_PROVIDER=smtp

# Email Sender Information
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=ClickNotes
```

## Email Provider Options

### 1. SendGrid (Recommended for Production)

```bash
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=your-sendgrid-api-key
```

**Setup:**
1. Create a SendGrid account at [sendgrid.com](https://sendgrid.com)
2. Generate an API key in Settings > API Keys
3. Verify your sender domain or use a single sender verification

### 2. Resend (Modern Alternative)

```bash
EMAIL_PROVIDER=resend
EMAIL_API_KEY=your-resend-api-key
```

**Setup:**
1. Create a Resend account at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Verify your domain or use the sandbox domain for testing

### 3. Gmail (Good for Development)

```bash
EMAIL_PROVIDER=gmail
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
```

**Setup:**
1. Enable 2-factor authentication on your Google account
2. Generate an App Password: Google Account > Security > App Passwords
3. Use the generated password (not your regular Gmail password)

### 4. Custom SMTP Server

```bash
EMAIL_PROVIDER=smtp
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-smtp-username
EMAIL_PASSWORD=your-smtp-password
```

**Common SMTP Settings:**
- **Gmail SMTP**: `smtp.gmail.com:587`
- **Outlook/Hotmail**: `smtp-mail.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **Custom Domain**: Check with your hosting provider

## Complete .env.local Example

```bash
# NextAuth Configuration
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# MongoDB
MONGODB_URI=your-mongodb-connection-string
MONGODB_DB_NAME=clicknotes-v2

# Email Service (SendGrid Example)
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=SG.your-sendgrid-api-key-here
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=ClickNotes
```

## Testing Email Setup

1. Start your development server: `npm run dev`
2. Go to `/signup` and create a new account
3. Check the console logs for verification email details
4. Check your email inbox for the verification email
5. Test password reset at `/forgot-password`

## Troubleshooting

### Common Issues:

1. **"Failed to send email" error:**
   - Check your API keys and credentials
   - Verify your email provider settings
   - Check if your email provider has sending limits

2. **Emails going to spam:**
   - Verify your sender domain
   - Use a professional email address
   - Set up SPF and DKIM records

3. **Gmail "Less secure app" error:**
   - Use App Passwords instead of regular passwords
   - Enable 2-factor authentication

4. **SendGrid/Resend authentication errors:**
   - Verify your API key is correct
   - Check if your account is active
   - Ensure you have sending permissions

## Production Considerations

1. **Domain Verification:** Verify your domain with your email provider
2. **Email Templates:** Customize email templates in `lib/email-service.ts`
3. **Rate Limiting:** Implement rate limiting for email requests
4. **Monitoring:** Set up email delivery monitoring
5. **Backup Provider:** Consider having a backup email service

## Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Regularly rotate your API keys
- Monitor email sending logs for suspicious activity
- Implement rate limiting to prevent abuse

# SMTP2GO Configuration Guide

This project uses [SMTP2GO](https://www.smtp2go.com/) as the default SMTP relay for transactional email. The transport is created in `controllers/emailController.js` and automatically connects to `mail.smtp2go.com` on port `587` unless overridden by environment variables.

## 1. Create and Verify Your SMTP2GO Account
1. Sign up for SMTP2GO and log in to the dashboard.
2. Navigate to **Sending > Sender Domains** and add the domain you will send from (e.g., `craftingforchrist.net`).
3. Follow SMTP2GO's DNS instructions to add the SPF and DKIM records. The project will refuse to send email unless the `smtpIdentityEmailAddress` environment variable matches a verified sender.
4. (Optional) Add individual **Sender Emails** under **Sending > Sender Emails** if you prefer to authorise a single address instead of the entire domain.

## 2. Generate SMTP Credentials
1. Visit **Settings > SMTP Users** and create a user dedicated to the web application.
2. Record the generated username and password – they map directly to the `smtpUser` and `smtpPass` environment variables.
3. Use the default SMTP host (`mail.smtp2go.com`) and port `587` for STARTTLS. Port `465` (implicit TLS) is also supported and will be auto-detected by the code based on `smtpPort`.

## 3. Configure Environment Variables
Populate the following values (e.g., inside `.env`):

```env
smtpHost=mail.smtp2go.com         # Optional – defaults to SMTP2GO's host
smtpPort=587                      # Optional – defaults to 587 (STARTTLS)
smtpUser=your-smtp2go-username
smtpPass=your-smtp2go-password
smtpIdentityEmailAddress=support@craftingforchrist.net
smtpIdentityDisplayName=Crafting For Christ
siteName=Crafting For Christ      # Used in email templates when display name is omitted
```

Additional behaviour:
- Setting `smtpPort=465` automatically enables `secure` mode for TLS.
- If `smtpIdentityDisplayName` is omitted, `siteName` (or the fallback `"Zander"`) becomes the friendly from name.
- The helper `isEmailServiceConfigured()` guards routes so UI buttons are disabled when SMTP is unavailable.

## 4. Test the Integration
1. Run the application locally: `npm run dev`.
2. Trigger an email flow, such as:
   - Registering a new account via `/register` to send a verification link.
   - Initiating a password reset via `/forgot-password`.
3. Watch the server logs. A successful send outputs a standard Fastify response log; failures raise a descriptive error that surfaces to the browser banner and the server console.

For manual verification you can also execute the following Node.js snippet after exporting your environment variables:

```bash
node -e "import('./controllers/emailController.js').then(({sendMail}) => sendMail(process.env.smtpIdentityEmailAddress, 'SMTP2GO smoke test', 'verify-email.ejs', { username: 'Test', verifyUrl: 'https://example.com' })).then(() => console.log('Email sent')).catch(console.error)"
```

> **Note:** The inline script above renders the existing `verify-email.ejs` template. Ensure the `verifyUrl` points to a safe destination if you forward the message.

## 5. Troubleshooting
- **`SMTP credentials are not fully configured`**: One or more of `smtpUser`, `smtpPass`, or `smtpIdentityEmailAddress` is missing. Review `controllers/emailController.js#getEmailConfigurationIssues` to surface the missing field names.
- **`Invalid login` / authentication failures**: Reset the SMTP user password in SMTP2GO and update `smtpPass`. SMTP2GO rotates credentials immediately.
- **Messages blocked or flagged**: Confirm your domain has SPF and DKIM set up and that the sender address matches the verified domain. SMTP2GO’s dashboard provides detailed activity logs under **Reports > Activity**.
- **Timeouts**: The transporter uses 15–20 second timeouts. Ensure outbound connections to `mail.smtp2go.com` are allowed from your hosting environment.

Keeping SMTP credentials secret is critical. When deploying to Render, Heroku, or similar platforms, store all SMTP variables as encrypted environment values rather than committing them to source control.

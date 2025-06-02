# Email Service Setup Guide 📧

## Quick Setup (5 minutes)

### 1. Gmail Setup (Recommended)

1. **Enable 2FA** on your Gmail account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and generate password
3. **Update .env**:
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_USER="youremail@gmail.com"
   SMTP_PASS="your_app_password_here"  # 16-character password from step 2
   ```

### 2. Other Providers

#### Outlook/Hotmail

```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT=587
SMTP_USER="youremail@outlook.com"
SMTP_PASS="your_password"
```

#### Yahoo

```env
SMTP_HOST="smtp.mail.yahoo.com"
SMTP_PORT=587
SMTP_USER="youremail@yahoo.com"
SMTP_PASS="your_app_password"
```

## Test Your Setup

1. **Start the server**: `npm run start:dev`
2. **Test email endpoint** (development only):
   ```bash
   curl -X POST http://localhost:4000/api/auth/test-email \
     -H "Content-Type: application/json" \
     -d '{"email": "yourtest@email.com", "type": "verification"}'
   ```

## Email Features

✅ **Auto-sent emails**:

- Registration → Verification email
- Verification → Welcome email
- Forgot password → Reset email

✅ **Beautiful templates**:

- Responsive design
- Vietnamese language
- Professional branding

✅ **Security**:

- Tokens expire automatically
- Secure token generation
- Error handling

## Troubleshooting

❌ **"Less secure app" error**: Use App Password, not regular password
❌ **Connection refused**: Check firewall/antivirus blocking port 587
❌ **Authentication failed**: Verify credentials and enable 2FA
❌ **Emails in spam**: Normal for development, add SPF records for production

## Production Notes

- Use dedicated email service (SendGrid, AWS SES) for high volume
- Set up proper SPF/DKIM records
- Monitor bounce/complaint rates
- Consider email rate limiting

---

**That's it!** Your email service is ready 🎉

For detailed documentation, see [AUTH_SETUP.md](./AUTH_SETUP.md)

# Email Configuration Guide for Clinic Companion

## Current Issue
Users are not receiving verification emails after signup. This is likely due to Supabase Auth email configuration.

## Quick Fix Steps

### 1. Check Supabase Email Settings
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Settings**
3. Scroll to **Email Settings**
4. Ensure **"Enable email confirmations"** is turned ON
5. Check the **Site URL** and **Redirect URLs**:
   - Site URL: `https://your-domain.com` (or `http://localhost:3000` for dev)
   - Redirect URLs should include: `https://your-domain.com/**` (or `http://localhost:3000/**`)

### 2. Configure SMTP Settings (Recommended for Production)
If using custom SMTP:
1. In **Authentication** → **Settings** → **Email Templates**
2. Configure **SMTP Settings**:
   ```
   SMTP Host: smtp.gmail.com (or your provider)
   SMTP Port: 587
   SMTP User: your-email@gmail.com
   SMTP Password: your-app-password
   ```
3. Enable **"Enable custom SMTP"**

### 3. Test Email Configuration
1. Go to **Authentication** → **Users**
2. Find a test user
3. Click **"Send confirmation email"**
4. Check if email arrives

## Alternative: Use Supabase's Email Service
If you don't have SMTP configured:
1. In **Authentication** → **Settings** → **Email Templates**
2. Ensure **"Enable email confirmations"** is ON
3. Supabase will use their default email service
4. Note: This has limitations (rate limits, Supabase branding)

## Common Issues & Solutions

### Issue: Emails going to spam
- Add your domain to SPF/DKIM records
- Use a proper domain instead of Gmail for production
- Check email template content for spam triggers

### Issue: "Email not sent" error
- Verify SMTP credentials
- Check firewall/ports (587 for TLS, 465 for SSL)
- Ensure email provider allows app passwords (for Gmail)

### Issue: User can't click verification link
- Ensure redirect URLs are properly configured
- Check that the link format matches: `https://your-domain.com/auth/callback?...`

## Development vs Production

### Development (localhost)
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your_local_key
```
- Redirect URLs: `http://localhost:3000/**`
- Site URL: `http://localhost:3000`

### Production
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_prod_key
```
- Redirect URLs: `https://your-domain.com/**`
- Site URL: `https://your-domain.com`

## Testing the Fix

1. **Run the updated migration**:
   ```sql
   -- In Supabase SQL Editor, run:
   -- database-migrations/create_clinic_requests.sql
   ```

2. **Test duplicate prevention**:
   - Try signing up with the same email twice
   - Should see appropriate error message

3. **Test email resend**:
   - Sign up as a new user
   - Go to Pending Approval page
   - Click "Resend verification email"
   - Check inbox (including spam folder)

## If Emails Still Don't Work

### Option 1: Skip email verification (temporary)
In `src/pages/Login.tsx`, comment out the email verification check:
```typescript
// Comment out this block temporarily
if (!emailConfirmedAt) {
  // ... email verification logic
}
```

### Option 2: Manual verification
As super-admin, you can manually approve requests without email verification in the `SaasClinicRequests.tsx` approval flow.

## Monitoring Email Delivery
- Check Supabase logs: **Logs** → **Auth** for email delivery errors
- Monitor bounce rates in your email provider dashboard
- Set up error tracking for email failures

## Next Steps
1. Configure email settings in Supabase
2. Run the database migration
3. Test the duplicate prevention flow
4. Test email resend functionality
5. Deploy to production with proper email configuration

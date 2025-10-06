# Supabase Environment Configuration

This project uses Lovable's native environment variable system to automatically separate **preview** (development) and **production** environments.

## How It Works

The Supabase client (`src/integrations/supabase/client.ts`) reads from these environment variables:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key

Lovable automatically manages these variables:
- **Preview/Development**: Uses the values you set in your Lovable project settings (dev Supabase project)
- **Published/Production**: Uses the values you set for production deployment (prod Supabase project)

## Setup Instructions

### 1. Create Two Supabase Projects

You should have two separate Supabase projects:

1. **DEV Project** - For preview/development
   - Used when working in Lovable preview
   - Safe for testing and experimentation

2. **PROD Project** - For production
   - Used when your app is published
   - Contains real user data

### 2. Configure Environment Variables in Lovable

In your Lovable project:

1. Go to **Project Settings** → **Environment Variables**
2. Add the following variables for **Preview/Development**:
   - `VITE_SUPABASE_URL` = Your DEV Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` = Your DEV Supabase anon key

3. Add the following variables for **Production**:
   - `VITE_SUPABASE_URL` = Your PROD Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your PROD Supabase anon key

### 3. Whitelist Callback URLs in Supabase

For authentication to work properly, you need to whitelist the callback URLs in **both** Supabase projects.

#### DEV Supabase Project

Go to **Authentication** → **URL Configuration** and add:

**Site URL:**
```
https://your-project.lovable.app
```

**Redirect URLs:**
```
https://your-project.lovable.app/**
https://your-project.lovable.dev/**
http://localhost:5173/**
http://127.0.0.1:5173/**
```

#### PROD Supabase Project

Go to **Authentication** → **URL Configuration** and add:

**Site URL:**
```
https://your-custom-domain.com
```
(or your published Lovable URL)

**Redirect URLs:**
```
https://your-custom-domain.com/**
https://your-published-site.lovable.app/**
```

### 4. Google OAuth Configuration (if using)

If you're using Google OAuth, you need to configure it in **both** Supabase projects.

#### For Each Supabase Project:

1. Go to **Authentication** → **Providers** → **Google**
2. Enable Google provider
3. Add your Google Client ID and Secret
4. In Google Cloud Console, add the authorized redirect URIs:

**DEV Project:**
```
https://YOUR_DEV_PROJECT_REF.supabase.co/auth/v1/callback
```

**PROD Project:**
```
https://YOUR_PROD_PROJECT_REF.supabase.co/auth/v1/callback
```

## Testing Checklist

### Preview Environment
- [ ] Open your Lovable preview
- [ ] Check browser console for Supabase initialization (should show DEV project URL)
- [ ] Test authentication (sign up/login)
- [ ] Verify data is being written to DEV Supabase project
- [ ] Test Google OAuth (if enabled)

### Production Environment
- [ ] Publish your app
- [ ] Open the published URL
- [ ] Check browser console for Supabase initialization (should show PROD project URL)
- [ ] Test authentication (sign up/login)
- [ ] Verify data is being written to PROD Supabase project
- [ ] Test Google OAuth (if enabled)

## Troubleshooting

### "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY" Warning

If you see this console warning:
1. Check that environment variables are set in Lovable project settings
2. Ensure variable names match exactly: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Refresh the preview after adding variables

### Authentication Redirects Failing

If auth redirects fail:
1. Verify callback URLs are whitelisted in Supabase (see section 3 above)
2. Check that Site URL matches your actual domain
3. Ensure `flowType: 'pkce'` is set in the Supabase client config

### Data Going to Wrong Environment

If preview data appears in production or vice versa:
1. Clear browser cache and localStorage
2. Verify environment variables are correctly set for both environments
3. Check browser console to confirm which Supabase URL is being used

### Google OAuth Not Working

If Google sign-in fails:
1. Verify Google provider is enabled in **both** Supabase projects
2. Check that redirect URIs are added in Google Cloud Console for **both** projects
3. Ensure Google Client ID/Secret are configured in each Supabase project

## Architecture Notes

- **No hardcoded credentials**: All Supabase configuration comes from environment variables
- **Backward compatible**: Existing imports from `@/lib/supabaseClient` continue to work
- **Phase 1 auth preserved**: All session management improvements from previous work remain intact
- **Single source of truth**: `src/integrations/supabase/client.ts` is the only place where the Supabase client is created

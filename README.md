# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/aba41743-9dfe-4b0e-88f2-0c24aeb910c4

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/aba41743-9dfe-4b0e-88f2-0c24aeb910c4) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Setup

### Email Configuration

This project uses [Resend](https://resend.com) for transactional emails (verification, invitations, password resets).

**Required Setup:**

1. **Create a Resend account** at [resend.com](https://resend.com)
2. **Verify your domain** at [resend.com/domains](https://resend.com/domains)
3. **Create an API key** at [resend.com/api-keys](https://resend.com/api-keys)
4. **Configure Supabase secrets:**
   - Go to your [Supabase Dashboard → Edge Functions → Secrets](https://supabase.com/dashboard/project/etrxjxstjfcozdjumfsj/settings/functions)
   - Add the following secrets:
     - `RESEND_API_KEY` - Your Resend API key
     - `SEND_EMAIL_HOOK_SECRET` - A secure random string (for email webhooks)
     - `EMAIL_DEFAULT_FROM` (optional) - Default: `"GoGio <noreply@app.gogio.io>"`

**Note:** All email environment variables are stored as Supabase secrets (not in `.env` files) for security.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/aba41743-9dfe-4b0e-88f2-0c24aeb910c4) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

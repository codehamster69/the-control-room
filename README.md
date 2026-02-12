# The Control Room
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/codehamster69/the-control-room)

Welcome to The Control Room, a gamified Instagram community platform with a retro-futuristic, cyberpunk aesthetic. This Next.js application allows users to connect their Instagram accounts, participate in a daily "gacha" game to collect items, compete on a global leaderboard, and view their collections in a personal armory.

## ✨ Features

*   **Cyberpunk UI:** A unique, retro gaming interface built with Tailwind CSS and shadcn/ui.
*   **Authentication:** Secure user sign-up and login via Google or Email/Password, handled by Supabase Auth.
*   **Instagram Verification:** A robust system that requires users to verify ownership of their Instagram account by placing a temporary code in their bio. Profile data is scraped using Apify.
*   **Gacha System:** A daily gacha spinner where users can win items of varying rarities (Common, Uncommon, Rare, Epic, Legendary, Mythic).
*   **Armory & Inventory:** A personal dashboard for users to view and manage their collection of items.
*   **Leaderboard:** A global ranking system based on a user's "Total Power," which is calculated from their stats and item collection.
*   **Stats System (`CHAOS` & `SIMP`):**
    *   `CHAOS` stat increases gacha drop rates for rarer items.
    *   `SIMP` stat increases the success chance for item upgrades.
*   **Item Upgrades:** Users can consume duplicate items to upgrade their gear, increasing its power score.
*   **User Profiles:** Publicly viewable profiles showcasing a user's stats, inventory, and Instagram details.
*   **Admin Panel:** A secure dashboard for administrators to manage game items and community links.

## 🛠️ Tech Stack

*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **Database & Auth:** [Supabase](https://supabase.io/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
*   **Web Scraping:** [Apify](https://apify.com/) for Instagram bio verification.
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Deployment:** Vercel

## 🚀 Getting Started

To run The Control Room locally, you'll need to set up a Supabase project and obtain API keys for Supabase and Apify.

### Prerequisites

*   Node.js (v20.9.0 or later)
*   pnpm (or your preferred package manager)
*   A Supabase account
*   An Apify account

### 1. Clone the Repository

```bash
git clone https://github.com/codehamster69/the-control-room.git
cd the-control-room
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Supabase

1.  Go to [Supabase](https://app.supabase.io) and create a new project.
2.  Navigate to the **SQL Editor** in your new project.
3.  Copy the contents of `scripts/setup-control-room-db.sql` and run it to set up the necessary tables, views, and policies.
    *   *Optional:* After setup, you can run `scripts/seed-items.sql` to populate the `items` table with initial gacha items.
4.  In your Supabase project, go to **Authentication -> Providers** and enable **Google**. Follow the instructions to add your Google OAuth credentials.
5.  Go to **Project Settings -> API** and copy your `Project URL` and `anon` `public` key.
6.  Go to **Project Settings -> API** and find your `service_role` secret under **Project API keys**. **Important:** Keep this key secret and do not expose it on the client side.

### 4. Environment Variables

Create a `.env.local` file in the root of the project and add the following environment variables:

```plaintext
# Supabase
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_SECRET

# Apify
APIFY_API_TOKEN=YOUR_APIFY_API_TOKEN
```

### 5. Run the Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

## ⚙️ Project Structure

The repository is a standard Next.js application using the App Router.

*   `app/`: Contains all pages and API routes.
    *   `app/page.tsx`: The main landing and login page.
    *   `app/(dashboard)/`: Logged-in user routes like `/armory`, `/gacha`, `/leaderboard`, etc.
    *   `app/api/`: Server-side API endpoints for authentication, Instagram verification, and admin actions.
*   `components/`: Contains React components.
    *   `components/ui/`: Reusable UI components from shadcn/ui.
    *   `components/gacha-spinner.tsx`: The core logic for the gacha game.
    *   `components/armory-grid.tsx`: The UI for displaying a user's item inventory.
    *   `components/instagram-verification-form.tsx`: Handles the Instagram verification flow.
*   `lib/`: Utility functions and Supabase client initializations.
*   `scripts/`: SQL scripts for setting up and migrating the Supabase database.

## 🗃️ Database Schema

The core Supabase schema includes the following tables:

*   **`profiles`**: Stores user data, including `username`, `avatar_url`, and game stats (`chaos_stat`, `simp_stat`).
*   **`items`**: Contains all discoverable items, their `rarity`, `score_value`, and `image_url`.
*   **`inventory`**: Maps items to users, tracking the `quantity` of each item a user owns.
*   **`item_upgrades`**: Tracks the `upgrade_level` for each item a user owns.
*   **`gacha_logs`**: Stores the timestamp of a user's last gacha spin to enforce cooldowns.
*   **`instagram_verifications`**: Temporarily stores verification codes for the Instagram auth flow.
*   **`community_links`**: Stores community URLs managed by admins.
*   **`leaderboard` (View)**: A database view that calculates each user's `item_power` and `total_power` for ranking.

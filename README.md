# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:** Node.js

1.  Install dependencies:
    `npm install`
2.  Create a `.env.local` file in the root of your project.
3.  Add your Gemini API key to `.env.local`:
    `GEMINI_API_KEY=your_gemini_api_key`
4.  Add your Supabase project URL and anon key to `.env.local`:
    `SUPABASE_URL=your_supabase_project_url`
    `SUPABASE_ANON_KEY=your_supabase_anon_public_key`
    (You can find these in your Supabase project settings under API.)
5.  Run the app:
    `npm run dev`

Your application will be accessible at `http://localhost:5173` (or another port if 5173 is busy).

## Project Structure (Simplified)

-   `public/`: Static assets.
-   `src/`: Application source code.
    -   `App.tsx`: Main application component, routing.
    -   `main.tsx` / `index.tsx`: Entry point, renders the React app.
    -   `components/`: Reusable UI components (Navbar, Modals, etc.).
    -   `contexts/`: React context for global state (DataContext).
    -   `pages/`: Top-level page components.
    -   `services/`: Logic for external interactions (CSV parsing, Supabase client).
    -   `types.ts`: TypeScript type definitions.
-   `index.html`: Main HTML file.
-   `vite.config.ts`: Vite build configuration.
-   `package.json`: Project dependencies and scripts.
-   `tsconfig.json`: TypeScript configuration.

## Key Technologies

-   React
-   TypeScript
-   Vite
-   Tailwind CSS
-   Supabase (for database and authentication)
-   Recharts (for charts)
-   React Router DOM (for navigation)

## Supabase Setup

Ensure your Supabase project has the necessary tables and Row Level Security (RLS) policies configured. Refer to the SQL DDL scripts provided during development for the required schema. RLS is crucial for securing your data.

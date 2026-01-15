# Endicode Clinic

A modern clinic management system built with React, TypeScript, and Supabase.

## Features

- Patient management with comprehensive profiles
- Invoice and payment tracking
- Inventory management
- Appointment scheduling
- Multi-clinic support (SaaS)
- Real-time data synchronization
- Responsive design with modern UI

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: shadcn/ui, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **State Management**: React Query, Custom Hooks
- **Form Validation**: Zod schemas
- **Build Tools**: Vite, SWC

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd clinic-companion
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## Environment Setup

Create a `.env` file with your Supabase configuration:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Database Setup

Ensure your Supabase database has:
- RLS policies enabled on all tables
- Required indexes on foreign keys
- Proper user roles and permissions

See `DEPLOYMENT.md` for detailed setup instructions.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/              # shadcn/ui components
│   └── layout/          # Layout components
├── pages/               # Page components
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and validation
├── types/               # TypeScript type definitions
├── contexts/            # React contexts
└── integrations/        # External service integrations
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Security & Performance

- Row Level Security (RLS) on all database tables
- Input validation with Zod schemas
- Optimized database queries and indexes
- Environment variable configuration
- No known security vulnerabilities

## Deployment

See `DEPLOYMENT.md` for comprehensive deployment instructions.

## License

Private - All rights reserved

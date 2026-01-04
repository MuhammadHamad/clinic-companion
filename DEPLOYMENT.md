# Clinic Companion - Deployment Guide

## Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Fill in your Supabase credentials in `.env`:
```
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Build & Deploy

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm install
npm run build
npm run preview
```

## Security Notes

- Environment variables are properly configured and excluded from git
- All forms now use Zod schema validation for robust input validation
- Database RLS policies are optimized for performance
- Dependencies are up-to-date with no known vulnerabilities

## Database Requirements

Ensure your Supabase database has the following optimizations applied:
- Indexes on all foreign keys
- RLS policies with optimized auth function evaluation
- Combined policies where applicable

## Performance Optimizations

- Database queries use specific column selection
- Frontend uses React Query for efficient data fetching
- Pagination implemented for large datasets
- Form validation happens client-side before API calls

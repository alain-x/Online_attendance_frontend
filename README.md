# Attendance Management System - Frontend

React frontend for the Online Attendance Management System.

## Quick Start

1. **Prerequisites:**
   - Node.js 16+
   - npm or yarn

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure API URL:**
   Create `.env` file:
   ```env
   REACT_APP_API_URL=http://localhost:8080
   ```

4. **Run Development Server:**
   ```bash
   npm start
   ```

   Opens on `http://localhost:3000`

## Build for Production

```bash
npm run build
```

The `build` folder contains the production-ready files.

## Features

- Modern, responsive UI with Tailwind CSS
- Real-time attendance tracking
- Interactive dashboards
- Toast notifications
- Loading states
- Error handling
- Role-based UI rendering

## Project Structure

- `src/api/` - API client functions
- `src/components/` - Reusable UI components
- `src/pages/` - Page components
- `src/auth/` - Authentication context
- `src/routes/` - Route protection
- `src/hooks/` - Custom React hooks

## Environment Variables

- `REACT_APP_API_URL` - Backend API URL (default: http://localhost:8080)

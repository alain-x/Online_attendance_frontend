import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import App from './App';

test('renders login page by default', () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
  expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
});

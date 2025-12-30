import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users for testing
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'admin@clinic.com': {
    password: 'admin123',
    user: {
      id: '1',
      email: 'admin@clinic.com',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  },
  'dentist@clinic.com': {
    password: 'dentist123',
    user: {
      id: '2',
      email: 'dentist@clinic.com',
      first_name: 'Dr. Sarah',
      last_name: 'Ahmed',
      role: 'dentist',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  },
  'receptionist@clinic.com': {
    password: 'reception123',
    user: {
      id: '3',
      email: 'receptionist@clinic.com',
      first_name: 'Ali',
      last_name: 'Hassan',
      role: 'receptionist',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth on mount
    const storedUser = localStorage.getItem('dental_clinic_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('dental_clinic_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const demoUser = DEMO_USERS[email.toLowerCase()];
    
    if (!demoUser) {
      return { success: false, error: 'Invalid email or password' };
    }

    if (demoUser.password !== password) {
      return { success: false, error: 'Invalid email or password' };
    }

    setUser(demoUser.user);
    localStorage.setItem('dental_clinic_user', JSON.stringify(demoUser.user));
    localStorage.setItem('dental_clinic_token', 'demo_jwt_token');
    
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('dental_clinic_user');
    localStorage.removeItem('dental_clinic_token');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

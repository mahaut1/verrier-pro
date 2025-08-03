import { useQuery } from '@tanstack/react-query';

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const response = await fetch('/api/auth/user');
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  return {
    user,
    isAuthenticated: !!user,
    isLoading
  };
}
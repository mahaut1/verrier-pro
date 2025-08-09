import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const {
    data: user,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: "include", // important si cookies/session
      });
      if (!response.ok) return null;
      return await response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    refetchAuth: refetch // on expose la méthode
  };
}

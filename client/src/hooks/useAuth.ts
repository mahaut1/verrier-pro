import {
  useQuery,
  useQueryClient,
  type RefetchOptions,
  type QueryObserverResult,
} from "@tanstack/react-query";

export type Role = "admin" | "artisan" | "client";
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: Role;
  createdAt?: string | Date | null;
}

/** Renvoie null si 401 (non connecté) */
async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/user", { credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()) as AuthUser;
}

export function useAuth(): {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refetchAuth: (
    options?: RefetchOptions
  ) => Promise<QueryObserverResult<AuthUser | null, Error>>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
} {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery<AuthUser | null>({
    queryKey: ["auth", "user"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60_000, // 5 minutes
  });

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || "Identifiants invalides");
    }
    await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    await refetch();
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    queryClient.setQueryData(["auth", "user"], null);
    await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
  };

  return {
    user: data ?? null,
    isAuthenticated: !!data,
    isLoading: isLoading || isFetching,
    refetchAuth: refetch,
    login,
    logout,
  };
}

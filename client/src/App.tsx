import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "sonner";
import { useEffect, useRef } from "react";
import { useAuth } from "./hooks/useAuth";
import AppLayout from "./components/layout/AppLayout";
import Pieces from "./pages/pieces";
import Login from "./pages/login";
import Register from "./pages/register";
import Galleries from "./pages/galleries";
import Stocks from "./pages/stocks";
import Orders from "./pages/orders";
import Events from "./pages/events";
import Dashboard from "./pages/dashboard";
import ForgotPassword from "./pages/forgotPassword";
import ResetPassword from "./pages/resetPassword";

/**  Auto-logout après 5h d'inactivité  */
const IDLE_TIMEOUT_MS = 5 * 60 * 60 * 1000; // 5h
const LS_KEY_LAST_ACTIVITY = "verrier:last-activity";
const LS_KEY_FORCE_LOGOUT = "verrier:force-logout";

function AutoLogoutGuard() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const schedule = () => {
    clearTimer();
    timerRef.current = window.setTimeout(async () => {
      // double sécurité : on re-vérifie la dernière activité stockée
      const last = Number(localStorage.getItem(LS_KEY_LAST_ACTIVITY) || "0");
      if (Date.now() - last >= IDLE_TIMEOUT_MS) {
        localStorage.setItem(LS_KEY_FORCE_LOGOUT, String(Date.now())); // sync autres onglets
        await logout();
        navigate("/login", { replace: true });
      } else {
        schedule();
      }
    }, IDLE_TIMEOUT_MS);
  };

  const markActivity = () => {
    localStorage.setItem(LS_KEY_LAST_ACTIVITY, String(Date.now()));
    schedule();
  };

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimer();
      return;
    }

    markActivity();

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
        ];
    const onAnyActivity = () => {
      if (document.visibilityState === "visible") markActivity();
    };

    events.forEach((ev) => window.addEventListener(ev, onAnyActivity, { passive: true }));

    const onStorage = async (e: StorageEvent) => {
      if (e.key === LS_KEY_LAST_ACTIVITY) schedule();
      if (e.key === LS_KEY_FORCE_LOGOUT && e.newValue) {
        await logout();
        navigate("/login", { replace: true });
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onAnyActivity));
      window.removeEventListener("storage", onStorage);
      clearTimer();
    };
  }, [isAuthenticated]);

  return null;
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-2 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

/** Empêche d’accéder /login et /register si déjà connecté */
function GuestOnly({ children }: { children: JSX.Element }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-2 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

/** On insère AutoLogoutGuard uniquement quand on est dans la zone protégée */
function AuthenticatedShell() {
  return (
    <>
      <AutoLogoutGuard />
      <AppLayout />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
       <Route
            path="/login"
            element={
              <GuestOnly>
                <Login />
              </GuestOnly>
            }
          />
           <Route
            path="/register"
            element={
              <GuestOnly>
                <Register />
              </GuestOnly>
            }
          />

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/"
            element={
              <RequireAuth>
              <AuthenticatedShell />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard/>} />
            <Route path="pieces" element={<Pieces />} />
            <Route path="galleries" element={<Galleries />} />
            <Route path="stocks" element={<Stocks />} />
            <Route path="orders" element={<Orders />} />
            <Route path="events" element={<Events />} />
     

          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

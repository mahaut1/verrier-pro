import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "sonner";
import { useAuth } from "./hooks/useAuth";
import AppLayout from "./components/layout/AppLayout";
import Home from "./pages/Home";
import Pieces from "./pages/pieces";
import Login from "./pages/login";
import Register from "./pages/register";
import Galleries from "./pages/galleries";
import Stocks from "./pages/stocks";
import Orders from "./pages/orders";

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
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Home />} />
            <Route path="pieces" element={<Pieces />} />
            <Route path="galleries" element={<Galleries />} />
            <Route path="stocks" element={<Stocks />} />
            <Route path="orders" element={<Orders />} />

          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

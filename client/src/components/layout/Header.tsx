import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { apiRequest } from "../../lib/queryClient";
import {
  Home,
  Package,
  Palette,
  Building,
  ShoppingCart,
  Calendar,
  Menu,
  X,
  LogOut,
  User,
  Plus,
} from "lucide-react";

export default function Header() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/logout", {}),
    onSuccess: () => {
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  const nav = [
    { to: "/", label: "Tableau de bord", icon: Home, end: true },
    { to: "/stocks", label: "Stock", icon: Package },
    { to: "/pieces", label: "Pièces", icon: Palette },
    { to: "/galleries", label: "Galeries", icon: Building },
    { to: "/commands", label: "Commandes", icon: ShoppingCart },
    { to: "/events", label: "Événements", icon: Calendar },
  ];

  return (
    <header className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: burger + logo + desktop nav */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </Button>

          <button
            onClick={() => navigate("/")}
            className="text-2xl font-bold text-blue-600 hover:text-blue-700"
          >
            VerrierPro
          </button>

          <nav className="hidden lg:flex ml-6 gap-2">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}>
                {({ isActive }) => (
                  <Button
                    size="sm"
                    className={cn(
                      "flex items-center gap-2",
                      isActive
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-transparent text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: quick CTA + user + logout */}
        <div className="flex items-center gap-3">

          {isAuthenticated && (
            <>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full">
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-700 font-medium">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.username}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xl font-bold text-blue-600">VerrierPro</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-6 w-6" />
              </Button>
            </div>

            <nav className="space-y-1">
              {nav.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}>
                  {({ isActive }) => (
                    <div
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 mr-3", isActive ? "text-blue-600" : "text-gray-400")} />
                      {label}
                    </div>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

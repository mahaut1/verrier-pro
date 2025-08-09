import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Home as HomeIcon,
  Package,
  Palette,
  Building,
  ShoppingCart,
  Calendar,
  Plus,
  AlertTriangle,
} from "lucide-react";

function MainNavigation({ currentPage, onLogout }: { currentPage: string; onLogout: () => void }) {
  const navigate = useNavigate();

  const navItems = [
    { id: "/", label: "Tableau de bord", icon: HomeIcon },
    { id: "/stock", label: "Stock", icon: Package },
    { id: "/pieces", label: "Pièces", icon: Palette },
    { id: "/galleries", label: "Galeries", icon: Building },
    { id: "/commands", label: "Commandes", icon: ShoppingCart },
    { id: "/events", label: "Événements", icon: Calendar },
  ];

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-8">
              <h1 className="text-xl font-bold text-blue-600">VerrierPro</h1>
            </div>
            <nav className="flex space-x-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                    currentPage === item.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <Button onClick={() => navigate("/pieces")} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle pièce
            </Button>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">Admin VerrierPro</span>
            </div>
            <Button onClick={onLogout} variant="outline" size="sm">
              Déconnexion
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsOverview() {
  const stats = [
    { label: "Pièces totales", value: "0", change: "+12% ce mois", icon: Palette, color: "text-blue-600 bg-blue-100" },
    { label: "Stock critique", value: "0", change: "Attention requise", icon: AlertTriangle, color: "text-orange-600 bg-orange-100" },
    { label: "Commandes actives", value: "0", change: "8 en transit", icon: ShoppingCart, color: "text-green-600 bg-green-100" },
    { label: "Galeries partenaires", value: "0", change: "89% actives", icon: Building, color: "text-purple-600 bg-purple-100" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.change}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MainSections() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Pièces récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Palette className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Aucune pièce trouvée</p>
            <Button onClick={() => navigate("/pieces")} variant="outline">
              Créer votre première pièce
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertes stock</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">Aucune alerte de stock</p>
            <p className="text-sm text-gray-400">Tous vos stocks sont au niveau optimal</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { title: "Créer une pièce", icon: Palette, path: "/pieces" },
    { title: "Nouvelle commande", icon: ShoppingCart, path: "/commands" },
    { title: "Entrée de stock", icon: Package, path: "/stock" },
    { title: "Ajouter galerie", icon: Building, path: "/galleries" },
  ];

  return (
    <div className="mt-8">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Actions rapides</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action, index) => (
          <Card
            key={index}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(action.path)}
          >
            <CardContent className="p-6 text-center">
              <action.icon className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">{action.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/logout", {}),
    onSuccess: () => {
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation currentPage="/" onLogout={() => logoutMutation.mutate()} />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-600">Aperçu de votre activité d'atelier</p>
        </div>

        <StatsOverview />
        <MainSections />
        <QuickActions />
      </main>
    </div>
  );
}

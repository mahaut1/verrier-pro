import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Package, ShoppingCart, Building, AlertTriangle } from "lucide-react";

function StatsOverview() {
  const stats = [
    {
      label: "Pièces totales",
      value: "0",
      change: "+12% ce mois",
      icon: Palette,
      color: "text-blue-600 bg-blue-100",
    },
    {
      label: "Stock critique",
      value: "0",
      change: "Attention requise",
      icon: AlertTriangle,
      color: "text-orange-600 bg-orange-100",
    },
    {
      label: "Commandes actives",
      value: "0",
      change: "8 en transit",
      icon: ShoppingCart,
      color: "text-green-600 bg-green-100",
    },
    {
      label: "Galeries partenaires",
      value: "0",
      change: "89% actives",
      icon: Building,
      color: "text-purple-600 bg-purple-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.change}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentPieces({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pièces récentes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Palette className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Aucune pièce trouvée</p>
          <Button onClick={onCreate} variant="outline">
            Créer votre première pièce
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StockAlerts() {
  return (
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
  );
}

function QuickActions({
  goToPieces,
  goToOrders,
  goToStock,
  goToGalleries,
}: {
  goToPieces: () => void;
  goToOrders: () => void;
  goToStock: () => void;
  goToGalleries: () => void;
}) {
  const actions = [
    { title: "Créer une pièce", icon: Palette, onClick: goToPieces },
    { title: "Nouvelle commande", icon: ShoppingCart, onClick: goToOrders },
    { title: "Entrée de stock", icon: Package, onClick: goToStock },
    { title: "Ajouter galerie", icon: Building, onClick: goToGalleries },
  ];

  return (
    <div className="mt-8">
      <h3 className="text-lg font-medium mb-4">Actions rapides</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((a, i) => (
          <Card key={i} onClick={a.onClick} className="cursor-pointer hover:shadow-md">
            <CardContent className="p-6 text-center">
              <a.icon className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium">{a.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();

  return (
    <>
      {/* Titre de page */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-gray-600">Aperçu de votre activité d'atelier</p>
      </div>

      <StatsOverview />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RecentPieces onCreate={() => navigate("/pieces")} />
        <StockAlerts />
      </div>

      <QuickActions
        goToPieces={() => navigate("/pieces")}
        goToOrders={() => navigate("/commands")}
        goToStock={() => navigate("/stock")}
        goToGalleries={() => navigate("/galleries")}
      />
    </>
  );
}

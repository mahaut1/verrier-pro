import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import type { Piece, StockItem } from "@shared/schema";

function statusColor(s?: string) {
  switch (s) {
    case "workshop": return "bg-green-100 text-green-800";
    case "transit":  return "bg-blue-100 text-blue-800";
    case "gallery":  return "bg-purple-100 text-purple-800";
    case "sold":     return "bg-gray-100 text-gray-800";
    default:         return "bg-yellow-100 text-yellow-800";
  }
}
function statusLabel(s?: string) {
  switch (s) {
    case "workshop": return "Atelier";
    case "transit":  return "En transit";
    case "gallery":  return "En galerie";
    case "sold":     return "Vendue";
    default:         return "En cours";
  }
}

export default function RecentActivity() {
  const { data: pieces = [], isLoading: loadingPieces } = useQuery<Piece[]>({
    queryKey: ["/api/pieces"],
  });
  const { data: lowStockItems = [], isLoading: loadingStock } = useQuery<StockItem[]>({
    queryKey: ["/api/stock-items/low-stock"],
  });

  const recentPieces = (pieces ?? []).slice(0, 3);
  const stockAlerts  = (lowStockItems ?? []).slice(0, 3);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Pièces récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPieces ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : recentPieces.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Aucune pièce trouvée</p>
              <Link to="/pieces">
                <Button variant="outline" className="mt-2">Créer votre première pièce</Button>
              </Link>
            </div>
          ) : (
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {recentPieces.map((p) => (
                  <li key={p.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {p.name?.charAt(0)?.toUpperCase() ?? "P"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-sm text-gray-500">
                          {p.currentLocation ?? "—"} • {p.createdAt ? new Date(p.createdAt).toLocaleDateString("fr-FR") : "Date inconnue"}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <Badge className={statusColor(p.status)}>{statusLabel(p.status)}</Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <Link to="/pieces">
              <Button variant="outline" className="w-full">Voir toutes les pièces</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertes stock</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStock ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : stockAlerts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Aucune alerte de stock</p>
              <p className="text-sm text-gray-400 mt-1">Tous vos stocks sont au niveau optimal</p>
            </div>
          ) : (
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {stockAlerts.map((item) => {
                  const veryLow =
                    parseFloat(item.currentQuantity) <
                    parseFloat(item.minimumThreshold) * 0.5;
                  return (
                    <li key={item.id} className="py-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 ${veryLow ? "bg-red-100" : "bg-yellow-100"} rounded-lg flex items-center justify-center`}>
                            <AlertTriangle className={`w-5 h-5 ${veryLow ? "text-red-600" : "text-yellow-600"}`} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            Stock: {item.currentQuantity} {item.unit} (seuil: {item.minimumThreshold} {item.unit})
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <Link to="/stocks">
                            <Button variant="outline" size="sm">Gérer</Button>
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <Link to="/stocks">
              <Button variant="outline" className="w-full">Gérer les stocks</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

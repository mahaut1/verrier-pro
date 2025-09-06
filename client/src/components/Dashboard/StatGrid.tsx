import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Box, Package, ShoppingCart, Building2 } from "lucide-react";

type Stats = {
  totalPieces: number;
  piecesThisMonth: number;
  piecesPrevMonth: number;
  lowStockCount: number;
  activeOrders: number;
  inTransitOrders: number;
  totalGalleries: number;
  activeGalleries: number;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function percentChange(prev: number, curr: number): number | null {
  if (prev === 0 && curr === 0) return 0;
  if (prev === 0 && curr > 0) return 100;
  if (prev === 0 && curr < 0) return -100;
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export default function StatsGrid() {
  const { data: stats, isLoading, isError } = useQuery<Stats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: () => getJson<Stats>("/api/dashboard/stats"),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Impossible de charger les statistiques</p>
      </div>
    );
  }

  const piecesDelta = percentChange(stats.piecesPrevMonth, stats.piecesThisMonth);
  const piecesChangeLabel =
    piecesDelta === null ? "—"
    : `${piecesDelta > 0 ? "+" : ""}${Math.round(piecesDelta)}% ce mois`;
  const piecesChangeColor =
    piecesDelta == null ? "text-gray-600"
    : piecesDelta > 0 ? "text-green-600"
    : piecesDelta < 0 ? "text-red-600"
    : "text-gray-600";

  const stockChangeLabel = stats.lowStockCount > 0 ? "Attention requise" : "OK";
  const stockChangeColor = stats.lowStockCount > 0 ? "text-red-600" : "text-green-600";

  const ordersChangeLabel = `${stats.inTransitOrders} en transit`;
  const ordersChangeColor = stats.inTransitOrders > 0 ? "text-green-600" : "text-gray-600";

  const galleriesPct =
    stats.totalGalleries > 0
      ? Math.round((stats.activeGalleries / stats.totalGalleries) * 100)
      : 0;
  const galleriesChangeLabel =
    stats.totalGalleries > 0 ? `${galleriesPct}% actives` : "Aucune galerie";
  const galleriesChangeColor = "text-purple-600";

  const statCards = [
    {
      title: "Pièces totales",
      value: stats.totalPieces,
      icon: Box,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      change: piecesChangeLabel,
      changeColor: piecesChangeColor,
    },
    {
      title: "Stock critique",
      value: stats.lowStockCount,
      icon: Package,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      change: stockChangeLabel,
      changeColor: stockChangeColor,
    },
    {
      title: "Commandes actives",
      value: stats.activeOrders,
      icon: ShoppingCart,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      change: ordersChangeLabel,
      changeColor: ordersChangeColor,
    },
    {
      title: "Galeries partenaires",
      value: stats.totalGalleries,
      icon: Building2,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      change: galleriesChangeLabel,
      changeColor: galleriesChangeColor,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title} className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">{stat.title}</dt>
                  <dd className="text-lg font-medium text-gray-900">{stat.value}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-gray-50 px-5 py-3">
            <div className={`text-sm ${stat.changeColor}`}>
              {stat.change}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

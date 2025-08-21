import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Package, AlertTriangle, TrendingUp, TrendingDown, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import StockForm from "../components/forms/stock-form";
import StockEditForm from "../components/forms/stock-edit-form";
import { useToast } from "../hooks/useToast";
import { apiRequest } from "../lib/queryClient";
import type { StockItem, StockMovement } from "@shared/schema";

function getStockStatus(item: StockItem) {
  const current = parseFloat(item.currentQuantity);
  const threshold = parseFloat(item.minimumThreshold);

  if (current === 0) {
    return { label: "Rupture", color: "bg-red-100 text-red-800", urgent: true };
  } else if (current <= threshold) {
    return { label: "Faible", color: "bg-yellow-100 text-yellow-800", urgent: false };
  } else if (current <= threshold * 1.5) {
    return { label: "Moyen", color: "bg-blue-100 text-blue-800", urgent: false };
  } else {
    return { label: "Bon", color: "bg-green-100 text-green-800", urgent: false };
  }
}

export default function Stocks() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

const { data: stockItems = [], isLoading } = useQuery<StockItem[]>({
  queryKey: ["/api/stock/items"],
  queryFn: async () => {
    const res = await fetch("/api/stock/items", {
      credentials: "include",
      cache: "no-store", 
    });
    if (!res.ok) throw new Error("Impossible de charger les stocks");
    return res.json();
  },
});

const { data: movements = [] } = useQuery<StockMovement[]>({
  queryKey: ["/api/stock/movements"],
  queryFn: async () => {
    const res = await fetch("/api/stock/movements", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Impossible de charger les mouvements");
    return res.json();
  },
});



  const deleteStockMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/stock/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Succès", description: "L'article de stock a été supprimé avec succès." });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    },
  });

  const filteredItems = stockItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockItems = filteredItems.filter((item) => {
    const status = getStockStatus(item);
    return status.urgent || status.label === "Faible";
  });

  const recentMovements = movements.slice(0, 5);

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Skeleton className="h-96" />
              </div>
              <div>
                <Skeleton className="h-96" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Gestion des stocks
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Gérez vos matières premières et matériaux d'emballage
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="-ml-1 mr-2 h-5 w-5" />
                  Nouvel article
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <StockForm onSuccess={() => setOpenDialog(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Rechercher un article..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total articles
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stockItems.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Stock faible
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {lowStockItems.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des articles */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Articles de stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredItems.map((item) => {
                    const status = getStockStatus(item);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
                            <Badge className={status.color}>{status.label}</Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {item.category} • {item.type}
                          </p>
                          <p className="text-sm text-gray-900 mt-1">
                            {item.currentQuantity} {item.unit} (Min: {item.minimumThreshold})
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline" onClick={() => setEditItem(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteStockMutation.mutate(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mouvements récents */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Mouvements récents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentMovements.map((movement) => {
                    const createdAt = movement.createdAt
                      ? new Date(movement.createdAt)
                      : null; // ✅ gère le null
                    return (
                      <div key={movement.id} className="flex items-center justify-between">
                        <div className="flex items-center">
                          {movement.type === "in" ? (
                            <TrendingUp className="h-4 w-4 text-green-600 mr-2" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600 mr-2" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {movement.type === "in" ? "Entrée" : "Sortie"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {movement.quantity} unités
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          {createdAt ? createdAt.toLocaleDateString() : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialog d'édition */}
     {editItem && (
  <Dialog
    open={!!editItem}
    onOpenChange={(open) => {
      if (!open) setEditItem(null); // fermer seulement à la fermeture
    }}
  >
    <DialogContent className="max-w-2xl">
      <StockEditForm item={editItem} onSuccess={() => setEditItem(null)} />
    </DialogContent>
  </Dialog>
)}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ShoppingCart, Edit, Trash2, ChevronDown, ChevronUp, Box } from "lucide-react";
import OrderForm from "../components/forms/order-form";
import OrderEditForm from "../components/forms/order-edit-form";
import { useToast } from "../hooks/useToast";
import { apiRequest } from "../lib/queryClient";
import type { Order, Gallery, OrderItem, Piece } from "@shared/schema";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function OrderItemsList({
  orderId,
  open,
  pieceById,
}: {
  orderId: number;
  open: boolean;
  pieceById: Map<number, Piece>;
}) {
  const { data: items = [], isLoading } = useQuery<OrderItem[]>({
    queryKey: ["/api/orders", orderId, "items"],
    queryFn: () => getJson<OrderItem[]>(`/api/orders/${orderId}/items`),
    enabled: open, // charge seulement si la section est ouverte
  });

  if (!open) return null;

  return (
    <div className="mt-4 rounded-lg border text-blue-600">
      <div className="text-sm font-semibold mb-2">Pièces de la commande</div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-6 w-4/6" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500">Aucune pièce dans cette commande.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const p = it.pieceId ? pieceById.get(it.pieceId) : undefined;
            return (
              <li key={it.id} className="flex items-center justify-between rounded-md bg-white p-2">
                <div className="flex items-center gap-3">
                  <Box className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium">
                      {p?.name ?? (it.pieceId ? `Pièce #${it.pieceId}` : "Pièce inconnue")}
                    </div>
                    {p?.uniqueId && <div className="text-xs text-gray-500">UID: {p.uniqueId}</div>}
                  </div>
                </div>
                <div className="text-sm">Prix: {it.price ?? "—"} €</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Orders() {
  const [openDialog, setOpenDialog] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: () => getJson<Order[]>("/api/orders"),
  });

  const { data: galleries = [] } = useQuery<Gallery[]>({
    queryKey: ["/api/galleries"],
    queryFn: () => getJson<Gallery[]>("/api/galleries"),
  });

  // on récupère toutes les pièces une seule fois pour résoudre les noms depuis pieceId
  const { data: pieces = [] } = useQuery<Piece[]>({
    queryKey: ["/api/pieces"],
    queryFn: () => getJson<Piece[]>("/api/pieces"),
  });

  const pieceById = useMemo(
    () => new Map<number, Piece>(pieces.map((p) => [p.id, p])),
    [pieces]
  );

  const getGalleryName = (galleryId: number | null) => {
    if (!galleryId) return "Commande directe";
    const gallery = galleries.find((g) => g.id === galleryId);
    return gallery ? gallery.name : "Galerie inconnue";
  };

  const deleteOrderMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/orders/${id}`),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/orders"] });
      const previousOrders = queryClient.getQueryData<Order[]>(["/api/orders"]);
      queryClient.setQueryData<Order[]>(["/api/orders"], (old = []) =>
        old.filter((o) => o.id !== deletedId)
      );
      return { previousOrders };
    },
    onError: (error: unknown, _id, ctx) => {
      if (ctx?.previousOrders) queryClient.setQueryData(["/api/orders"], ctx.previousOrders);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Suppression impossible.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
  });

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 gap-6">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
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
            <h2 className="text-2xl font-bold leading-7 text-blue-600 sm:text-3xl sm:truncate">
              Commandes
            </h2>
            <p className="text-sm text-blue-600 mt-1">Gérez vos commandes et ventes</p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="-ml-1 mr-2 h-5 w-5" />
                  Nouvelle commande
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl p-0">
                <OrderForm onSuccess={() => setOpenDialog(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mt-8">
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune commande</h3>
              <p className="mt-1 text-sm text-gray-500">Commencez par créer votre première commande.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const isOpen = !!expanded[order.id];
                return (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Commande #{order.orderNumber}</CardTitle>
                        <Badge>{order.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Total: {order.totalAmount ?? "—"}€</p>
                            <p className="text-sm text-gray-500">
                              {getGalleryName(order.galleryId ?? null)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setExpanded((s) => ({ ...s, [order.id]: !s[order.id] }))
                              }
                            >
                              {isOpen ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" /> Masquer les pièces
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" /> Voir les pièces
                                </>
                              )}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditOrder(order)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteOrderMutation.mutate(order.id)}
                              disabled={deleteOrderMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {order.shippingAddress && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Adresse:</span> {order.shippingAddress}
                          </p>
                        )}
                        {order.notes && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Notes:</span> {order.notes}
                          </p>
                        )}

                        <OrderItemsList orderId={order.id} open={isOpen} pieceById={pieceById} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {editOrder && (
          <Dialog open={!!editOrder} onOpenChange={() => setEditOrder(null)}>
            <DialogContent className="max-w-3xl p-0">
              <OrderEditForm order={editOrder} onSuccess={() => setEditOrder(null)} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {insertOrderSchema,type Order,type Gallery,type OrderItem,type Piece,} from "@shared/schema";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage,} from "@/components/ui/form";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const ALLOWED_STATUS = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
type OrderStatus = typeof ALLOWED_STATUS[number];
const coerceStatus = (v: unknown): OrderStatus =>
  (ALLOWED_STATUS as readonly string[]).includes(String(v))
    ? (v as OrderStatus)
    : "pending";

// helpers
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const formSchema = insertOrderSchema.extend({
  totalAmount: z.string().optional(),
});
type OrderFormData = z.infer<typeof formSchema>;

interface OrderEditFormProps {
  order: Order;
  onSuccess?: () => void;
}

export default function OrderEditForm({ order, onSuccess }: OrderEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const galleriesQ = useQuery<Gallery[], Error>({
    queryKey: ["/api/galleries"],
    queryFn: () => getJson<Gallery[]>("/api/galleries"),
  });

  const piecesQ = useQuery<Piece[], Error>({
    queryKey: ["/api/pieces"],
    queryFn: () => getJson<Piece[]>("/api/pieces"),
  });

  const itemsQ = useQuery<OrderItem[], Error>({
    queryKey: ["/api/orders", order.id, "items"],
    queryFn: () => getJson<OrderItem[]>(`/api/orders/${order.id}/items`),
  });

  const galleries: Gallery[] = galleriesQ.data ?? [];
  const pieces: Piece[] = piecesQ.data ?? [];
  const items: OrderItem[] = itemsQ.data ?? [];

  // Form
  const form = useForm<OrderFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderNumber: order.orderNumber,
      status: coerceStatus(order.status),
      totalAmount: order.totalAmount ? String(order.totalAmount) : "",
      shippingAddress: order.shippingAddress ?? "",
      notes: order.notes ?? "",
      galleryId: order.galleryId ?? null,
    },
  });

  const galleryId = form.watch("galleryId"); // number | null

  //  Sélection/ajout de nouvelles pièces
  const [search, setSearch] = useState("");
  const [selectedPieceIds, setSelectedPieceIds] = useState<number[]>([]);
  const [priceOverride, setPriceOverride] = useState<Record<number, string>>({});

  const alreadyInOrder = new Set(items.map((it) => it.pieceId!).filter(Boolean) as number[]);

  // on propose seulement les pièces non déjà liées, filtrées par galerie et par recherche
  const addablePieces = useMemo(() => {
    let list = pieces.filter((p) => !alreadyInOrder.has(p.id));
    if (galleryId != null) list = list.filter((p) => p.galleryId === galleryId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.uniqueId ?? "").toLowerCase().includes(q) ||
          (p.dominantColor ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [pieces, alreadyInOrder, galleryId, search]);

  // si on change de galerie, on nettoie la sélection incompatible
  useEffect(() => {
    if (galleryId == null) return;
    setSelectedPieceIds((prev) =>
      prev.filter((id) => pieces.find((p) => p.id === id)?.galleryId === galleryId)
    );
  }, [galleryId, pieces]);

  const toggleSelect = (id: number) => {
    setSelectedPieceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  //  Mutations
  const updateOrderMutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      const submitData = {
        orderNumber: data.orderNumber,
        status: coerceStatus(data.status),
        galleryId: data.galleryId ?? null,
        shippingAddress: data.shippingAddress?.trim() ? data.shippingAddress : null,
        notes: data.notes?.trim() ? data.notes : null,
      };
      return apiRequest("PATCH", `/api/orders/${order.id}`, submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order.id, "items"] });
      toast({ title: "Succès", description: "La commande a été modifiée avec succès." });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Une erreur est survenue lors de la modification.",
        variant: "destructive",
      });
    },
  });

  const addItemsMutation = useMutation({
    mutationFn: async () => {
      const bodies = selectedPieceIds.map((pieceId) => {
        const p = pieces.find((x) => x.id === pieceId);
        const price = priceOverride[pieceId] ?? (p?.price != null ? String(p.price) : "0");
        return { orderId: order.id, pieceId, price };
      });

      await Promise.all(
        bodies.map((b) =>
          fetch("/api/order-items", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(b),
          }).then(async (r) => {
            if (!r.ok) throw new Error(await r.text());
          })
        )
      );
    },
    onSuccess: () => {
      setSelectedPieceIds([]);
      setPriceOverride({});
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Pièces ajoutées", description: "Le total sera recalculé automatiquement." });
    },
    onError: (e: any) => {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d'ajouter les pièces.",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await fetch(`/api/order-items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Pièce retirée", description: "Le total a été mis à jour." });
    },
    onError: (e: any) => {
      toast({
        title: "Erreur",
        description: e?.message || "Suppression impossible.",
        variant: "destructive",
      });
    },
  });


  return (
    <>
      <DialogHeader>
        <DialogTitle>Modifier la commande</DialogTitle>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => updateOrderMutation.mutate(data))} className="space-y-6">
          {/* Champs commande */}
          <FormField
            control={form.control}
            name="orderNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro de commande</FormLabel>
                <FormControl>
                  <Input placeholder="CMD-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Galerie */}
          <FormField
            control={form.control}
            name="galleryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Galerie</FormLabel>
                <Select
                  value={field.value == null ? "direct" : String(field.value)}
                  onValueChange={(v) => field.onChange(v === "direct" ? null : parseInt(v, 10))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une galerie" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="direct">Commande directe</SelectItem>
                    {galleries.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select
                    value={(field.value as OrderStatus | undefined) ?? undefined}
                    onValueChange={(v) => field.onChange(coerceStatus(v))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="processing">En cours</SelectItem>
                      <SelectItem value="shipped">Expédiée</SelectItem>
                      <SelectItem value="delivered">Livrée</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Montant total (readonly) */}
            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant total (€)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="150.00" {...field} disabled />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Le total est calculé automatiquement à partir des items.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="shippingAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse de livraison</FormLabel>
                <FormControl>
                  <Textarea placeholder="Adresse complète..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optionnel)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Notes sur la commande..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Items actuels de la commande */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Pièces de la commande</h4>
              <Badge variant="secondary">{items.length}</Badge>
            </div>

            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune pièce pour le moment.</div>
            ) : (
              <ul className="divide-y rounded-md border">
                {items.map((it) => {
                  const p = pieces.find((x) => x.id === it.pieceId);
                  return (
                    <li key={it.id} className="flex items-center justify-between p-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p?.name ?? `Pièce #${it.pieceId}`}</div>
                        <div className="text-xs text-muted-foreground">
                          UID: {p?.uniqueId ?? "—"} {p?.status ? `• ${p.status}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{it.price != null ? `${it.price} €` : "—"}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteItemMutation.mutate(it.id)}
                          disabled={deleteItemMutation.isPending}
                        >
                          Retirer
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Ajouter de nouvelles pièces */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Ajouter des pièces</h4>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (nom, UID, couleur)…"
                className="max-w-xs"
              />
            </div>

            <div className="max-h-56 overflow-auto rounded-md border p-2 space-y-1">
              {addablePieces.length === 0 ? (
                <div className="text-sm text-muted-foreground px-1 py-2">
                  Aucune pièce disponible avec ces filtres.
                </div>
              ) : (
                addablePieces.map((p) => {
                  const checked = selectedPieceIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer ${
                        checked ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={checked} onChange={() => toggleSelect(p.id)} />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            UID: {p.uniqueId}
                            {p.status ? ` • ${p.status}` : ""}
                            {p.galleryId ? ` • Galerie #${p.galleryId}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Prix (€)</span>
                        <Input
                          value={priceOverride[p.id] ?? (p.price != null ? String(p.price) : "")}
                          onChange={(e) =>
                            setPriceOverride((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="w-28 h-8"
                          type="number"
                          step="0.01"
                          placeholder="—"
                          disabled={!checked}
                        />
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => addItemsMutation.mutate()}
                disabled={selectedPieceIds.length === 0 || addItemsMutation.isPending}
              >
                {addItemsMutation.isPending ? "Ajout..." : `Ajouter ${selectedPieceIds.length} pièce(s)`}
              </Button>
            </div>
          </div>

          {/* Actions du formulaire principal */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onSuccess?.()}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateOrderMutation.isPending}>
              {updateOrderMutation.isPending ? "Modification..." : "Enregistrer les changements"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}

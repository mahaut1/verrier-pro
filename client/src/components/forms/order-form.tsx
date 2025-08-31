import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {insertOrderSchema, type Gallery, type Piece,} from "@shared/schema";
import { useToast } from "../../hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,} from "@/components/ui/form";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

//helpers 

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// le serveur accepte totalAmount côté schéma mais on ne l’utilise pas à la création
const formSchema = insertOrderSchema.extend({
  totalAmount: z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;


export default function OrderForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: galleriesData } = useQuery<Gallery[], Error>({
    queryKey: ["/api/galleries"],
    queryFn: () => getJson<Gallery[]>("/api/galleries"),
  });
  const { data: piecesData } = useQuery<Piece[], Error>({
    queryKey: ["/api/pieces"],
    queryFn: () => getJson<Piece[]>("/api/pieces"),
  });

  const galleries: Gallery[] = galleriesData ?? [];
  const pieces: Piece[] = piecesData ?? [];

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderNumber: "",
      status: "pending",
      totalAmount: "",
      shippingAddress: "",
      notes: "",
      galleryId: null,
    },
  });

  const [pieceSearch, setPieceSearch] = useState("");
  const [selectedPieceIds, setSelectedPieceIds] = useState<number[]>([]);
  const [priceOverride, setPriceOverride] = useState<Record<number, string>>({});

  const galleryId = form.watch("galleryId"); // number | null

  const filteredPieces = useMemo(() => {
    let list = pieces;
    if (galleryId != null) list = list.filter((p) => p.galleryId === galleryId);
    if (pieceSearch.trim()) {
      const q = pieceSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.uniqueId ?? "").toLowerCase().includes(q) ||
          (p.dominantColor ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [pieces, galleryId, pieceSearch]);

  // si on change de galerie, on garde seulement les pièces compatibles
  useEffect(() => {
    if (galleryId == null) return;
    setSelectedPieceIds((prev) =>
      prev.filter((id) => pieces.find((p) => p.id === id)?.galleryId === galleryId)
    );
  }, [galleryId, pieces]);

  const toggleSelect = (id: number) => {
    setSelectedPieceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  //  mutations 
  // crée l’ordre puis ses items
  const createOrderMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // 1) créer la commande pour récupérer l'id
      const payload = {
        orderNumber: data.orderNumber,
        status: data.status,
        galleryId: data.galleryId ?? null,
        // normaliser champs optionnels
        shippingAddress: data.shippingAddress?.trim() ? data.shippingAddress : null,
        notes: data.notes?.trim() ? data.notes : null,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const createdOrder: { id: number } = await res.json();

      // 2) créer les order-items pour chaque pièce sélectionnée
      const itemsBody = selectedPieceIds.map((pieceId) => {
        const piece = pieces.find((p) => p.id === pieceId);
        // prix = override si saisi, sinon piece.price si présent, sinon "0"
        const price =
          priceOverride[pieceId] ??
          (piece?.price != null ? String(piece.price) : "0");
        return {
          orderId: createdOrder.id,
          pieceId,
          price,
        };
      });

      // on envoie en parallèle
      await Promise.all(
        itemsBody.map((b) =>
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

      return createdOrder;
    },
    onSuccess: () => {
      // rafraîchir les listes
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Succès", description: "Commande créée avec ses pièces." });
      form.reset();
      setSelectedPieceIds([]);
      setPriceOverride({});
      onSuccess?.();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue lors de la création.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // générer automatiquement un numéro si vide
    const withNumber = {
      ...data,
      orderNumber: data.orderNumber?.trim()
        ? data.orderNumber
        : `CMD-${Date.now()}`,
    };
    createOrderMutation.mutate(withNumber);
  };


 return (
    <div className="flex max-h-[85vh] flex-col">
      {/* Header sticky */}
      <DialogHeader className="sticky top-0 z-10 border-b bg-white/80 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <DialogTitle>Nouvelle commande</DialogTitle>
      </DialogHeader>

      <Form {...form}>
        {/* Corps scrollable */}
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        >
          {/* Entête commande */}
          <FormField
            control={form.control}
            name="orderNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro de commande</FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Galerie liée */}
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

          {/* Statut & total (affichage) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
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

            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant total (€)</FormLabel>
                  <FormControl>
                    <Input disabled type="number" step="0.01" placeholder="Calculé automatiquement" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Le total est recalculé côté serveur selon les items.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Adresse / notes */}
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
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea placeholder="Instructions, remarques..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sélecteur de pièces */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Ajouter des pièces</h4>
              <Input
                value={pieceSearch}
                onChange={(e) => setPieceSearch(e.target.value)}
                placeholder="Rechercher une pièce (nom, UID, couleur)..."
                className="max-w-xs"
              />
            </div>

            {/* Liste scrollable indépendante */}
            <div className="h-60 overflow-auto rounded-md border p-2 space-y-1">
              {filteredPieces.length === 0 ? (
                <div className="px-1 py-2 text-sm text-muted-foreground">
                  Aucune pièce disponible avec ces filtres.
                </div>
              ) : (
                filteredPieces.map((p) => {
                  const checked = selectedPieceIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer items-center justify-between rounded px-2 py-1 ${
                        checked ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={checked} onChange={() => toggleSelect(p.id)} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
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
                          className="h-8 w-28"
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

            {selectedPieceIds.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedPieceIds.length} pièce(s) sélectionnée(s).
              </div>
            )}
          </div>

          {/* Footer sticky */}
          <div className="sticky bottom-0 -mx-6 mt-6 border-t bg-white/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onSuccess?.()}>
                Annuler
              </Button>
              <Button type="submit" disabled={createOrderMutation.isPending}>
                {createOrderMutation.isPending ? "Création..." : "Créer la commande"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
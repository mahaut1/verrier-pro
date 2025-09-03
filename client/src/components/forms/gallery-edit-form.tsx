import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { insertGallerySchema, type Gallery, type Piece } from "@shared/schema";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Image as ImageIcon } from "lucide-react";

const formSchema = insertGallerySchema.extend({
  // commissionRate reste manipulé en string côté formulaire
  commissionRate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;


interface GalleryEditFormProps {
  gallery: Gallery;
  onSuccess?: () => void;
}

export default function GalleryEditForm({ gallery, onSuccess }: GalleryEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // helper: convertit "" -> null, garde string sinon
  const toNull = (v: string | null | undefined) =>
    v == null || v.trim() === "" ? null : v;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: gallery.name,
      address: gallery.address ?? "",
      contactPerson: gallery.contactPerson ?? "",
      email: gallery.email ?? "",
      phone: gallery.phone ?? "",
      city: gallery.city ?? "",
      country: gallery.country ?? "",
      commissionRate: gallery.commissionRate ?? "",
      notes: gallery.notes ?? "",
      isActive: gallery.isActive,
    },
  });

  const updateGalleryMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        address: toNull(data.address),
        contactPerson: toNull(data.contactPerson),
        email: toNull(data.email),
        phone: toNull(data.phone),
        city: toNull(data.city),
        country: toNull(data.country),
        notes: toNull(data.notes),
        commissionRate: toNull(data.commissionRate),
        isActive: data.isActive,
      };
      await apiRequest("PATCH", `/api/galleries/${gallery.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/galleries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Succès", description: "La galerie a été modifiée avec succès." });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier la galerie.",
        variant: "destructive",
      });
    },
  });

   // Pièces déjà rattachées à cette galerie
  const { data: galleryPieces = [], isLoading: loadingGalleryPieces } = useQuery<Piece[]>({
    queryKey: ["/api/pieces", "gallery", gallery.id],
    queryFn: async () => {
      const r = await fetch(`/api/pieces?galleryId=${gallery.id}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 10_000,
  });

  // Toutes les pièces (pour construire la liste "ajoutables")
  const { data: allPieces = [] } = useQuery<Piece[]>({
    queryKey: ["/api/pieces", "all"],
    queryFn: async () => {
      const r = await fetch(`/api/pieces`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 10_000,
  });

  const alreadyIn = useMemo(() => new Set(galleryPieces.map(p => p.id)), [galleryPieces]);

  const [search, setSearch] = useState("");
  const [selectedPieceIds, setSelectedPieceIds] = useState<number[]>([]);

  // Ici on autorise l’ajout uniquement des pièces non rattachées (galleryId == null)
  const addablePieces = useMemo(() => {
    let list = allPieces.filter(p => !alreadyIn.has(p.id) && (p.galleryId == null));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.uniqueId ?? "").toLowerCase().includes(q) ||
        (p.dominantColor ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allPieces, alreadyIn, search]);

  useEffect(() => {
    // garde la sélection cohérente si la liste change
    setSelectedPieceIds(prev => prev.filter(id => addablePieces.some(p => p.id === id)));
  }, [addablePieces]);

  const toggleSelect = (id: number) => {
    setSelectedPieceIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const addPiecesMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        selectedPieceIds.map((id) =>
          fetch(`/api/pieces/${id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ galleryId: gallery.id }),
          }).then(async (r) => {
            if (!r.ok) throw new Error(await r.text());
          })
        )
      );
    },
    onSuccess: () => {
      setSelectedPieceIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/pieces", "gallery", gallery.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pieces", "all"] });
      toast({ title: "Succès", description: "Pièce(s) ajoutée(s) à la galerie." });
    },
    onError: (e: any) =>
      toast({
        title: "Erreur",
        description: e?.message || "Ajout impossible.",
        variant: "destructive",
      }),
  });

  const removePieceMutation = useMutation({
    mutationFn: async (pieceId: number) => {
      const r = await fetch(`/api/pieces/${pieceId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ galleryId: null }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pieces", "gallery", gallery.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pieces", "all"] });
      toast({ title: "Pièce retirée", description: "La liste a été mise à jour." });
    },
    onError: (e: any) =>
      toast({
        title: "Erreur",
        description: e?.message || "Suppression impossible.",
        variant: "destructive",
      }),
  });

 const updatePieceSoldMutation = useMutation({
  mutationFn: async ({ id, sold }: { id: number; sold: boolean }) => {
    const r = await fetch(`/api/pieces/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: sold ? "sold" : "" }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/pieces", "gallery", gallery.id] });
    queryClient.invalidateQueries({ queryKey: ["/api/pieces", "all"] });
  },
  onError: (e: any) =>
    toast({
      title: "Erreur",
      description: e?.message || "Mise à jour impossible.",
      variant: "destructive",
    }),
});


return (
  <div className="flex max-h-[85vh] flex-col overflow-hidden">
    {/* Header compact */}
    <DialogHeader className="sticky top-0 z-10 border-b bg-white/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <DialogTitle>Modifier la galerie</DialogTitle>
    </DialogHeader>

    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => updateGalleryMutation.mutate(data))}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4"
      >
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de la galerie</FormLabel>
                <FormControl>
                  <Input placeholder="Galerie d'Art Moderne" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Personne de contact</FormLabel>
                <FormControl>
                  <Input placeholder="Marie Dubois" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contact@galerie.fr" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input placeholder="01 23 45 67 89" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse</FormLabel>
                <FormControl>
                  <Input placeholder="123 Rue de l'Art" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ville</FormLabel>
                  <FormControl>
                    <Input placeholder="Paris" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pays</FormLabel>
                  <FormControl>
                    <Input placeholder="France" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="commissionRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Taux de commission (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="30.00" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div>
                  <FormLabel className="text-base">Galerie active</FormLabel>
                  <div className="text-sm text-muted-foreground">Cette galerie est-elle active ?</div>
                </div>
                <FormControl>
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
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
                  <Textarea placeholder="Notes additionnelles..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Pièces de la galerie</h4>
            <Badge variant="secondary">{galleryPieces.length}</Badge>
          </div>

          {loadingGalleryPieces ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6" />
              <Skeleton className="h-6 w-4/6" />
            </div>
          ) : galleryPieces.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune pièce pour le moment.</div>
          ) : (
            <ul className="divide-y rounded-md border">
              {galleryPieces.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-2">
                  {/* vignette + infos */}
                  <div className="flex items-center gap-3 min-w-0">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="h-12 w-16 rounded object-cover border" />
                    ) : (
                      <div className="h-12 w-16 rounded border bg-gray-50 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        UID: {p.uniqueId ?? "—"} {p.status ? `• ${p.status}` : ""}
                      </div>
                    </div>
                  </div>

                  {/* actions : Vendue + prix + Retirer */}
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={p.status === "sold"}
                        onChange={(e) => updatePieceSoldMutation.mutate({ id: p.id, sold: e.target.checked })}
                      />
                      Vendue
                    </label>
                    <div className="text-sm font-medium">{p.price != null ? `${p.price} €` : "—"}</div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removePieceMutation.mutate(p.id)}
                      disabled={removePieceMutation.isPending}
                    >
                      Retirer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ------- Ajouter des pièces ------- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Ajouter des pièces</h4>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (nom, UID, couleur)…"
              className="max-w-xs"
            />
          </div>

          <div className="h-60 overflow-auto rounded-md border p-2 space-y-1.5">
            {addablePieces.length === 0 ? (
              <div className="px-1 py-2 text-sm text-muted-foreground">Aucune pièce disponible avec ces filtres.</div>
            ) : (
              addablePieces.map((p) => {
                const checked = selectedPieceIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 ${
                      checked ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="h-10 w-14 rounded object-cover border" />
                      ) : (
                        <div className="h-10 w-14 rounded border bg-gray-50 flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <input type="checkbox" className="mt-0.5" checked={checked} onChange={() => toggleSelect(p.id)} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          UID: {p.uniqueId}
                          {p.status ? ` • ${p.status}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-sm">{p.price != null ? `${p.price} €` : "—"}</div>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => addPiecesMutation.mutate()}
              disabled={selectedPieceIds.length === 0 || addPiecesMutation.isPending}
            >
              {addPiecesMutation.isPending ? "Ajout…" : `Ajouter ${selectedPieceIds.length} pièce(s)`}
            </Button>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 mt-4 border-t bg-white/80 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onSuccess?.()}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateGalleryMutation.isPending}>
              {updateGalleryMutation.isPending ? "Modification..." : "Modifier"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  </div>
);


}
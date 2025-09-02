import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { insertEventSchema, type Event as EventType, type Piece } from "@shared/schema";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/useToast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

/* ---------------- utils date ---------------- */
function toDateInputValue(d?: Date) {
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function fromDateInputValue(v: string) {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/* ---------------- schéma ---------------- */
const formSchema = insertEventSchema.extend({
  participationFee: z.string().optional(),
  startDate: z.date(),
  endDate: z.date().optional(),
});
type FormData = z.infer<typeof formSchema>;

/* Ligne event_pieces enrichie */
type EventPieceRow = {
  id: number;
  eventId: number | null;
  pieceId: number | null;
  displayPrice: string | null;
  sold: boolean;
  createdAt: string | Date | null;
  pieceName: string | null;
  pieceUniqueId: string | null;
  pieceStatus: string | null;
  piecePrice: string | null;
};

interface Props {
  event: EventType;
  onSuccess?: () => void;
}

export default function EventEditForm({ event, onSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: event.name,
      type: event.type as any,
      status: (event.status as any) ?? "planned",
      venue: event.venue ?? "",
      description: event.description ?? "",
      website: event.website ?? "",
      participationFee: (event.participationFee as any) ?? "",
      notes: event.notes ?? "",
      startDate: event.startDate ? new Date(event.startDate) : new Date(),
      endDate: event.endDate ? new Date(event.endDate) : undefined,
    },
  });

  /* ---------------- requêtes ---------------- */
  const { data: pieces = [] } = useQuery<Piece[]>({
    queryKey: ["/api/pieces"],
    queryFn: async () => {
      const r = await fetch("/api/pieces", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const { data: eventPieces = [] } = useQuery<EventPieceRow[]>({
    queryKey: ["/api/events", event.id, "pieces"],
    queryFn: async () => {
      const r = await fetch(`/api/events/${event.id}/pieces`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  /* ---------------- sélection/ajout ---------------- */
  const alreadyInEvent = useMemo(
    () => new Set((eventPieces ?? []).map((row) => row.pieceId!).filter(Boolean) as number[]),
    [eventPieces]
  );

  const [search, setSearch] = useState("");
  const [selectedPieceIds, setSelectedPieceIds] = useState<number[]>([]);
  const [priceOverride, setPriceOverride] = useState<Record<number, string>>({});

  const addablePieces = useMemo(() => {
    let list = pieces.filter((p) => !alreadyInEvent.has(p.id));
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
  }, [pieces, alreadyInEvent, search]);

  useEffect(() => {
    setSelectedPieceIds((prev) => prev.filter((id) => addablePieces.some((p) => p.id === id)));
  }, [addablePieces]);

  const toggleSelect = (id: number) => {
    setSelectedPieceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  /* ---------------- mutations ---------------- */
  const updateEventMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        participationFee: data.participationFee?.trim() ? data.participationFee : null,
        venue: data.venue?.trim() ? data.venue : null,
        description: data.description?.trim() ? data.description : null,
        website: data.website?.trim() ? data.website : null,
        notes: data.notes?.trim() ? data.notes : null,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate ? data.endDate.toISOString() : null,
      };
      return apiRequest("PATCH", `/api/events/${event.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Succès", description: "Événement modifié." });
      onSuccess?.();
    },
    onError: (e: any) =>
      toast({
        title: "Erreur",
        description: e?.message || "Modification impossible.",
        variant: "destructive",
      }),
  });

  const addPiecesMutation = useMutation({
    mutationFn: async () => {
      const bodies = selectedPieceIds.map((pieceId) => {
        const p = pieces.find((x) => x.id === pieceId);
        const price = priceOverride[pieceId] ?? (p?.price != null ? String(p.price) : "0");
        return { pieceId, displayPrice: price };
      });

      await Promise.all(
        bodies.map((b) =>
          fetch(`/api/events/${event.id}/pieces`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/events", event.id, "pieces"] });
      toast({ title: "Succès", description: "Pièces ajoutées à l’événement." });
    },
    onError: (e: any) =>
      toast({
        title: "Erreur",
        description: e?.message || "Ajout impossible.",
        variant: "destructive",
      }),
  });

  const deleteEventPieceMutation = useMutation({
    mutationFn: async (eventPieceId: number) => {
      const r = await fetch(`/api/event-pieces/${eventPieceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", event.id, "pieces"] });
      toast({ title: "Pièce retirée", description: "La liste a été mise à jour." });
    },
    onError: (e: any) =>
      toast({
        title: "Erreur",
        description: e?.message || "Suppression impossible.",
        variant: "destructive",
      }),
  });

  const updateEventPieceMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<{ displayPrice: string | null; sold: boolean }> }) => {
      const r = await fetch(`/api/event-pieces/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", event.id, "pieces"] });
    },
    onError: (e: any) =>
      toast({
        title: "Erreur",
        description: e?.message || "Mise à jour impossible.",
        variant: "destructive",
      }),
  });

  /* ---------------- submit ---------------- */
  const onSubmit = (data: FormData) => updateEventMutation.mutate(data);

  return (
    <div className="flex max-h-[85vh] flex-col overflow-hidden">
      <DialogHeader className="sticky top-0 z-10 border-b bg-white/80 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <DialogTitle>Modifier l’événement</DialogTitle>
        <DialogDescription className="sr-only">Formulaire d’édition d’événement</DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Nom</FormLabel>
                <FormControl>
                  <Input className="h-10" placeholder="Nom de l’événement" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="exhibition">Exposition</SelectItem>
                      <SelectItem value="fair">Salon / Foire</SelectItem>
                      <SelectItem value="workshop">Atelier</SelectItem>
                      <SelectItem value="sale">Vente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planned">Planifié</SelectItem>
                      <SelectItem value="confirmed">Confirmé</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="venue"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Lieu</FormLabel>
                <FormControl>
                  <Input className="h-10" placeholder="Lieu" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* dates (natifs) */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Début</FormLabel>
                  <FormControl>
                    <input
                      type="date"
                      className="h-10 w-full rounded border px-3"
                      value={toDateInputValue(field.value)}
                      onChange={(e) => field.onChange(fromDateInputValue(e.target.value) ?? field.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Fin (optionnel)</FormLabel>
                  <FormControl>
                    <input
                      type="date"
                      className="h-10 w-full rounded border px-3"
                      value={toDateInputValue(field.value)}
                      min={toDateInputValue(form.getValues("startDate"))}
                      onChange={(e) => field.onChange(fromDateInputValue(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea className="min-h-24" placeholder="Description…" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Site web</FormLabel>
                  <FormControl>
                    <Input className="h-10" type="url" placeholder="https://…" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="participationFee"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Frais de participation (€)</FormLabel>
                  <FormControl>
                    <Input
                      className="h-10"
                      type="number"
                      step="0.01"
                      placeholder="250.00"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Notes privées</FormLabel>
                <FormControl>
                  <Textarea className="min-h-24" placeholder="Notes…" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ---------- Pièces de l'événement ---------- */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Pièces de l’événement</h4>
              <Badge variant="secondary">{eventPieces.length}</Badge>
            </div>

            {eventPieces.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune pièce pour le moment.</div>
            ) : (
              <ul className="divide-y rounded-md border">
                {eventPieces.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-4 p-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {row.pieceName ?? `Pièce #${row.pieceId}`}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        UID: {row.pieceUniqueId ?? "—"} {row.pieceStatus ? `• ${row.pieceStatus}` : ""}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 w-28"
                        type="number"
                        step="0.01"
                        value={row.displayPrice ?? ""}
                        placeholder="Prix (€)"
                        onChange={(e) =>
                          updateEventPieceMutation.mutate({
                            id: row.id,
                            patch: { displayPrice: e.target.value },
                          })
                        }
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!row.sold}
                          onChange={(e) =>
                            updateEventPieceMutation.mutate({
                              id: row.id,
                              patch: { sold: e.target.checked },
                            })
                          }
                        />
                        Vendue
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteEventPieceMutation.mutate(row.id)}
                        disabled={deleteEventPieceMutation.isPending}
                      >
                        Retirer
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------- Ajouter des pièces ---------- */}
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

            <div className="h-60 overflow-auto rounded-md border p-2 space-y-1">
              {addablePieces.length === 0 ? (
                <div className="px-1 py-2 text-sm text-muted-foreground">
                  Aucune pièce disponible avec ces filtres.
                </div>
              ) : (
                addablePieces.map((p) => {
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
                          className="h-8 w-28"
                          type="number"
                          step="0.01"
                          placeholder="—"
                          disabled={!checked}
                          value={priceOverride[p.id] ?? (p.price != null ? String(p.price) : "")}
                          onChange={(e) => setPriceOverride((prev) => ({ ...prev, [p.id]: e.target.value }))}
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
                onClick={() => addPiecesMutation.mutate()}
                disabled={selectedPieceIds.length === 0 || addPiecesMutation.isPending}
              >
                {addPiecesMutation.isPending ? "Ajout…" : `Ajouter ${selectedPieceIds.length} pièce(s)`}
              </Button>
            </div>
          </div>

          {/* footer */}
          <div className="sticky bottom-0 -mx-6 mt-6 border-t bg-white/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onSuccess?.()}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateEventMutation.isPending}>
                {updateEventMutation.isPending ? "Modification…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

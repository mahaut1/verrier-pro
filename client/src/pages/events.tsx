import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar as CalIcon, Edit, Trash2, ChevronDown, ChevronUp, Tag } from "lucide-react";
import EventForm from "../components/forms/event-form";
import EventEditForm from "../components/forms/event-edit-form";
import { useToast } from "../hooks/useToast";
import { apiRequest } from "../lib/queryClient";
import type { Event } from "@shared/schema";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

console.log("Events v2")
function statusTone(s: string) {
  switch (s) {
    case "planned": return "bg-blue-100 text-blue-800";
    case "confirmed": return "bg-emerald-100 text-emerald-800";
    case "completed": return "bg-gray-100 text-gray-800";
    case "cancelled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}
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
  pieceImageUrl: string | null;
};

function EventPiecesList({ eventId, open }: { eventId: number; open: boolean }) {
  const { data: rows = [], isLoading } = useQuery<EventPieceRow[]>({
    queryKey: ["/api/events", eventId, "pieces"],
    queryFn: () => getJson<EventPieceRow[]>(`/api/events/${eventId}/pieces`),
    enabled: open,
    staleTime: 10_000,
  });

  if (!open) return null;

  return (
    <div className="mt-4 rounded-lg border bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Tag className="h-4 w-4" />
        Pièces associées
        <Badge variant="secondary" className="ml-2">
          {rows.length}
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-6 w-4/6" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500">Aucune pièce sur cet événement.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const price =
              row.displayPrice && row.displayPrice !== ""
                ? row.displayPrice
                : row.piecePrice && row.piecePrice !== ""
                ? row.piecePrice
                : null;

            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-md bg-white p-2"
              >
                {/* Gauche : vignette + infos */}
                <div className="flex items-center gap-3 min-w-0">
                  {row.pieceImageUrl ? (
                    <img
                      src={row.pieceImageUrl}
                      alt={row.pieceName ?? `Pièce #${row.pieceId}`}
                      className="h-12 w-16 rounded object-cover border"
                    />
                  ) : (
                    <div className="h-12 w-16 rounded border bg-gray-50" />
                  )}

                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {row.pieceName ?? `Pièce #${row.pieceId}`}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      UID: {row.pieceUniqueId ?? "—"}
                      {row.pieceStatus ? ` • ${row.pieceStatus}` : ""}
                    </div>
                  </div>
                </div>

                {/* Droite : badge vendue + prix */}
                <div className="flex items-center gap-2 shrink-0">
                  {row.sold && (
                    <span className="rounded px-2 py-0.5 text-xs bg-amber-100 text-amber-800">
                      Vendue
                    </span>
                  )}
                  <div className="text-sm font-medium">{price ? `${price} €` : "—"}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
export default function Events() {
  const [openDialog, setOpenDialog] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch("/api/events", { credentials: "include" });
      if (!res.ok) throw new Error("Impossible de charger les événements");
      return res.json();
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Succès", description: "Événement supprimé." });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Suppression impossible.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 gap-6">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

 return (
    <div className="py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-blue-600 sm:text-3xl sm:truncate">Événements</h2>
            <p className="mt-1 text-sm text-blue-600">Gérez vos expositions, salons, ateliers…</p>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="-ml-1 mr-2 h-5 w-5" />
                  Nouvel événement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl p-0">
                <EventForm onSuccess={() => setOpenDialog(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {events.length === 0 ? (
            <div className="py-12 text-center">
              <CalIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun événement</h3>
              <p className="mt-1 text-sm text-gray-500">Créez votre premier événement pour commencer.</p>
            </div>
          ) : (
            events.map((ev) => {
              const isOpen = !!expanded[ev.id];
              return (
                <Card key={ev.id} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{ev.name}</CardTitle>
                        <div className="mt-1 text-xs text-gray-500">
                          {ev.venue && (
                            <span>
                              <strong>Lieu :</strong> {ev.venue} •{" "}
                            </span>
                          )}
                          {ev.startDate && (
                            <span>
                              <strong>Date :</strong>{" "}
                              {new Date(ev.startDate).toLocaleDateString()}
                              {ev.endDate
                                ? ` → ${new Date(ev.endDate).toLocaleDateString()}`
                                : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Badge className={statusTone(ev.status)}>{ev.status}</Badge>

                        <Dialog
                          open={editEvent?.id === ev.id}
                          onOpenChange={(open) => !open && setEditEvent(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditEvent(ev)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl p-0">
                            {editEvent && editEvent.id === ev.id && (
                              <EventEditForm
                                event={editEvent}
                                onSuccess={() => setEditEvent(null)}
                              />
                            )}
                          </DialogContent>
                        </Dialog>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteEventMutation.mutate(ev.id)}
                          disabled={deleteEventMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 p-6">
                    {ev.description && (
                      <p className="text-sm text-gray-700">{ev.description}</p>
                    )}

                    <div className="pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpanded((s) => ({ ...s, [ev.id]: !s[ev.id] }))
                        }
                      >
                        {isOpen ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Masquer les pièces
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            Voir les pièces
                          </>
                        )}
                      </Button>

                      <EventPiecesList eventId={ev.id} open={isOpen} />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
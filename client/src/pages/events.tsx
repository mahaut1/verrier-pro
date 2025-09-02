import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar as CalIcon, Edit, Trash2 } from "lucide-react";
import EventForm from "../components/forms/event-form";
import EventEditForm from "../components/forms/event-edit-form";
import { useToast } from "../hooks/useToast";
import { apiRequest } from "../lib/queryClient";
import type { Event } from "@shared/schema";

function statusTone(s: string) {
  switch (s) {
    case "planned": return "bg-blue-100 text-blue-800";
    case "confirmed": return "bg-emerald-100 text-emerald-800";
    case "completed": return "bg-gray-100 text-gray-800";
    case "cancelled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

export default function Events() {
  const [openDialog, setOpenDialog] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
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

        <div className="mt-8">
          {events.length === 0 ? (
            <div className="py-12 text-center">
              <CalIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun événement</h3>
              <p className="mt-1 text-sm text-gray-500">Créez votre premier événement pour commencer.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {events.map((ev) => (
                <Card key={ev.id} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="truncate">{ev.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={statusTone(ev.status)}>{ev.status}</Badge>
                        <Dialog open={editEvent?.id === ev.id} onOpenChange={(open) => !open && setEditEvent(null)}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setEditEvent(ev)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl p-0">
                            {editEvent && editEvent.id === ev.id && (
                              <EventEditForm event={editEvent} onSuccess={() => setEditEvent(null)} />
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
                  <CardContent className="space-y-2 p-6">
                    {ev.description && <p className="text-sm text-gray-700">{ev.description}</p>}
                    {ev.venue && <p className="text-sm"><strong>Lieu :</strong> {ev.venue}</p>}
                    {ev.startDate && (
                      <p className="text-sm">
                        <strong>Date :</strong>{" "}
                        {new Date(ev.startDate).toLocaleDateString()}
                        {ev.endDate ? ` → ${new Date(ev.endDate).toLocaleDateString()}` : ""}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

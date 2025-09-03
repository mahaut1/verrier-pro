import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Building, MapPin, Phone, Mail, Edit, Trash2, ChevronDown, ChevronUp, Box, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import GalleryForm from "../components/forms/gallery-form";
import GalleryEditForm from "../components/forms/gallery-edit-form";
import { useToast } from "../hooks/useToast";
import { apiRequest } from "../lib/queryClient";
import type { Gallery, Piece } from "@shared/schema";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


function GalleryPiecesList({ galleryId, open }: { galleryId: number; open: boolean }) {
  const { data: pieces = [], isLoading } = useQuery<Piece[]>({
    queryKey: ["/api/pieces", "gallery", galleryId],
    queryFn: () => getJson<Piece[]>(`/api/pieces?galleryId=${galleryId}`),
    enabled: open, 
  });
  if (!open) return null;

  return (
    <div className="mt-4 rounded-lg border bg-gray-50 p-3">
      <div className="text-sm font-semibold mb-2">Pièces exposées/associées</div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-6 w-4/6" />
        </div>
      ) : pieces.length === 0 ? (
        <div className="text-sm text-gray-500">Aucune pièce pour cette galerie.</div>
      ) : (
        <ul className="space-y-2">
 {pieces.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-md bg-white p-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-12 w-16 rounded object-cover border"
                  />
                ) : (
                  <div className="h-12 w-16 rounded border bg-gray-50 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-gray-400" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate text-xs text-gray-500">
                    UID: {p.uniqueId ?? "—"}{p.status ? ` • ${p.status}` : ""}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-sm font-medium">
                {p.price != null && p.price !== "" ? `${p.price} €` : "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Galleries() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [editGallery, setEditGallery] = useState<Gallery | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: galleries = [], isLoading } = useQuery<Gallery[]>({
    queryKey: ["/api/galleries"],
    queryFn: () => getJson<Gallery[]>("/api/galleries"),
  });

    // Toutes les pièces (pour le compteur & l’aperçu)
  const { data: allPieces = [] } = useQuery<Piece[]>({
    queryKey: ["/api/pieces", "all"],
    queryFn: () => getJson<Piece[]>("/api/pieces"),
    staleTime: 10_000,
  });

  // Compte par galerie
  const countByGallery = useMemo(() => {
    const m: Record<number, number> = {};
    for (const p of allPieces) {
      if (p.galleryId != null) m[p.galleryId] = (m[p.galleryId] ?? 0) + 1;
    }
    return m;
  }, [allPieces]);


  const filtered = searchQuery.trim()
    ? galleries.filter((g) => {
        const q = searchQuery.toLowerCase();
        return (
          g.name.toLowerCase().includes(q) ||
          (g.contactPerson ?? "").toLowerCase().includes(q) ||
          (g.city ?? "").toLowerCase().includes(q) ||
          (g.country ?? "").toLowerCase().includes(q)
        );
      })
    : galleries;

  const deleteGalleryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/galleries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/galleries"] });
      toast({
        title: "Succès",
        description: "La galerie a été supprimée avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-64" />
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
        {/* header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-blue-600 sm:text-3xl sm:truncate">
              Galeries partenaires
            </h2>
            <p className="text-sm text-blue-600 mt-1">Gérez vos partenaires</p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="-ml-1 mr-2 h-5 w-5" />
                  Nouvelle galerie
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <GalleryForm onSuccess={() => setOpenDialog(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* search */}
        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Rechercher une galerie..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* list */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Building className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune galerie</h3>
              <p className="mt-1 text-sm text-gray-500">Commencez par ajouter votre première galerie partenaire.</p>
            </div>
          ) : (
            filtered.map((gallery) => {
              const isOpen = !!expanded[gallery.id];
              const preview = allPieces.filter((p) => p.galleryId === gallery.id).slice(0, 3);
              const extra = Math.max(0, (countByGallery[gallery.id] ?? 0) - preview.length);

              return (
                <Card key={gallery.id} className="h-full flex flex-col">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{gallery.name}</CardTitle>
                      <Badge variant={gallery.isActive ? "default" : "secondary"}>
                        {gallery.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-3 grow">
                    {/* infos */}
                    <div className="space-y-2">
                      {gallery.contactPerson && <p className="text-sm text-gray-600">{gallery.contactPerson}</p>}
                      {gallery.address && (
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin className="h-4 w-4 mr-2" />
                          {gallery.address}
                        </div>
                      )}
                      {gallery.phone && (
                        <div className="flex items-center text-sm text-gray-500">
                          <Phone className="h-4 w-4 mr-2" />
                          {gallery.phone}
                        </div>
                      )}
                      {gallery.email && (
                        <div className="flex items-center text-sm text-gray-500">
                          <Mail className="h-4 w-4 mr-2" />
                          {gallery.email}
                        </div>
                      )}
                      {gallery.commissionRate && (
                        <p className="text-sm text-gray-600">Commission: {gallery.commissionRate}%</p>
                      )}
                    </div>

                    {/* aperçu rapide */}
                    <div className="text-xs text-gray-500">
                      Pièces: <span className="font-medium">{countByGallery[gallery.id] ?? 0}</span>
                      {preview.length > 0 && (
                        <ul className="mt-1 mb-2 text-sm text-gray-700 list-disc pl-5">
                          {preview.map((p) => (
                            <li key={p.id}>{p.name}</li>
                          ))}
                          {extra > 0 && <li className="text-gray-500">+ {extra} autres…</li>}
                        </ul>
                      )}
                    </div>

                    {/* actions */}
                    <div className="mt-1 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setEditGallery(gallery)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteGalleryMutation.mutate(gallery.id)}
                        disabled={deleteGalleryMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* section pièces tout en bas */}
                    <div className="mt-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpanded((s) => ({ ...s, [gallery.id]: !s[gallery.id] }))
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
                            Voir les pièces ({countByGallery[gallery.id] ?? 0})
                          </>
                        )}
                      </Button>

                      <GalleryPiecesList galleryId={gallery.id} open={isOpen} />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {editGallery && (
          <Dialog open={!!editGallery} onOpenChange={() => setEditGallery(null)}>
            <DialogContent className="max-w-2xl">
              <GalleryEditForm gallery={editGallery} onSuccess={() => setEditGallery(null)} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
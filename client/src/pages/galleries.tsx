import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Building, MapPin, Phone, Mail, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import GalleryForm from "../components/forms/gallery-form";
import GalleryEditForm from "../components/forms/gallery-edit-form";
import { useToast } from "../hooks/useToast";
import { apiRequest } from "../lib/queryClient";
import type { Gallery, Piece } from "@shared/schema";

export default function Galleries() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [editGallery, setEditGallery] = useState<Gallery | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: galleries = [], isLoading } = useQuery<Gallery[]>({
  queryKey: ["/api/galleries"],
  queryFn: async () => {
    const res = await fetch("/api/galleries", {
      credentials: "include", 
    });
    if (!res.ok) throw new Error("Impossible de charger les galeries");
    return res.json();
  },
});


  const { data: pieces = [] } = useQuery({
    queryKey: ["/api/pieces"],
  });

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
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Galeries partenaires
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Gérez vos partenaires et expositions
            </p>
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

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {galleries.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Building className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune galerie</h3>
              <p className="mt-1 text-sm text-gray-500">
                Commencez par ajouter votre première galerie partenaire.
              </p>
            </div>
          ) : (
            galleries.map((gallery: Gallery) => (
              <Card key={gallery.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{gallery.name}</CardTitle>
                    <Badge variant={gallery.isActive ? "default" : "secondary"}>
                      {gallery.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {gallery.contactPerson && (
                      <p className="text-sm text-gray-600">{gallery.contactPerson}</p>
                    )}
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
                      <p className="text-sm text-gray-600">
                        Commission: {gallery.commissionRate}%
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex space-x-2">
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
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {editGallery && (
          <Dialog open={!!editGallery} onOpenChange={() => setEditGallery(null)}>
            <DialogContent className="max-w-2xl">
              <GalleryEditForm
                gallery={editGallery}
                onSuccess={() => setEditGallery(null)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
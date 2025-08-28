import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Box, MapPin, Calendar, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "../hooks/useToast";
import { apiRequest } from "../lib/queryClient";
import type { Piece, Gallery } from "@shared/schema";
import PieceForm from "../components/forms/piece-form";
import PieceEditForm from "../components/forms/piece-edit-form";
import NewPieceTypeForm from "../components/forms/new_piece_type_form";
import {resolveImageUrl} from '../lib/images'

type PieceWithType = Piece & { pieceType?: { id: number; name: string } | null };

function getStatusColor(status: string) {
  switch (status) {
    case "workshop":
      return "bg-green-100 text-green-800";
    case "transit":
      return "bg-blue-100 text-blue-800";
    case "gallery":
      return "bg-purple-100 text-purple-800";
    case "sold":
      return "bg-gray-100 text-gray-800";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "workshop":
      return "Atelier";
    case "transit":
      return "En transit";
    case "gallery":
      return "En galerie";
    case "sold":
      return "Vendu";
    case "completed":
      return "Terminé";
    default:
      return status;
  }
}

export default function Pieces() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [editPiece, setEditPiece] = useState<PieceWithType | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

const { data: pieces = [], isLoading } = useQuery<PieceWithType[]>({
  queryKey: ["/api/pieces"],
  queryFn: async () => {
    const res = await fetch("/api/pieces", { credentials: "include" });
    if (!res.ok) throw new Error("Impossible de charger les pièces");
    return res.json(); // doit renvoyer un tableau
  },
});

  const { data: pieceTypes = [] } = useQuery({
    queryKey: ["/api/piece-types"],
    queryFn: async () => {
      const res = await fetch("/api/piece-types", { credentials: "include" });
      if (!res.ok) throw new Error("Impossible de charger les types");
      return res.json() as Promise<{ id: number; name: string }[]>;
    },
  });

const { data: galleries = [] } = useQuery({
  queryKey: ["/api/galleries"],
  queryFn: async () => {
    const res = await fetch("/api/galleries", { credentials: "include" });
    if (!res.ok) return [];
    return res.json();
  },
});

  const deletePieceMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/pieces/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pieces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Succès",
        description: "La pièce a été supprimée avec succès.",
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


  const filteredPieces = Array.isArray(pieces)
    ? pieces.filter((piece) => {
        const typeName = piece.pieceType?.name ?? "";
        const matchesSearch =
          piece.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          typeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          piece.description?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "all" || piece.status === statusFilter;

        const matchesType =
          typeFilter === "all" ||
          String(piece.pieceType?.id ?? "") === typeFilter;

        return matchesSearch && matchesStatus && matchesType;
      })
    : [];

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-96" />
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
              Gestion des pièces
            </h2>
            <p className="text-sm text-blue-600 mt-1">
              Suivez et gérez toutes vos créations artistiques
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
             <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">+ Nouveau type</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <NewPieceTypeForm />
              </DialogContent>
            </Dialog> 
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="-ml-1 mr-2 h-5 w-5" />
                  Nouvelle pièce
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <PieceForm onSuccess={() => setOpenDialog(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filtres et recherche */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Rechercher une pièce..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="workshop">Atelier</SelectItem>
              <SelectItem value="transit">En transit</SelectItem>
              <SelectItem value="gallery">En galerie</SelectItem>
              <SelectItem value="sold">Vendu</SelectItem>
              <SelectItem value="completed">Terminé</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {pieceTypes.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">Aucun type pour le moment</div>
              ) : (
                pieceTypes.map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Statistiques */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Box className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total pièces
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {filteredPieces.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grille des pièces */}
        <div className="mt-8">
          {filteredPieces.length === 0 ? (
            <div className="text-center py-12">
              <Box className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune pièce</h3>
              <p className="mt-1 text-sm text-gray-500">
                Commencez par créer votre première pièce.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPieces.map((piece: PieceWithType) => (
                <Card key={piece.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    {piece.imageUrl && (
                      <div className="aspect-w-16 aspect-h-9">
                        <img
                          key={piece.imageUrl}
                          src={resolveImageUrl(piece.imageUrl)}
                          alt={piece.name}
                          className="w-full h-48 object-cover"
                          loading="lazy"
                          onError={() => console.error("Image KO:", piece.imageUrl)}
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {piece.name}
                        </h3>
                        <Badge className={getStatusColor(piece.status)}>
                          {getStatusLabel(piece.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{piece.pieceType?.name ?? "—"}</p>
                      {piece.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {piece.description}
                        </p>
                      )}
                      <div className="mt-4 space-y-2">
                        {piece.dimensions && (
                          <div className="flex items-center text-xs text-gray-500">
                            <Box className="h-3 w-3 mr-1" />
                            {piece.dimensions}
                          </div>
                        )}
                        {piece.currentLocation && (
                          <div className="flex items-center text-xs text-gray-500">
                            <MapPin className="h-3 w-3 mr-1" />
                            {piece.currentLocation}
                          </div>
                        )}
                        <div className="flex items-center text-xs text-gray-500">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(piece.createdAt || '').toLocaleDateString()}
                        </div>
                        {piece.price && (
                          <div className="text-sm font-semibold text-gray-900">
                            {piece.price}€
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50"
                          onClick={() => setEditPiece(piece)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                            className="border-red-600 text-red-600 hover:bg-red-50"
                          variant="outline"
                          onClick={() => deletePieceMutation.mutate(piece.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Dialog d'édition */}
        {editPiece && (
          <Dialog open={!!editPiece} onOpenChange={() => setEditPiece(null)}>
            <DialogContent className="max-w-2xl">
              <PieceEditForm
                piece={editPiece}
                onSuccess={() => setEditPiece(null)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
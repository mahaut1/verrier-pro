import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { insertPieceSchema } from "@shared/schema";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {Form,FormControl,FormField,FormItem,FormLabel,FormMessage} from "@/components/ui/form";
import {DialogHeader,DialogTitle,} from "@/components/ui/dialog";

const formSchema = insertPieceSchema.extend({
  price: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PieceFormProps {
  onSuccess?: () => void;
}

export default function PieceForm({ onSuccess }: PieceFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: galleries } = useQuery({
    queryKey: ["/api/galleries"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      uniqueId: "",
      type: "",
      dimensions: "",
      dominantColor: "",
      description: "",
      status: "workshop",
      currentLocation: "atelier",
      price: "",
    },
  });

  const createPieceMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const submitData = {
        ...data,
        price: data.price ? data.price : null,
        galleryId: data.galleryId || null,
      };
      return apiRequest("POST", "/api/pieces", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pieces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Succès",
        description: "La pièce a été créée avec succès.",
      });
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la création de la pièce.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createPieceMutation.mutate(data);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Créer une nouvelle pièce</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de la pièce</FormLabel>
                <FormControl>
                  <Input placeholder="Vase Cosmos Bleu" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="uniqueId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Identifiant unique</FormLabel>
                <FormControl>
                  <Input placeholder="VCB-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="poisson_mirroir">Poisson Mirroir</SelectItem>
                      <SelectItem value="poisson_piques">Poisson Piques</SelectItem>
                      <SelectItem value="poisson_candy">Poisson Candy</SelectItem>
                      <SelectItem value="poisson_eden_roc">Poisson Eden Roc</SelectItem>
                      <SelectItem value="tortues">Tortues</SelectItem>
                      <SelectItem value="poulpes">Poulpes</SelectItem>
                      <SelectItem value="meduse">Méduse</SelectItem>
                      <SelectItem value="pez">Pez</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dominantColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Couleur dominante</FormLabel>
                  <FormControl>
                    <Input placeholder="Bleu cobalt" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="dimensions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dimensions</FormLabel>
                <FormControl>
                  <Input placeholder="H:30cm x D:15cm" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="workshop">Atelier</SelectItem>
                      <SelectItem value="transit">En transit</SelectItem>
                      <SelectItem value="gallery">En galerie</SelectItem>
                      <SelectItem value="sold">Vendue</SelectItem>
                      <SelectItem value="completed">Terminée</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prix (€)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="150.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="galleryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Galerie (optionnel)</FormLabel>
                <Select onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))} defaultValue={field.value?.toString() || "none"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une galerie" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Aucune galerie</SelectItem>
                    {(Array.isArray(galleries) ? galleries : []).map((gallery: any) => (
                      <SelectItem key={gallery.id} value={gallery.id.toString()}>
                        {gallery.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Description détaillée de la pièce..."
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onSuccess?.()}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={createPieceMutation.isPending}>
              {createPieceMutation.isPending ? "Création..." : "Créer la pièce"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}

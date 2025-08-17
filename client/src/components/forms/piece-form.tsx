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
import {DialogHeader,DialogTitle, Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import NewPieceTypeForm from "./new_piece_type_form";

const formSchema = insertPieceSchema
  .extend({
    price: z.string().optional(), 
  })
  .omit({ pieceTypeId: true })
  .extend({
    pieceTypeId: z.number().nullable().optional(), 
  });


type FormData = z.infer<typeof formSchema>;

interface PieceFormProps {
  onSuccess?: () => void;
}

export default function PieceForm({ onSuccess }: PieceFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

   const { data: galleries = [] } = useQuery({
    queryKey: ["/api/galleries"],
    queryFn: async () => {
      const res = await fetch("/api/galleries", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

    const { data: pieceTypes = [] } = useQuery({
    queryKey: ["/api/piece-types"],
    queryFn: async () => {
      const res = await fetch("/api/piece-types", { credentials: "include" });
      if (!res.ok) throw new Error("Impossible de charger les types");
      const data = await res.json();
      return data as { id: number; name: string }[];
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      uniqueId: "",
      pieceTypeId: null,
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
        pieceTypeId: data.pieceTypeId ?? null,
      };
      return apiRequest("POST", "/api/pieces", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pieces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Succès", description: "La pièce a été créée avec succès." });
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
              name="pieceTypeId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Type</FormLabel>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button" size="sm" variant="outline">+ Nouveau type</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <NewPieceTypeForm onCreated={() => {
                          queryClient.invalidateQueries({ queryKey: ["/api/piece-types"] });
                        }} />
                      </DialogContent>
                    </Dialog> 
                  </div>
                  <Select
                    onValueChange={(val) => field.onChange(val === "none" ? null : Number(val))}
                    defaultValue={field.value == null ? "none" : String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Aucun type</SelectItem>
                      {pieceTypes.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
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

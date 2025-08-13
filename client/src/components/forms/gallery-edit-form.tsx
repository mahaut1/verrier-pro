import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { insertGallerySchema, type Gallery } from "@shared/schema";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
        // commissionRate en null si vide (le backend attend probablement number|null)
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

  return (
    <>
      <DialogHeader>
        <DialogTitle>Modifier la galerie</DialogTitle>
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => updateGalleryMutation.mutate(data))}
          className="space-y-4"
        >
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

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div>
                  <FormLabel className="text-base">Galerie active</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Cette galerie est-elle active ?
                  </div>
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

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onSuccess?.()}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateGalleryMutation.isPending}>
              {updateGalleryMutation.isPending ? "Modification..." : "Modifier"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}

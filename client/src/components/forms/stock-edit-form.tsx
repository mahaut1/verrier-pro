import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { StockItem } from "@shared/schema";

/** UI-only schema (strings) */
const formSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  category: z.string().min(1),
  currentQuantity: z.string().min(1),
  unit: z.string().min(1),
  minimumThreshold: z.string().min(1),
  supplier: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface StockEditFormProps {
  item: StockItem;
  onSuccess?: () => void;
}

export default function StockEditForm({ item: stockItem, onSuccess }: StockEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: stockItem.name,
      type: stockItem.type,
      category: stockItem.category,
      currentQuantity: stockItem.currentQuantity,   // déjà string
      unit: stockItem.unit,
      minimumThreshold: stockItem.minimumThreshold, // déjà string
      supplier: stockItem.supplier || "",
      notes: stockItem.notes || "",
    },
  });

  const updateStockItemMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        supplier: data.supplier || null,
        notes: data.notes || null,
      };
      return apiRequest("PATCH", `/api/stock/items/${stockItem.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Succès", description: "L'article a été modifié." });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message ?? "Modification impossible.",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <DialogHeader><DialogTitle>Modifier l'article de stock</DialogTitle></DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => updateStockItemMutation.mutate(d))} className="space-y-4">
          <FormField name="name" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Nom de l'article</FormLabel><FormControl><Input placeholder="Verre blanc 3mm" {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <div className="grid grid-cols-2 gap-4">
            <FormField name="type" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="glass">Verre</SelectItem>
                    <SelectItem value="tools">Outils</SelectItem>
                    <SelectItem value="packaging">Emballage</SelectItem>
                    <SelectItem value="consumables">Consommables</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="category" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Catégorie</FormLabel><FormControl><Input placeholder="verre_coloré, carton…" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField name="currentQuantity" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Quantité actuelle</FormLabel><FormControl><Input type="number" step="0.01" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField name="unit" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Unité</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="units">unités</SelectItem>
                    <SelectItem value="meters">mètres</SelectItem>
                    <SelectItem value="liters">litres</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="minimumThreshold" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Seuil minimum</FormLabel><FormControl><Input type="number" step="0.01" placeholder="5" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>

          <FormField name="supplier" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Fournisseur</FormLabel><FormControl><Input placeholder="Verrerie Dubois" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField name="notes" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Notes…" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
          )} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onSuccess?.()}>Annuler</Button>
            <Button type="submit" disabled={updateStockItemMutation.isPending}>
              {updateStockItemMutation.isPending ? "Modification..." : "Modifier l'article"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}

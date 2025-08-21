import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { insertStockItemSchema, insertStockMovementSchema, type StockItem } from "@shared/schema";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage,} from "@/components/ui/form";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ---- Schémas Zod ----
const newItemSchema = insertStockItemSchema;
type NewItemInput  = z.input<typeof newItemSchema>;   
type NewItemOutput = z.output<typeof newItemSchema>;  

const movementSchema = insertStockMovementSchema.extend({
  stockItemId: z.number(),
});
type MovementInput  = z.input<typeof movementSchema>;
type MovementOutput = z.output<typeof movementSchema>;

export default function StockForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

 const { data: stockItems = [] } = useQuery<StockItem[]>({
  queryKey: ["/api/stock/items"],
  queryFn: async () => {
    const res = await fetch("/api/stock/items", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Impossible de charger les stocks");
    return res.json();
  },
});


  const newItemForm = useForm<NewItemInput>({
  resolver: zodResolver<NewItemInput, unknown, NewItemOutput>(newItemSchema),
  defaultValues: {
    name: "", type: "", category: "",
    currentQuantity: "0", unit: "", minimumThreshold: "0",
    supplier: null, notes: null,
  },
});

const movementForm = useForm<MovementInput>({
  resolver: zodResolver<MovementInput, unknown, MovementOutput>(movementSchema),
  defaultValues: {
    stockItemId: undefined as unknown as number,
    type: "in", quantity: "0", reason: "", notes: null,
  },
});

const createItemMutation = useMutation<void, Error, NewItemOutput>({
  mutationFn: (payload) =>
    apiRequest("POST", "/api/stock/items", {
      ...payload,
      supplier: payload.supplier?.trim() ? payload.supplier : null,
      notes: payload.notes?.trim() ? payload.notes : null,
    }),
  onSuccess: async () => {
    await queryClient.refetchQueries({
      queryKey: ["/api/stock/items"],
      type: "active",
    });
    toast({ title: "Succès", description: "Article créé." });
    newItemForm.reset();
    onSuccess?.(); 
  },
  onError: (e) =>
    toast({ title: "Erreur", description: e.message, variant: "destructive" }),
});

  const createMovementMutation = useMutation({
    mutationFn: (payload: MovementOutput) =>
      apiRequest("POST", "/api/stock/movements", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/movements"] });
      toast({ title: "Succès", description: "Mouvement enregistré." });
      movementForm.reset();
      onSuccess?.();
    },
    onError: (e: any) =>
      toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const onSubmitNewItem = (data: NewItemInput) => {
    const parsed = newItemSchema.parse({
      ...data,
      supplier: data.supplier ?? null,
      notes: data.notes ?? null,
    });
    createItemMutation.mutate(parsed);
  };

  const onSubmitMovement = (data: MovementInput) => {
    const parsed = movementSchema.parse({
      ...data,
      notes: data.notes ?? null,
    });
    createMovementMutation.mutate(parsed);
  };

  return (
    <>
      <DialogHeader><DialogTitle>Gestion des stocks</DialogTitle></DialogHeader>

      <Tabs defaultValue="movement" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="movement">Mouvement</TabsTrigger>
          <TabsTrigger value="new-item">Nouvel article</TabsTrigger>
        </TabsList>

        {/* Mouvement */}
        <TabsContent value="movement">
          <Form {...movementForm}>
            <form onSubmit={movementForm.handleSubmit(onSubmitMovement)} className="space-y-4">
              <FormField
                control={movementForm.control}
                name="stockItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Article</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v, 10))} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un article" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stockItems.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name} ({item.currentQuantity} {item.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={movementForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de mouvement</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="in">Entrée</SelectItem>
                          <SelectItem value="out">Sortie</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={movementForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantité</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="10" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={movementForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Raison</FormLabel>
                    <FormControl><Input placeholder="BL, production, casse…" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={movementForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optionnel)</FormLabel>
                    <FormControl><Textarea placeholder="Notes…" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onSuccess?.()}>Annuler</Button>
                <Button type="submit" disabled={createMovementMutation.isPending}>
                  {createMovementMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* Nouvel article */}
        <TabsContent value="new-item">
          <Form {...newItemForm}>
            <form onSubmit={newItemForm.handleSubmit(onSubmitNewItem)} className="space-y-4">
              <FormField name="name" control={newItemForm.control} render={({ field }) => (
                <FormItem><FormLabel>Nom de l'article</FormLabel><FormControl><Input placeholder="Verre coloré rouge" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField name="type" control={newItemForm.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner le type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="glass">Verre</SelectItem>
                        <SelectItem value="packaging">Emballage</SelectItem>
                        <SelectItem value="tools">Outils</SelectItem>
                        <SelectItem value="consumables">Consommables</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="category" control={newItemForm.control} render={({ field }) => (
                  <FormItem><FormLabel>Catégorie</FormLabel><FormControl><Input placeholder="verre_coloré, carton…" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField name="currentQuantity" control={newItemForm.control} render={({ field }) => (
                  <FormItem><FormLabel>Quantité initiale</FormLabel><FormControl><Input type="number" step="0.01" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField name="unit" control={newItemForm.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unité</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Unité" /></SelectTrigger></FormControl>
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
                <FormField name="minimumThreshold" control={newItemForm.control} render={({ field }) => (
                  <FormItem><FormLabel>Seuil minimum</FormLabel><FormControl><Input type="number" step="0.01" placeholder="5" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField name="supplier" control={newItemForm.control} render={({ field }) => (
                <FormItem><FormLabel>Fournisseur (optionnel)</FormLabel><FormControl><Input placeholder="Nom du fournisseur" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="notes" control={newItemForm.control} render={({ field }) => (
                <FormItem><FormLabel>Notes (optionnel)</FormLabel><FormControl><Textarea placeholder="Notes sur l'article…" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onSuccess?.()}>Annuler</Button>
                <Button type="submit" disabled={createItemMutation.isPending}>
                  {createItemMutation.isPending ? "Création..." : "Créer l'article"}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </>
  );
}

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { insertEventSchema } from "@shared/schema";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/useToast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/* ---------------- utils date (évite tout bug d’extension) ---------------- */
function toDateInputValue(d?: Date) {
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function fromDateInputValue(v: string) {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  // UTC pour éviter les décalages fuseau/heure d’été
  return new Date(Date.UTC(y, m - 1, d));
}

/* ---------------- schéma du formulaire ---------------- */
const formSchema = insertEventSchema.extend({
  participationFee: z.string().optional(),
  startDate: z.date(),
  endDate: z.date().optional(),
});
type FormData = z.infer<typeof formSchema>;

export default function EventForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: "",
      type: "exhibition",
      status: "planned",
      venue: "",
      description: "",
      website: "",
      participationFee: "",
      notes: "",
      startDate: new Date(),
      endDate: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        participationFee: data.participationFee?.trim() ? data.participationFee : null,
        venue: data.venue?.trim() ? data.venue : null,
        description: data.description?.trim() ? data.description : null,
        website: data.website?.trim() ? data.website : null,
        notes: data.notes?.trim() ? data.notes : null,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate ? data.endDate.toISOString() : null,
      };
      return apiRequest("POST", "/api/events", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Succès", description: "Événement créé." });
      form.reset({
        name: "",
        type: "exhibition",
        status: "planned",
        venue: "",
        description: "",
        website: "",
        participationFee: "",
        notes: "",
        startDate: new Date(),
        endDate: undefined,
      });
      onSuccess?.();
    },
    onError: (e: any) =>
      toast({
        title: "Erreur",
        description: e?.message || "Création impossible.",
        variant: "destructive",
      }),
  });

  const onSubmit = (data: FormData) => createMutation.mutate(data);

  return (
    <div className="flex max-h-[85vh] flex-col">
      <DialogHeader className="sticky top-0 z-10 border-b bg-white/80 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <DialogTitle className="text-lg">Créer un nouvel événement</DialogTitle>
        <DialogDescription className="sr-only">
          Formulaire de création d’événement
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Nom</FormLabel>
                <FormControl>
                  <Input className="h-10" placeholder="Salon d'art contemporain" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* type / statut */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="exhibition">Exposition</SelectItem>
                      <SelectItem value="fair">Salon / Foire</SelectItem>
                      <SelectItem value="workshop">Atelier</SelectItem>
                      <SelectItem value="sale">Vente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Statut" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planned">Planifié</SelectItem>
                      <SelectItem value="confirmed">Confirmé</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="venue"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Lieu</FormLabel>
                <FormControl>
                  <Input className="h-10" placeholder="Galerie, ville…" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* dates (natifs, fiables) */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Début</FormLabel>
                  <FormControl>
                    <input
                      type="date"
                      className="h-10 w-full rounded border px-3"
                      value={toDateInputValue(field.value)}
                      onChange={(e) => field.onChange(fromDateInputValue(e.target.value) ?? field.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Fin (optionnel)</FormLabel>
                  <FormControl>
                    <input
                      type="date"
                      className="h-10 w-full rounded border px-3"
                      value={toDateInputValue(field.value)}
                      min={toDateInputValue(form.getValues("startDate"))}
                      onChange={(e) => field.onChange(fromDateInputValue(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea className="min-h-24" placeholder="Détails, thème, public attendu…" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* site + frais */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Site web</FormLabel>
                  <FormControl>
                    <Input className="h-10" type="url" placeholder="https://…" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="participationFee"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Frais de participation (€)</FormLabel>
                  <FormControl>
                    <Input
                      className="h-10"
                      type="number"
                      step="0.01"
                      placeholder="250.00"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Notes privées</FormLabel>
                <FormControl>
                  <Textarea className="min-h-24" placeholder="Contacts, logistique…" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* footer */}
          <div className="sticky bottom-0 -mx-6 mt-2 border-t bg-white/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onSuccess?.()}>
                Annuler
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Création…" : "Créer l’événement"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

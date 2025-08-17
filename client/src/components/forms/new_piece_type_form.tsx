import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useToast } from "../../hooks/useToast";
import { apiRequest } from "../../lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string().min(1, "Nom requis").max(64, "Max 64 caractères"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onCreated?: () => void; 
}

export default function NewPieceTypeForm({ onCreated }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormData>({ name: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async () => {
      // validation locale
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        parsed.error.issues.forEach(i => (map[i.path[0] as string] = i.message));
        setErrors(map);
        throw new Error("Données invalides");
      }
      setErrors({});
      return apiRequest("POST", "/api/piece-types", {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/piece-types"] });
      toast({ title: "Type créé", description: "Le type a bien été ajouté." });
      setForm({ name: "", description: "" });
      onCreated?.();
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description:
          err?.message ||
          "Impossible de créer le type. Vérifiez qu’il n’existe pas déjà.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Nouveau type</h3>

      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input
          id="name"
          placeholder="Ex: Poisson Candy"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optionnel)</Label>
        <Textarea
          id="description"
          placeholder="Courte description…"
          value={form.description || ""}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          onClick={() => mutation.mutate()}
          disabled={!form.name.trim() || mutation.isPending}
        >
          {mutation.isPending ? "Création…" : "Créer"}
        </Button>
      </div>
    </div>
  );
}

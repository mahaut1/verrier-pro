import { useState, useMemo } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  pieceTypeId: z.number().int().positive({ message: "Type requis" }),
  name: z.string().min(1, "Nom requis").max(64, "Max 64 caractères"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewPieceSubtypeForm({
  defaultPieceTypeId,
  onCreated,
}: {
  defaultPieceTypeId?: number;
  onCreated?: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormData>({
    pieceTypeId: defaultPieceTypeId ?? 0,
    name: "",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // types
  const { data: pieceTypes = [] } = useQuery({
    queryKey: ["/api/piece-types"],
    queryFn: async () => {
      const r = await fetch("/api/piece-types?onlyActive=true", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<Array<{ id: number; name: string }>>;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        parsed.error.issues.forEach(i => (map[String(i.path[0])] = i.message));
        setErrors(map);
        throw new Error("Données invalides");
      }
      setErrors({});
      const res = await fetch("/api/piece-subtypes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceTypeId: form.pieceTypeId,
          name: form.name.trim(),
          description: form.description?.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.message || "Échec création");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/piece-subtypes"] });
      toast({ title: "Sous-type créé", description: "Le sous-type a été ajouté." });
      setForm({ pieceTypeId: defaultPieceTypeId ?? 0, name: "", description: "" });
      onCreated?.();
    },
    onError: (e: any) => {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible de créer le sous-type.",
        variant: "destructive",
      });
    },
  });

  const canSubmit = useMemo(
    () => form.pieceTypeId > 0 && form.name.trim().length > 0,
    [form]
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Nouveau sous-type</h3>

      <div className="space-y-2">
        <Label>Type</Label>
        <Select
          value={form.pieceTypeId ? String(form.pieceTypeId) : ""}
          onValueChange={(v) => setForm(f => ({ ...f, pieceTypeId: Number(v) }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sélectionner un type" />
          </SelectTrigger>
          <SelectContent>
            {pieceTypes.map(t => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.pieceTypeId && <p className="text-sm text-red-600">{errors.pieceTypeId}</p>}
      </div>

      <div className="space-y-2">
        <Label>Nom</Label>
        <Input
          placeholder="Ex: Tryptique"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
        />
        {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label>Description (optionnel)</Label>
        <Textarea
          placeholder="Courte description…"
          value={form.description || ""}
          onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
          {mutation.isPending ? "Création…" : "Créer"}
        </Button>
      </div>
    </div>
  );
}

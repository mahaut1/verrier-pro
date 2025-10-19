import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "../../hooks/useToast";

export default function PieceTypesManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: typesRaw = [], isLoading } = useQuery({
    queryKey: ["/api/piece-types"],
    queryFn: async () => {
      const r = await fetch("/api/piece-types?onlyActive=false", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<Array<{ id: number; name: string; description?: string }>>;
    },
  });

  // Trie les types par nom (insensible à la casse)
  const types = useMemo(() => {
    return [...typesRaw].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [typesRaw]);

  const [search, setSearch] = useState("");

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: number; patch: Partial<{ name: string; description?: string }> }) => {
      const r = await fetch(`/api/piece-types/${payload.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.patch),
      });
      if (!r.ok) throw new Error((await r.json())?.message || "Échec mise à jour");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/piece-types"] });
      toast({ title: "Succès", description: "Type modifié avec succès." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Maj impossible", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/piece-types/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json())?.message || "Suppression impossible");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/piece-types"] });
      toast({ title: "Succès", description: "Type supprimé avec succès." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Suppression impossible", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return types;
    const q = search.toLowerCase();
    return types.filter(t => t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
  }, [types, search]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Types de pièces</h3>
      <div className="w-56 mb-2">
        <Label>Recherche</Label>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom / description…" />
      </div>
      <div className="rounded-md border">
        <div className="grid grid-cols-8 gap-2 border-b px-3 py-2 text-sm font-medium">
          <div className="col-span-6">Nom</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Aucun type.</div>
        ) : (
          filtered.map(t => (
            <div key={t.id} className="grid grid-cols-8 items-center gap-2 px-3 py-2 hover:bg-muted/40">
              <div className="col-span-6 truncate">{t.name}</div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className=""
                  onClick={() => {
                    const name = prompt("Nom du type", t.name);
                    if (name && name.trim() && name !== t.name) {
                      updateMutation.mutate({ id: t.id, patch: { name: name.trim() } });
                    }
                  }}
                >
                  Renommer
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className=""
                  onClick={() => {
                    if (confirm("Supprimer ce type ?")) deleteMutation.mutate(t.id);
                  }}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

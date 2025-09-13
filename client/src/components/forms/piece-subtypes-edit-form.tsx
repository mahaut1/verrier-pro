import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "../../hooks/useToast";

type Subtype = {
  id: number;
  userId: number;
  pieceTypeId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function PieceSubtypesManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pieceTypes = [] } = useQuery({
    queryKey: ["/api/piece-types"],
    queryFn: async () => {
      const r = await fetch("/api/piece-types?onlyActive=false", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<Array<{ id: number; name: string }>>;
    },
  });

  const [filterTypeId, setFilterTypeId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const { data: subtypes = [], isLoading } = useQuery({
    queryKey: ["/api/piece-subtypes", { pieceTypeId: filterTypeId, onlyActive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterTypeId) params.set("pieceTypeId", String(filterTypeId));
      if (onlyActive) params.set("onlyActive", "true");
      const r = await fetch(`/api/piece-subtypes?${params.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<Subtype[]>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: number; patch: Partial<Subtype> }) => {
      const r = await fetch(`/api/piece-subtypes/${payload.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.patch),
      });
      if (!r.ok) throw new Error((await r.json())?.message || "Échec mise à jour");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/piece-subtypes"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Maj impossible", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/piece-subtypes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json())?.message || "Suppression impossible");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/piece-subtypes"] });
      toast({ title: "Supprimé", description: "Le sous-type a été supprimé." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Suppression impossible", variant: "destructive" }),
  });

  const typeName = (id: number) => pieceTypes.find(t => t.id === id)?.name ?? `Type #${id}`;

  const filtered = useMemo(() => {
    if (!search.trim()) return subtypes;
    const q = search.toLowerCase();
    return subtypes.filter(s => s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q));
  }, [subtypes, search]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Sous-types</h3>

      <div className="flex flex-wrap gap-3">
        <div className="w-56">
          <Label>Filtrer par type</Label>
          <Select
            value={filterTypeId ? String(filterTypeId) : "all"}
            onValueChange={(v) => setFilterTypeId(v === "all" ? null : Number(v))}
          >
            <SelectTrigger><SelectValue placeholder="Tous les types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {pieceTypes.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="w-56">
          <Label>Recherche</Label>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom / description…" />
        </div>

        <div className="flex items-end gap-2">
          <Switch checked={onlyActive} onCheckedChange={setOnlyActive} id="onlyActive" />
          <Label htmlFor="onlyActive">Actifs uniquement</Label>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="grid grid-cols-12 gap-2 border-b px-3 py-2 text-sm font-medium">
          <div className="col-span-4">Nom</div>
          <div className="col-span-4">Type</div>
          <div className="col-span-2">Actif</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Aucun sous-type.</div>
        ) : (
          filtered.map(s => (
            <div key={s.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2 hover:bg-muted/40">
              <div className="col-span-4 truncate">{s.name}</div>
              <div className="col-span-4 truncate">{typeName(s.pieceTypeId)}</div>
              <div className="col-span-2">
                <Switch
                  checked={s.isActive}
                  onCheckedChange={(checked) => updateMutation.mutate({ id: s.id, patch: { isActive: checked } })}
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const name = prompt("Nom du sous-type", s.name);
                    if (name && name.trim() && name !== s.name) {
                      updateMutation.mutate({ id: s.id, patch: { name: name.trim() } });
                    }
                  }}
                >
                  Renommer
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Supprimer ce sous-type ?")) deleteMutation.mutate(s.id);
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

import * as React from "react";
import { Button } from "@/components/ui/button";
import { resolveImageUrl } from "../../lib/images";

type Props = {
  pieceId: number;
  currentImageUrl?: string;
  onImageUploaded?: (imageUrl: string | null) => void;
  disabled?: boolean;
};

export default function ImageUpload({
  pieceId,
  currentImageUrl,
  onImageUploaded,
  disabled,
}: Props) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // preview temporaire
  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const openPicker = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!disabled && !isSending) fileRef.current?.click();
  };

  async function handleUpload() {
    if (!file) return;
    setIsSending(true);
    try {
      const fd = new FormData();
      // on envoie sous deux clés pour couvrir l’API
      fd.append("image", file, file.name);
      fd.append("file", file, file.name);

      const res = await fetch(`/api/pieces/${pieceId}/image`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try {
          const err = await res.json();
          msg = err?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      // certaines routes renvoient 204, d’autres un JSON
      let imageUrl: string | null = null;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        imageUrl =
          data?.imageUrl ??
          data?.url ??
          data?.location ??
          data?.piece?.imageUrl ??
          null;
      }
      onImageUploaded?.(imageUrl);
      setFile(null);
    } catch (e: any) {
      alert(e?.message || "Échec du téléversement");
    } finally {
      setIsSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    setIsSending(true);
    try {
      const res = await fetch(`/api/pieces/${pieceId}/image`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        let msg = `Delete failed (${res.status})`;
        try {
          const err = await res.json();
          msg = err?.message || msg;
        } catch {}
        throw new Error(msg);
      }
      // 204 → pas de JSON, on force null
      onImageUploaded?.(null);
      setFile(null);
    } catch (e: any) {
      alert(e?.message || "Échec de la suppression");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid items-center gap-3 md:grid-cols-[auto,1fr,auto,auto] grid-cols-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={disabled || isSending}
        />

        <Button
          type="button"
          variant="outline"
          onClick={openPicker}
          disabled={disabled || isSending}
        >
          Choisir un fichier
        </Button>

        <div className="min-w-0 truncate text-sm text-muted-foreground">
          {file ? file.name : "Aucun fichier sélectionné"}
        </div>

        <Button
          type="button"
          onClick={handleUpload}
          disabled={!file || disabled || isSending}
        >
          {isSending ? "Téléversement…" : "Téléverser"}
        </Button>

        {currentImageUrl ? (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={disabled || isSending}
          >
            Supprimer
          </Button>
        ) : null}
      </div>

      {(previewUrl || currentImageUrl) && (
        <div className="rounded border p-2">
          <div className="mb-1 text-sm text-muted-foreground">Aperçu</div>
          <img
            src={previewUrl ?? resolveImageUrl(currentImageUrl!)}
            alt="aperçu"
            className="aspect-[4/3] w-full rounded-md object-cover"
          />
        </div>
      )}
    </div>
  );
}

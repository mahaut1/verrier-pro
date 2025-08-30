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
  const inputId = React.useId();

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleUpload() {
    if (!file) return;
    setIsSending(true);
    try {
      const fd = new FormData();
      fd.append("image", file, file.name); // doit s’appeler "image"

      const res = await fetch(`/api/pieces/${pieceId}/image`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Upload failed (${res.status})`);
      }
      const row = await res.json();
      onImageUploaded?.(row.imageUrl ?? null);
      setFile(null);
    } catch (e: any) {
      alert(e?.message || "Échec du téléversement");
    } finally {
      setIsSending(false);
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
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Delete failed (${res.status})`);
      }
      const row = await res.json();
      onImageUploaded?.(row.imageUrl ?? null);
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
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={disabled || isSending}
        />

        <label htmlFor={inputId}>
          <Button type="button" variant="outline" disabled={disabled || isSending}>
            Choisir un fichier
          </Button>
        </label>

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
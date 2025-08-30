import * as React from "react";
import { Button } from "@/components/ui/button";

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
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function handleUpload() {
    if (!file) return;
    setIsSending(true);
    try {
      const fd = new FormData();
      // IMPORTANT: doit s'appeler "image" pour matcher `upload.single("image")`
      fd.append("image", file, file.name);

      const res = await fetch(`/api/pieces/${pieceId}/image`, {
        method: "POST",
        body: fd,
        credentials: "include", // conserve le cookie de session
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Upload failed (${res.status})`);
      }

      const row = await res.json(); // ta route renvoie la pièce mise à jour
      onImageUploaded?.(row.imageUrl ?? null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e: any) {
      alert(e?.message || "Échec de l’upload");
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
      if (inputRef.current) inputRef.current.value = "";
    } catch (e: any) {
      alert(e?.message || "Échec de la suppression");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={disabled || isSending}
        />
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!file || disabled || isSending}
        >
          {isSending ? "Téléversement…" : "Téléverser l’image"}
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

      {currentImageUrl ? (
        <div className="rounded border p-2">
          <div className="text-sm mb-1">Aperçu</div>
          <img
            src={currentImageUrl}
            alt="aperçu"
            className="max-h-48 object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

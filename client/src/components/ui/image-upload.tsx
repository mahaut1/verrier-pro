import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  pieceId: number;
  currentImageUrl?: string;
  onImageUploaded?: (imageUrl: string) => void;
  disabled?: boolean;
  /** Taille max (bytes) – défaut 10 Mo */
  maxSize?: number;
};

export default function ImageUpload({
  pieceId,
  currentImageUrl,
  onImageUploaded,
  disabled = false,
  maxSize = 10 * 1024 * 1024,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // initialise l’aperçu avec l’image actuelle si fournie
  useEffect(() => {
    setPreview(currentImageUrl ?? null);
  }, [currentImageUrl]);

  const uploadUrl = `/api/pieces/${pieceId}/image`;

  function onPickClick() {
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0] || null;
    if (!f) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Formats acceptés: JPEG, PNG, WEBP.");
      return;
    }
    if (f.size > maxSize) {
      setError(`Fichier trop lourd (max ${(maxSize / (1024 * 1024)).toFixed(0)} Mo).`);
      return;
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function onUpload() {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);

      const res = await fetch(uploadUrl, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Réponse non JSON (${res.status}) — ${text.slice(0, 120)}`);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const url = data.imageUrl || data?.piece?.imageUrl;
      if (url) {
        setPreview(url);
        onImageUploaded?.(url);
      }
    } catch (e: any) {
      setError(e.message || "Échec de l’upload");
    } finally {
      setUploading(false);
      // on laisse le fichier sélectionné pour permettre un ré-envoi rapide,
      // à toi de décider si tu veux « reset » ici.
    }
  }

  function onClearSelection() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    // on garde `preview` (l’image en base) si aucun nouveau fichier choisi
    if (!currentImageUrl) setPreview(null);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
        disabled={disabled || uploading}
      />

      <div className="border border-input rounded-md p-4">
        <div className="flex items-start gap-4">
          {preview ? (
            <img
              src={preview}
              alt="preview"
              className="w-40 h-40 object-cover rounded-md border"
            />
          ) : (
            <div className="w-40 h-40 rounded-md border flex items-center justify-center text-xs text-gray-600">
              Aucune image
            </div>
          )}

          <div className="flex-1">
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={onPickClick}
                variant="outline"
                disabled={disabled || uploading}
              >
                Choisir un fichier
              </Button>
              <Button
                type="button"
                onClick={onUpload}
                disabled={disabled || uploading || !file}
              >
                {uploading ? "Envoi..." : "Envoyer"}
              </Button>
              {file && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClearSelection}
                  disabled={disabled || uploading}
                >
                  Annuler sélection
                </Button>
              )}
            </div>

            {file && (
              <p className="text-xs text-gray-600 mt-2">
                {file.name} • {(file.size / 1024).toFixed(0)} Ko
              </p>
            )}

            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

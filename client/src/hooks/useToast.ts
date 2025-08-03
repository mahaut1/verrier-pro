import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

export function useToast() {
  const toast = ({ title, description, variant = "default" }: ToastProps) => {
    if (variant === "destructive") {
      sonnerToast.error(title || "Erreur", {
        description,
        duration: 4000,
      });
    } else {
      sonnerToast.success(title || "Succès", {
        description,
        duration: 4000,
      });
    }
  };

  return { toast };
}

import {QueryClient} from '@tanstack/react-query';

export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && data instanceof FormData;
  const res = await fetch(url, {
    method,
    credentials: "include", // ← pour envoyer les cookies de session
    headers: !isForm && data ? { "Content-Type": "application/json" } : undefined,
    body: data ? (isForm ? (data as FormData) : JSON.stringify(data)) : undefined,
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      if (ct.includes("application/json")) {
        const j = (await res.json()) as { message?: string };
        if (j?.message) message = j.message;
      } else {
        const t = await res.text();
        if (t) message = t;
      }
    } catch {
    }
    throw new Error(message);
  }
  if (res.status === 204) {
    // @ts-expect-error: volontaire pour les mutations sans retour
    return;
  }
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  // @ts-expect-error: autorise le texte si l'appelant le veut
  return text;
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries:{
            queryFn: async ({queryKey}) => {
                const [url]=queryKey as [string];
                return apiRequest('GET', url);
            },
        },
    },
});
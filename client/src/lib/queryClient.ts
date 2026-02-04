import { QueryClient } from "@tanstack/react-query";
import { ApiError, type ApiErrorBody } from "./api-error";

export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown,
  init?: Pick<RequestInit, "headers" | "signal" | "credentials">
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && data instanceof FormData;
  const autoHeaders = !isForm && data ? { "Content-Type": "application/json" } : undefined;
  const mergedHeaders = autoHeaders
    ? { ...(autoHeaders as Record<string, string>), ...(init?.headers as Record<string, string> | undefined) }
    : init?.headers;

  const res = await fetch(url, {
    method,
    // include par défaut pour les sessions, tout en permettant l'override au besoin
    credentials: init?.credentials ?? "include",
    headers: mergedHeaders,
    body: data ? (isForm ? (data as FormData) : JSON.stringify(data)) : undefined,
    signal: init?.signal,
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    let body: ApiErrorBody | undefined;
     try {
      if (ct.includes("application/json")) {
        body = (await res.json()) as ApiErrorBody;
        if (body?.message) message = body.message;
      } else {
        const t = await res.text();
        if (t) message = t;
      }
    } catch {
      // on laisse le message par défaut
    }

    throw new ApiError(res.status, message, body);
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
    queries: {

      queryFn: async ({ queryKey, signal }) => {
        const [url] = queryKey as [string];
        return apiRequest("GET", url, undefined, { signal });
      },
    },
    },
});
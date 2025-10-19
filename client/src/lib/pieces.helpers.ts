export function getStatusColor(status: string): string {
  switch (status) {
    case "workshop":
      return "bg-green-100 text-green-800";
    case "transit":
      return "bg-blue-100 text-blue-800";
    case "gallery":
      return "bg-purple-100 text-purple-800";
    case "sold":
      return "bg-gray-100 text-gray-800";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "workshop":
      return "Atelier";
    case "transit":
      return "En transit";
    case "gallery":
      return "En galerie";
    case "sold":
      return "Vendu";
    case "completed":
      return "Terminé";
    default:
      return status;
  }
}

export function buildIdNameMap<T extends { id: number; name: string }>(items: T[] | undefined | null): Record<string, string> {
  return (Array.isArray(items) ? items : []).reduce((acc, it) => {
    acc[String(it.id)] = it.name;
    return acc;
  }, {} as Record<string, string>);
}

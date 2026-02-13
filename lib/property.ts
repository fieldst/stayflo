// stayflo/lib/property.ts
export type PropertyConfig = {
  slug: string;
  name?: string;
  displayName: string;
  city: string;
  brand?: {
    logoUrl?: string;
    theme?: "dark" | "light";
    accentHex?: string;
  };
  wifi?: { name: string; password: string };
};

const PROPERTIES: Record<string, PropertyConfig> = {
  lamar: {
    slug: "lamar",
    name: "Lamar Street",
    displayName: "Fields of Comfort Stays • Lamar",
    city: "San Antonio",
    brand: { logoUrl: "/brand/foc-logo.png", theme: "dark", accentHex: "#5A2D82" },
  },
  gabriel: {
    slug: "gabriel",
    name: "Gabriel Street",
    displayName: "Fields of Comfort Stays • Gabriel",
    city: "San Antonio",
    brand: { logoUrl: "/brand/foc-logo.png", theme: "dark", accentHex: "#5A2D82" },
  },
};

export function getPropertyConfig(slug: string): PropertyConfig | null {
  const key = (slug || "").toLowerCase();
  return PROPERTIES[key] ?? null;
}

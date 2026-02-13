// stayflo/lib/property.ts
export type PropertyConfig = {
  slug: string;
  displayName: string;
  city: string;
  brand?: {
    logoUrl?: string;          // e.g. "/brand/foc-logo.png"
    theme?: "dark" | "light";
    accentHex?: string;
  };
  // Optional: add later
  wifi?: { name: string; password: string };
};

const PROPERTIES: Record<string, PropertyConfig> = {
  lamar: {
    slug: "lamar",
    displayName: "Fields of Comfort Stays • Lamar",
    city: "San Antonio",
    brand: { logoUrl: "/brand/foc-logo.png", theme: "dark", accentHex: "#5A2D82" },
    
  },
  gabriel: {
    slug: "gabriel",
    displayName: "Fields of Comfort Stays • Gabriel",
    city: "San Antonio",
    brand: { logoUrl: "/brand/foc-logo.png", theme: "dark", accentHex: "#5A2D82" },
  },
};

export function getPropertyConfig(slug: string): PropertyConfig | null {
  const key = (slug || "").toLowerCase();
  return PROPERTIES[key] ?? null;
}

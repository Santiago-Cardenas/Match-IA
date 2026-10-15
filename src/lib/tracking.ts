import { supabase } from "@/integrations/supabase/client";

export type Utm = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
};

const STORAGE_KEY = "matchia_utm";

const empty: Utm = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  referrer: null,
};

/**
 * Reads utm_source / utm_medium / utm_campaign from the entry URL and keeps
 * them for the whole session, so the form can submit them as hidden fields.
 */
export function captureUtm(): Utm {
  if (typeof window === "undefined") return empty;

  const params = new URLSearchParams(window.location.search);
  const fromUrl: Utm = {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    referrer: document.referrer || null,
  };

  const hasAny = Boolean(fromUrl.utm_source || fromUrl.utm_medium || fromUrl.utm_campaign);

  try {
    if (hasAny) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) return { ...empty, ...(JSON.parse(stored) as Partial<Utm>) };
  } catch {
    /* sessionStorage unavailable */
  }

  return fromUrl;
}

/** Fires a named analytics event (one per pack CTA) and stores it. */
export async function trackEvent(eventName: string, pack?: string) {
  const utm = captureUtm();

  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event: eventName, pack: pack ?? null, ...utm });
  w.gtag?.("event", eventName, { pack: pack ?? null, ...utm });

  try {
    await supabase.from("cta_clicks").insert({
      event_name: eventName,
      pack: pack ?? null,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      referrer: utm.referrer,
    });
  } catch (error) {
    console.error("No se pudo registrar el evento", error);
  }
}

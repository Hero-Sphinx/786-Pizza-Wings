import type { HoursConfig } from "./hours";

/** Public store details and ordering rules. Nothing in here is secret. */
export type StoreInfo = {
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
  landmark: string | null;
  orderingEnabled: boolean;
  orderingPausedMessage: string | null;
  deliveryEnabled: boolean;
  deliveryFeeCents: number;
  deliveryMinCents: number | null;
  deliveryFsas: string[];
  pickupLeadMinutes: number;
  deliveryLeadMinutes: number;
  hours: HoursConfig;
  promos: {
    slug: string;
    eyebrow: string | null;
    title: string;
    body: string | null;
    priceText: string | null;
    image: string;
    ctaLabel: string | null;
    ctaHref: string | null;
  }[];
};


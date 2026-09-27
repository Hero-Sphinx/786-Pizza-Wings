// What the browser sends: choices only, never prices. The server re-prices everything.
import { z } from "zod";

const slug = z.string().min(1).max(60).regex(/^[a-z0-9-]+$/);
const code = z.string().min(1).max(30).regex(/^[a-z0-9-]+$/);
const uniqueSlugs = (max: number) =>
  z.array(slug).max(max).refine((a) => new Set(a).size === a.length, { message: "duplicate choice" });

export const pizzaChoiceSchema = z
  .object({
    toppings: uniqueSlugs(20),
    // Indexes into the item's standard_toppings the customer wants left off.
    removed: z.array(z.number().int().min(0).max(20)).max(20).default([]),
  })
  .strict();

export const cartLineSchema = z
  .object({
    itemSlug: slug,
    variantCode: code,
    quantity: z.number().int().min(1).max(20),
    notes: z.string().trim().max(140).optional(),
    pizza: pizzaChoiceSchema.optional(),
    wingFlavours: uniqueSlugs(10).optional(),
    dealPizzas: z.array(pizzaChoiceSchema.omit({ removed: true }).strict()).max(6).optional(),
  })
  .strict();
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const cartSchema = z.array(cartLineSchema).min(1, "Your cart is empty").max(30);

export const fulfilmentSchema = z.enum(["pickup", "delivery"]);
export const paymentMethodSchema = z.enum(["cash", "card_in_person"]);
export type Fulfilment = z.infer<typeof fulfilmentSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// Canadian postal code, e.g. "L6X 1B3" (letters D, F, I, O, Q, U never appear).
const postal = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => v.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/, "Enter a valid postal code"))
  .transform((v) => `${v.slice(0, 3)} ${v.slice(3)}`);

// North American number; stored as 10 digits.
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[2-9]\d{2}[2-9]\d{6}$/, "Enter a 10-digit phone number"));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const addressSchema = z
  .object({
    line: z.string().trim().min(3, "Enter your street address").max(120),
    unit: optionalText(20),
    city: z.string().trim().min(2).max(60),
    postalCode: postal,
    notes: optionalText(200),
  })
  .strict();

export const checkoutSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
    lines: cartSchema,
    fulfilment: fulfilmentSchema,
    paymentMethod: paymentMethodSchema,
    customer: z
      .object({
        name: z.string().trim().min(2, "Enter your name").max(80),
        phone: phoneSchema,
        email: z
          .string()
          .trim()
          .max(120)
          .optional()
          .transform((v) => (v ? v.toLowerCase() : undefined))
          .pipe(z.email("Enter a valid email").optional()),
      })
      .strict(),
    address: addressSchema.optional(),
    // ISO instant chosen from the offered slots; omitted = ASAP.
    scheduledFor: z.iso.datetime({ offset: true }).optional(),
    notes: optionalText(300),
    // Honeypot: real people never fill this hidden field.
    website: z.string().max(200).optional(),
  })
  .strict()
  .refine((c) => c.fulfilment === "pickup" || c.address, {
    message: "Enter a delivery address",
    path: ["address"],
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const quoteSchema = z
  .object({
    lines: cartSchema,
    fulfilment: fulfilmentSchema,
    paymentMethod: paymentMethodSchema.optional(),
    scheduledFor: z.iso.datetime({ offset: true }).optional(),
    postalCode: z.string().max(10).optional(),
  })
  .strict();

/** "Track my order": both must match the order, so order numbers alone reveal nothing. */
export const orderLookupSchema = z
  .object({
    // Accepts "1037", "#1037" or 1037.
    orderNumber: z
      .union([z.string(), z.number()])
      .transform((v) => String(v).replace(/[#\s]/g, ""))
      .pipe(z.string().regex(/^\d{1,7}$/, "Enter your order number, e.g. 1037"))
      .transform(Number),
    phone: phoneSchema,
  })
  .strict();

-- 001: initial schema (identical to db/schema.sql at the time it was written).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE item_kind AS ENUM ('pizza', 'wings', 'simple', 'deal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- standard: HST added at checkout; included: price already includes tax; exempt: no tax charged
DO $$ BEGIN
  CREATE TYPE tax_mode AS ENUM ('standard', 'included', 'exempt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE topping_group AS ENUM ('veg', 'meat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('new', 'accepted', 'ready', 'out_for_delivery', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fulfilment AS ENUM ('pickup', 'delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payment is taken in person for now; an online provider can be added as a new value later.
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'card_in_person');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('owner', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Store configuration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_settings (
  id                        smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name                      text        NOT NULL,
  phone                     text        NOT NULL,
  address_line              text        NOT NULL,
  city                      text        NOT NULL,
  province                  text        NOT NULL,
  postal_code               text        NOT NULL,
  landmark                  text,
  timezone                  text        NOT NULL DEFAULT 'America/Toronto',
  ordering_enabled          boolean     NOT NULL DEFAULT true,
  ordering_paused_message   text,
  delivery_enabled          boolean     NOT NULL DEFAULT true,
  delivery_fee_cents        integer     NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  delivery_min_cents        integer     CHECK (delivery_min_cents >= 0),
  -- Forward sortation areas (first 3 chars of a Canadian postal code) we deliver to. Empty = no delivery.
  delivery_fsas             text[]      NOT NULL DEFAULT '{}',
  tax_rate_bps              integer     NOT NULL DEFAULT 1300 CHECK (tax_rate_bps BETWEEN 0 AND 5000),
  -- Ontario: prepared food/drink purchases of $4.00 or less only pay the federal part (5%).
  small_order_tax_rate_bps  integer     NOT NULL DEFAULT 500 CHECK (small_order_tax_rate_bps BETWEEN 0 AND 5000),
  small_order_max_cents     integer     NOT NULL DEFAULT 400 CHECK (small_order_max_cents >= 0),
  pickup_lead_minutes       integer     NOT NULL DEFAULT 20 CHECK (pickup_lead_minutes BETWEEN 0 AND 240),
  delivery_lead_minutes     integer     NOT NULL DEFAULT 45 CHECK (delivery_lead_minutes BETWEEN 0 AND 240),
  -- Stop taking ASAP orders this many minutes before closing.
  last_order_minutes        integer     NOT NULL DEFAULT 15 CHECK (last_order_minutes BETWEEN 0 AND 180),
  max_order_cents           integer     NOT NULL DEFAULT 50000 CHECK (max_order_cents > 0),
  notify_email              text,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- One row per weekday (0 = Sunday ... 6 = Saturday), store-local time.
-- closes_at may be earlier than opens_at to mean "closes after midnight".
CREATE TABLE IF NOT EXISTS store_hours (
  day_of_week  smallint PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed    boolean  NOT NULL DEFAULT false,
  opens_at     time     NOT NULL,
  closes_at    time     NOT NULL
);

-- One-off closures (holidays). Store-local date.
CREATE TABLE IF NOT EXISTS store_closures (
  closed_on  date PRIMARY KEY,
  reason     text
);

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pizza_sizes (
  code                 text PRIMARY KEY,
  label                text     NOT NULL,
  inches               smallint,
  sort_order           integer  NOT NULL DEFAULT 0,
  -- Price per extra topping unit on this size. NULL = extra toppings not offered online.
  extra_topping_cents  integer  CHECK (extra_topping_cents >= 0)
);

CREATE TABLE IF NOT EXISTS toppings (
  slug        text PRIMARY KEY,
  name        text          NOT NULL,
  topping_group topping_group NOT NULL,
  -- How many topping slots this counts as (e.g. BBQ chicken, double cheese = 2).
  units       smallint      NOT NULL DEFAULT 1 CHECK (units BETWEEN 1 AND 4),
  is_available boolean      NOT NULL DEFAULT true,
  sort_order  integer       NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wing_flavours (
  slug         text PRIMARY KEY,
  name         text    NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  slug        text PRIMARY KEY,
  name        text    NOT NULL,
  blurb       text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_visible  boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS menu_items (
  slug                    text PRIMARY KEY,
  category_slug           text      NOT NULL REFERENCES categories(slug) ON UPDATE CASCADE,
  kind                    item_kind NOT NULL,
  name                    text      NOT NULL,
  description             text,
  image                   text,
  -- Pizzas: the store's own wording of what comes on it (display only).
  standard_toppings       text[]    NOT NULL DEFAULT '{}',
  -- Pizzas: topping units included in the price (Create Your Own = 3). 0 for specialties.
  included_topping_units  smallint  NOT NULL DEFAULT 0 CHECK (included_topping_units >= 0),
  -- Deals: bundle definition, validated by dealConfigSchema in src/lib/menu-types.ts.
  deal_config             jsonb,
  tax_mode                tax_mode  NOT NULL DEFAULT 'standard',
  cash_only               boolean   NOT NULL DEFAULT false,
  pickup_only             boolean   NOT NULL DEFAULT false,
  -- Store-local weekdays this can be ordered (0 = Sunday). Empty = every day.
  available_days          smallint[] NOT NULL DEFAULT '{}',
  badge                   text,
  is_available            boolean   NOT NULL DEFAULT true,
  is_visible              boolean   NOT NULL DEFAULT true,
  sort_order              integer   NOT NULL DEFAULT 0,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_has_config CHECK ((kind = 'deal') = (deal_config IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS menu_items_category_idx ON menu_items (category_slug, sort_order);

-- Priced options of an item: pizza sizes, wing counts, side sizes, or a single "regular".
CREATE TABLE IF NOT EXISTS item_variants (
  item_slug    text    NOT NULL REFERENCES menu_items(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  code         text    NOT NULL,
  label        text    NOT NULL,
  price_cents  integer NOT NULL CHECK (price_cents >= 0),
  -- Pizzas and pizza deals: which pizza size this variant is.
  pizza_size   text    REFERENCES pizza_sizes(code) ON UPDATE CASCADE,
  -- Wings: pieces in this variant, and how many flavours may be split across them.
  wing_count   smallint CHECK (wing_count > 0),
  max_flavours smallint CHECK (max_flavours > 0),
  is_available boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (item_slug, code)
);

-- Home page carousel.
CREATE TABLE IF NOT EXISTS promos (
  slug        text PRIMARY KEY,
  eyebrow     text,
  title       text    NOT NULL,
  body        text,
  price_text  text,
  image       text    NOT NULL,
  cta_label   text,
  cta_href    text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Staff accounts and security
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text        NOT NULL UNIQUE CHECK (email = lower(email)),
  display_name     text        NOT NULL,
  password_hash    text        NOT NULL,
  role             admin_role  NOT NULL DEFAULT 'staff',
  is_active        boolean     NOT NULL DEFAULT true,
  failed_logins    integer     NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  last_login_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Only a SHA-256 of the session token is stored; the raw token lives in the httpOnly cookie.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash     text PRIMARY KEY,
  admin_user_id  uuid        NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  user_agent     text
);
CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions (admin_user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions (expires_at);

-- Fixed-window counters shared by every serverless instance.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        text        NOT NULL,
  window_start  timestamptz NOT NULL,
  hits          integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits (window_start);

CREATE TABLE IF NOT EXISTS audit_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action         text        NOT NULL,
  entity         text        NOT NULL,
  entity_id      text,
  detail         jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;

CREATE TABLE IF NOT EXISTS orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number         integer        NOT NULL UNIQUE DEFAULT nextval('order_number_seq'),
  -- Unguessable token for the customer's status page. Never expose the uuid or number alone.
  public_token         text           NOT NULL UNIQUE,
  -- Client-generated key so a double-tapped "Place order" can't create two orders.
  idempotency_key      text           NOT NULL UNIQUE,
  status               order_status   NOT NULL DEFAULT 'new',
  fulfilment           fulfilment     NOT NULL,
  payment_method       payment_method NOT NULL,
  customer_name        text           NOT NULL,
  customer_phone       text           NOT NULL,
  customer_email       text,
  address_line         text,
  address_unit         text,
  address_city         text,
  address_postal_code  text,
  address_notes        text,
  notes                text,
  -- NULL = as soon as possible.
  scheduled_for        timestamptz,
  subtotal_cents       integer        NOT NULL CHECK (subtotal_cents >= 0),
  delivery_fee_cents   integer        NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  tax_cents            integer        NOT NULL CHECK (tax_cents >= 0),
  total_cents          integer        NOT NULL CHECK (total_cents >= 0),
  -- HMAC of the client IP, for abuse investigation without storing raw IPs.
  client_ip_hash       text,
  cancel_reason        text,
  created_at           timestamptz    NOT NULL DEFAULT now(),
  updated_at           timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT delivery_has_address CHECK (
    fulfilment = 'pickup' OR (address_line IS NOT NULL AND address_postal_code IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);

-- Line items are snapshots: names and prices are copied so later menu edits never change history.
CREATE TABLE IF NOT EXISTS order_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid     NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position          smallint NOT NULL,
  item_slug         text     REFERENCES menu_items(slug) ON UPDATE CASCADE ON DELETE SET NULL,
  item_name         text     NOT NULL,
  variant_label     text,
  quantity          smallint NOT NULL CHECK (quantity BETWEEN 1 AND 50),
  unit_price_cents  integer  NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents  integer  NOT NULL CHECK (line_total_cents >= 0),
  tax_mode          tax_mode NOT NULL,
  -- Human-readable choices, one per line ("Pizza 1: Mushrooms, Onions").
  details           text[]   NOT NULL DEFAULT '{}',
  -- Machine-readable choices exactly as validated.
  selection         jsonb    NOT NULL,
  notes             text,
  UNIQUE (order_id, position)
);

CREATE TABLE IF NOT EXISTS order_events (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id       uuid         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status         order_status NOT NULL,
  admin_user_id  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  note           text,
  created_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id, created_at);

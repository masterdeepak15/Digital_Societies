-- ──────────────────────────────────────────────────────────────────────────────
-- Digital Societies — PostgreSQL 16 Schema Reference
-- The authoritative schema is EF Core migrations.
-- This file is for DBA review, documentation, and manual intervention.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- fuzzy search on names
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- GIN indexes for JSONB

-- ── Schemas (one per bounded context) ────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS visitor;
CREATE SCHEMA IF NOT EXISTS complaint;
CREATE SCHEMA IF NOT EXISTS communication;
CREATE SCHEMA IF NOT EXISTS parking;
CREATE SCHEMA IF NOT EXISTS accounting;
CREATE SCHEMA IF NOT EXISTS audit;

-- ════════════════════════════════════════════════════════════════════════════
-- IDENTITY SCHEMA
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE identity.societies (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(200) NOT NULL,
    address             VARCHAR(500) NOT NULL,
    registration_number VARCHAR(100) NOT NULL UNIQUE,
    tier                VARCHAR(20)  NOT NULL DEFAULT 'free'
                        CHECK (tier IN ('free','starter','standard','pro','enterprise')),
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    logo_url            VARCHAR(500),
    primary_phone       VARCHAR(20),
    primary_email       VARCHAR(250),
    total_flats         INT          NOT NULL DEFAULT 0,
    is_deleted          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by          UUID
);

CREATE TABLE identity.flats (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    society_id  UUID        NOT NULL REFERENCES identity.societies(id),
    number      VARCHAR(20)  NOT NULL,
    wing        VARCHAR(10)  NOT NULL,
    floor       INT          NOT NULL,
    owner_phone VARCHAR(20),
    is_occupied BOOLEAN      NOT NULL DEFAULT FALSE,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  UUID,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by  UUID,
    UNIQUE (society_id, wing, number)
);

CREATE TABLE identity.users (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone         VARCHAR(20)  NOT NULL UNIQUE,
    name          VARCHAR(200) NOT NULL,
    email         VARCHAR(250),
    avatar_url    VARCHAR(500),
    is_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    is_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by    UUID,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by    UUID
);
CREATE INDEX idx_users_phone ON identity.users(phone);

CREATE TABLE identity.user_devices (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    device_id     VARCHAR(100) NOT NULL,
    device_name   VARCHAR(200) NOT NULL,
    platform      VARCHAR(20)  NOT NULL CHECK (platform IN ('ios','android','web')),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    registered_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ,
    UNIQUE(user_id, device_id)
);

CREATE TABLE identity.memberships (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES identity.users(id),
    society_id  UUID        NOT NULL REFERENCES identity.societies(id),
    flat_id     UUID        REFERENCES identity.flats(id),
    role        VARCHAR(30)  NOT NULL
                CHECK (role IN ('admin','resident','family','guard','staff','accountant','vendor')),
    member_type VARCHAR(20)  NOT NULL DEFAULT 'owner'
                CHECK (member_type IN ('owner','tenant','staff','guard')),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  UUID,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by  UUID,
    UNIQUE (user_id, society_id, role)     -- one role per society per user
);
CREATE INDEX idx_memberships_society ON identity.memberships(society_id);
CREATE INDEX idx_memberships_user    ON identity.memberships(user_id);

CREATE TABLE identity.otp_requests (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone      VARCHAR(20)  NOT NULL,
    hashed_otp VARCHAR(100) NOT NULL,
    purpose    VARCHAR(20)  NOT NULL CHECK (purpose IN ('login','register','step_up')),
    is_used    BOOLEAN      NOT NULL DEFAULT FALSE,
    attempts   SMALLINT     NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_otp_phone_purpose ON identity.otp_requests(phone, purpose);
CREATE INDEX idx_otp_expires       ON identity.otp_requests(expires_at);

CREATE TABLE identity.refresh_tokens (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    token      VARCHAR(200) NOT NULL UNIQUE,
    is_revoked BOOLEAN      NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_token ON identity.refresh_tokens(token);

-- ════════════════════════════════════════════════════════════════════════════
-- BILLING SCHEMA
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE billing.bills (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    society_id   UUID        NOT NULL,
    flat_id      UUID        NOT NULL,
    period       VARCHAR(7)   NOT NULL,   -- "2026-05"
    amount_paise BIGINT       NOT NULL CHECK (amount_paise >= 0),
    late_fee_paise BIGINT     NOT NULL DEFAULT 0,
    description  TEXT         NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','paid','overdue','waived','cancelled')),
    due_date     DATE         NOT NULL,
    paid_at      TIMESTAMPTZ,
    payment_id   VARCHAR(100),   -- Razorpay payment ID
    is_deleted   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by   UUID,
    UNIQUE (society_id, flat_id, period)
);
CREATE INDEX idx_bills_society_status ON billing.bills(society_id, status);
CREATE INDEX idx_bills_flat           ON billing.bills(flat_id);
CREATE INDEX idx_bills_due_date       ON billing.bills(due_date);

CREATE TABLE billing.payments (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id         UUID        NOT NULL,
    society_id      UUID        NOT NULL,
    flat_id         UUID        NOT NULL,
    amount_paise    BIGINT       NOT NULL,
    gateway         VARCHAR(30)  NOT NULL,   -- razorpay / cashfree / wallet
    gateway_order_id VARCHAR(100),
    gateway_payment_id VARCHAR(100) UNIQUE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'initiated',
    initiated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    refunded_at     TIMESTAMPTZ,
    refund_amount_paise BIGINT
);

-- ════════════════════════════════════════════════════════════════════════════
-- VISITOR SCHEMA
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE visitor.visitors (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    society_id     UUID        NOT NULL,
    flat_id        UUID        NOT NULL,
    name           VARCHAR(200) NOT NULL,
    phone          VARCHAR(20),
    purpose        VARCHAR(50)  NOT NULL,
    vehicle_number VARCHAR(20),
    photo_url      VARCHAR(500),
    status         VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected','entered','exited')),
    entry_time     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    exit_time      TIMESTAMPTZ,
    approved_by    UUID,
    approved_at    TIMESTAMPTZ,
    is_deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by     UUID         -- guard who added
);
CREATE INDEX idx_visitors_society_status ON visitor.visitors(society_id, status);
CREATE INDEX idx_visitors_flat           ON visitor.visitors(flat_id);
CREATE INDEX idx_visitors_entry_time     ON visitor.visitors(entry_time);

-- ════════════════════════════════════════════════════════════════════════════
-- COMPLAINT SCHEMA
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE complaint.complaints (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    society_id   UUID        NOT NULL,
    flat_id      UUID        NOT NULL,
    raised_by    UUID        NOT NULL,
    title        VARCHAR(200) NOT NULL,
    description  TEXT         NOT NULL,
    category     VARCHAR(50)  NOT NULL,   -- plumbing / electrical / housekeeping / security / other
    priority     VARCHAR(20)  NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low','medium','high','urgent')),
    status       VARCHAR(20)  NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','assigned','in_progress','resolved','closed','reopened')),
    assigned_to  UUID,
    image_urls   JSONB        NOT NULL DEFAULT '[]',
    resolved_at  TIMESTAMPTZ,
    resolution   TEXT,
    is_deleted   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_complaints_society_status ON complaint.complaints(society_id, status);

CREATE TABLE complaint.complaint_updates (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id  UUID        NOT NULL REFERENCES complaint.complaints(id),
    updated_by    UUID        NOT NULL,
    status        VARCHAR(20),
    comment       TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- COMMUNICATION SCHEMA
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE communication.notices (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    society_id  UUID        NOT NULL,
    posted_by   UUID        NOT NULL,
    title       VARCHAR(300) NOT NULL,
    body        TEXT         NOT NULL,
    type        VARCHAR(20)  NOT NULL DEFAULT 'notice'
                CHECK (type IN ('notice','emergency','event','circular')),
    is_pinned   BOOLEAN      NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notices_society ON communication.notices(society_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- AUDIT SCHEMA (immutable, append-only)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE audit.activity_logs (
    id          BIGSERIAL    PRIMARY KEY,
    society_id  UUID,
    user_id     UUID,
    action      VARCHAR(100) NOT NULL,   -- "bill.created", "visitor.approved", etc.
    entity_type VARCHAR(50),
    entity_id   UUID,
    old_value   JSONB,
    new_value   JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions (add more as needed)
CREATE TABLE audit.activity_logs_2026_04 PARTITION OF audit.activity_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit.activity_logs_2026_05 PARTITION OF audit.activity_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- ════════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY (enforced at DB level — not just application)
-- ════════════════════════════════════════════════════════════════════════════

-- Enable RLS on multi-tenant tables
ALTER TABLE identity.memberships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.bills         ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor.visitors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint.complaints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication.notices ENABLE ROW LEVEL SECURITY;

-- Policies: rows visible only if society_id matches session variable
-- (TenantResolutionMiddleware sets this variable on every request)
CREATE POLICY tenant_isolation ON identity.memberships
    USING (society_id::text = COALESCE(current_setting('app.current_society_id', true), ''));

CREATE POLICY tenant_isolation ON billing.bills
    USING (society_id::text = COALESCE(current_setting('app.current_society_id', true), ''));

CREATE POLICY tenant_isolation ON visitor.visitors
    USING (society_id::text = COALESCE(current_setting('app.current_society_id', true), ''));

CREATE POLICY tenant_isolation ON complaint.complaints
    USING (society_id::text = COALESCE(current_setting('app.current_society_id', true), ''));

CREATE POLICY tenant_isolation ON communication.notices
    USING (society_id::text = COALESCE(current_setting('app.current_society_id', true), ''));

-- Superuser / migration role bypasses RLS
ALTER TABLE identity.memberships  FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.bills         FORCE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- Apply to all tables with updated_at
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename FROM pg_tables
           WHERE schemaname IN ('identity','billing','visitor','complaint','communication')
           AND tablename NOT LIKE '__ef%'
  LOOP
    EXECUTE format('CREATE OR REPLACE TRIGGER trg_updated_at
      BEFORE UPDATE ON %I.%I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      r.schemaname, r.tablename);
  END LOOP;
END $$;

package database

import (
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

func NewConnection(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * 60 * 1000000000) // 5 minutes

	return db, nil
}

func RunMigrations(db *sql.DB) error {
	migrations := []string{
		createPaymentsTable,
		createRefundsTable,
		createIndexes,
	}

	for i, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			return fmt.Errorf("failed to run migration %d: %w", i+1, err)
		}
	}

	return nil
}

const createPaymentsTable = `
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    user_id UUID NOT NULL,
    idempotency_key VARCHAR(64) NOT NULL UNIQUE,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'card',
    provider VARCHAR(30) NOT NULL DEFAULT 'stripe',
    provider_payment_id VARCHAR(255),
    provider_response JSONB,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    paid_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`

const createRefundsTable = `
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(64) NOT NULL UNIQUE,
    provider_refund_id VARCHAR(255),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    reason VARCHAR(50) NOT NULL DEFAULT 'customer_request',
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    initiated_by UUID NOT NULL,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`

const createIndexes = `
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments (provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds (status);`
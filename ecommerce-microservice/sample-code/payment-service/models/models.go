package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// PaymentStatus represents the status of a payment
type PaymentStatus string

const (
	PaymentStatusPending    PaymentStatus = "pending"
	PaymentStatusProcessing PaymentStatus = "processing"
	PaymentStatusSucceeded  PaymentStatus = "succeeded"
	PaymentStatusFailed     PaymentStatus = "failed"
	PaymentStatusCancelled  PaymentStatus = "cancelled"
)

// PaymentMethod represents the payment method type
type PaymentMethod string

const (
	PaymentMethodCard    PaymentMethod = "card"
	PaymentMethodPayPal  PaymentMethod = "paypal"
	PaymentMethodBank    PaymentMethod = "bank_transfer"
	PaymentMethodWallet  PaymentMethod = "wallet"
)

// Payment represents a payment transaction
type Payment struct {
	ID                string                 `json:"id" db:"id"`
	OrderID           string                 `json:"order_id" db:"order_id"`
	UserID            string                 `json:"user_id" db:"user_id"`
	IdempotencyKey    string                 `json:"idempotency_key" db:"idempotency_key"`
	PaymentMethod     PaymentMethod          `json:"payment_method" db:"payment_method"`
	Provider          string                 `json:"provider" db:"provider"`
	ProviderPaymentID *string                `json:"provider_payment_id,omitempty" db:"provider_payment_id"`
	ProviderResponse  *ProviderResponse     `json:"provider_response,omitempty" db:"provider_response"`
	Currency          string                 `json:"currency" db:"currency"`
	Amount            float64                `json:"amount" db:"amount"`
	Status            PaymentStatus          `json:"status" db:"status"`
	FailureReason     *string                `json:"failure_reason,omitempty" db:"failure_reason"`
	PaidAt            *time.Time             `json:"paid_at,omitempty" db:"paid_at"`
	Version           int                    `json:"version" db:"version"`
	CreatedAt         time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at" db:"updated_at"`
}

// ProviderResponse represents the response from payment provider
type ProviderResponse struct {
	ID               string                 `json:"id,omitempty"`
	Object           string                 `json:"object,omitempty"`
	Amount           int64                  `json:"amount,omitempty"`
	Currency         string                 `json:"currency,omitempty"`
	Status           string                 `json:"status,omitempty"`
	ClientSecret     string                 `json:"client_secret,omitempty"`
	PaymentMethod    string                 `json:"payment_method,omitempty"`
	PaymentIntentID  string                 `json:"payment_intent_id,omitempty"`
	ChargeID         string                 `json:"charge_id,omitempty"`
	RefundID         string                 `json:"refund_id,omitempty"`
	FailureCode      string                 `json:"failure_code,omitempty"`
	FailureMessage   string                 `json:"failure_message,omitempty"`
	LastPaymentError map[string]interface{} `json:"last_payment_error,omitempty"`
	Metadata         map[string]string      `json:"metadata,omitempty"`
}

// Value implements the driver.Valuer interface
func (pr ProviderResponse) Value() (driver.Value, error) {
	return json.Marshal(pr)
}

// Scan implements the sql.Scanner interface
func (pr *ProviderResponse) Scan(value interface{}) error {
	if value == nil {
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}

	return json.Unmarshal(bytes, pr)
}

// PaymentRequest represents a payment creation request
type PaymentRequest struct {
	OrderID       string         `json:"order_id" binding:"required"`
	IdempotencyKey string        `json:"idempotency_key" binding:"required"`
	PaymentMethod PaymentMethod  `json:"payment_method" binding:"required"`
	Card          *CardDetails   `json:"card,omitempty"`
	PayPal        *PayPalDetails `json:"paypal,omitempty"`
	Amount        float64        `json:"amount" binding:"required,min=0.01"`
	Currency      string         `json:"currency" binding:"required,len=3"`
}

// CardDetails represents credit card information
type CardDetails struct {
	Number     string `json:"number" binding:"required"`
	ExpMonth   int    `json:"exp_month" binding:"required,min=1,max=12"`
	ExpYear    int    `json:"exp_year" binding:"required,min=2024"`
	CVC        string `json:"cvc" binding:"required,len=3"`
	HolderName string `json:"holder_name" binding:"required"`
}

// PayPalDetails represents PayPal payment information
type PayPalDetails struct {
	Email string `json:"email" binding:"required,email"`
}

// RefundStatus represents the status of a refund
type RefundStatus string

const (
	RefundStatusPending   RefundStatus = "pending"
	RefundStatusProcessing RefundStatus = "processing"
	RefundStatusSucceeded RefundStatus = "succeeded"
	RefundStatusFailed    RefundStatus = "failed"
)

// RefundReason represents the reason for a refund
type RefundReason string

const (
	RefundReasonCustomerRequest RefundReason = "customer_request"
	RefundReasonDefective       RefundReason = "defective"
	RefundReasonDuplicate       RefundReason = "duplicate"
	RefundReasonFraud           RefundReason = "fraud"
)

// Refund represents a refund transaction
type Refund struct {
	ID               string        `json:"id" db:"id"`
	PaymentID        string        `json:"payment_id" db:"payment_id"`
	IdempotencyKey   string        `json:"idempotency_key" db:"idempotency_key"`
	ProviderRefundID *string       `json:"provider_refund_id,omitempty" db:"provider_refund_id"`
	Amount           float64       `json:"amount" db:"amount"`
	Reason           RefundReason  `json:"reason" db:"reason"`
	Notes            *string       `json:"notes,omitempty" db:"notes"`
	Status           RefundStatus  `json:"status" db:"status"`
	InitiatedBy      string        `json:"initiated_by" db:"initiated_by"`
	RefundedAt       *time.Time    `json:"refunded_at,omitempty" db:"refunded_at"`
	CreatedAt        time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at" db:"updated_at"`
}

// RefundRequest represents a refund creation request
type RefundRequest struct {
	IdempotencyKey string       `json:"idempotency_key" binding:"required"`
	Amount         float64      `json:"amount" binding:"required,min=0.01"`
	Reason         RefundReason `json:"reason" binding:"required"`
	Notes          string       `json:"notes,omitempty"`
}
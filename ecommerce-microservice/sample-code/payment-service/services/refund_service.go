package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/refund"

	"payment-service/config"
	"payment-service/models"
)

// RefundService handles refund business logic
type RefundService struct {
	db          *sql.DB
	kafkaWriter *kafka.Writer
	config      *config.Config
	stripeClient *stripe.Client
}

// NewRefundService creates a new refund service
func NewRefundService(db *sql.DB, kafkaWriter *kafka.Writer, cfg *config.Config) *RefundService {
	var stripeClient *stripe.Client
	if !cfg.UseStripeMock && cfg.StripeSecretKey != "" {
		stripeClient = &stripe.Client{}
		stripeClient.Init(cfg.StripeSecretKey, nil)
	}

	return &RefundService{
		db:           db,
		kafkaWriter:  kafkaWriter,
		config:       cfg,
		stripeClient: stripeClient,
	}
}

// CreateRefund creates a new refund
func (s *RefundService) CreateRefund(ctx context.Context, paymentID string, req *models.RefundRequest, userID string) (*models.Refund, error) {
	// Check idempotency
	var existingID string
	err := s.db.QueryRowContext(ctx,
		"SELECT id FROM refunds WHERE idempotency_key = $1",
		req.IdempotencyKey).Scan(&existingID)

	if err == nil {
		// Refund already exists, return it
		return s.GetRefund(ctx, existingID)
	} else if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check idempotency: %w", err)
	}

	// Get payment details
	payment, err := s.getPaymentForRefund(ctx, paymentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get payment: %w", err)
	}

	// Validate refund
	if payment.Status != models.PaymentStatusSucceeded {
		return nil, fmt.Errorf("can only refund successful payments")
	}

	// Check if refund amount is valid
	totalRefunded, err := s.getTotalRefundedAmount(ctx, paymentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get total refunded amount: %w", err)
	}

	if totalRefunded+req.Amount > payment.Amount {
		return nil, fmt.Errorf("refund amount exceeds remaining payment amount")
	}

	// Process refund with provider
	var providerResponse *models.ProviderResponse
	var providerRefundID *string
	var status models.RefundStatus = models.RefundStatusPending

	response, refundID, err := s.processRefund(ctx, payment, req.Amount)
	if err != nil {
		status = models.RefundStatusFailed
	} else {
		providerResponse = response
		providerRefundID = refundID
		if response.Status == "succeeded" {
			status = models.RefundStatusSucceeded
		}
	}

	// Create refund record
	refundIDValue := uuid.New().String()
	refund := &models.Refund{
		ID:             refundIDValue,
		PaymentID:      paymentID,
		IdempotencyKey: req.IdempotencyKey,
		ProviderRefundID: providerRefundID,
		Amount:         req.Amount,
		Reason:         req.Reason,
		Status:         status,
		InitiatedBy:    userID,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	if req.Notes != "" {
		refund.Notes = &req.Notes
	}

	if status == models.RefundStatusSucceeded {
		now := time.Now().UTC()
		refund.RefundedAt = &now
	}

	// Insert into database
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO refunds (
			id, payment_id, idempotency_key, provider_refund_id, amount,
			reason, notes, status, initiated_by, refunded_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		refund.ID, refund.PaymentID, refund.IdempotencyKey, refund.ProviderRefundID,
		refund.Amount, refund.Reason, refund.Notes, refund.Status, refund.InitiatedBy,
		refund.RefundedAt, refund.CreatedAt, refund.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create refund: %w", err)
	}

	// Publish event
	if err := s.publishRefundEvent(ctx, "refund.created", refund); err != nil {
		log.Printf("Failed to publish refund.created event: %v", err)
	}

	if status == models.RefundStatusSucceeded {
		if err := s.publishRefundEvent(ctx, "refund.succeeded", refund); err != nil {
			log.Printf("Failed to publish refund.succeeded event: %v", err)
		}
	}

	return refund, nil
}

// GetRefund retrieves a refund by ID
func (s *RefundService) GetRefund(ctx context.Context, refundID string) (*models.Refund, error) {
	var refund models.Refund
	var notes sql.NullString
	var providerRefundID sql.NullString
	var refundedAt sql.NullTime

	err := s.db.QueryRowContext(ctx, `
		SELECT id, payment_id, idempotency_key, provider_refund_id, amount,
			   reason, notes, status, initiated_by, refunded_at, created_at, updated_at
		FROM refunds WHERE id = $1`, refundID).Scan(
		&refund.ID, &refund.PaymentID, &refund.IdempotencyKey, &providerRefundID,
		&refund.Amount, &refund.Reason, &notes, &refund.Status, &refund.InitiatedBy,
		&refundedAt, &refund.CreatedAt, &refund.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("refund not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get refund: %w", err)
	}

	if providerRefundID.Valid {
		refund.ProviderRefundID = &providerRefundID.String
	}
	if notes.Valid {
		refund.Notes = &notes.String
	}
	if refundedAt.Valid {
		refund.RefundedAt = &refundedAt.Time
	}

	return &refund, nil
}

// ListRefunds retrieves refunds for a payment
func (s *RefundService) ListRefunds(ctx context.Context, paymentID string) ([]*models.Refund, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, payment_id, idempotency_key, provider_refund_id, amount,
			   reason, notes, status, initiated_by, refunded_at, created_at, updated_at
		FROM refunds
		WHERE payment_id = $1
		ORDER BY created_at DESC`, paymentID)

	if err != nil {
		return nil, fmt.Errorf("failed to list refunds: %w", err)
	}
	defer rows.Close()

	var refunds []*models.Refund
	for rows.Next() {
		var refund models.Refund
		var notes sql.NullString
		var providerRefundID sql.NullString
		var refundedAt sql.NullTime

		err := rows.Scan(
			&refund.ID, &refund.PaymentID, &refund.IdempotencyKey, &providerRefundID,
			&refund.Amount, &refund.Reason, &notes, &refund.Status, &refund.InitiatedBy,
			&refundedAt, &refund.CreatedAt, &refund.UpdatedAt)

		if err != nil {
			return nil, fmt.Errorf("failed to scan refund: %w", err)
		}

		if providerRefundID.Valid {
			refund.ProviderRefundID = &providerRefundID.String
		}
		if notes.Valid {
			refund.Notes = &notes.String
		}
		if refundedAt.Valid {
			refund.RefundedAt = &refundedAt.Time
		}

		refunds = append(refunds, &refund)
	}

	return refunds, nil
}

// getPaymentForRefund retrieves payment details for refund validation
func (s *RefundService) getPaymentForRefund(ctx context.Context, paymentID string) (*models.Payment, error) {
	var payment models.Payment
	var paidAt sql.NullTime
	var providerPaymentID sql.NullString

	err := s.db.QueryRowContext(ctx, `
		SELECT id, amount, currency, status, provider, provider_payment_id, paid_at
		FROM payments WHERE id = $1`, paymentID).Scan(
		&payment.ID, &payment.Amount, &payment.Currency, &payment.Status,
		&payment.Provider, &providerPaymentID, &paidAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("payment not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get payment: %w", err)
	}

	if providerPaymentID.Valid {
		payment.ProviderPaymentID = &providerPaymentID.String
	}
	if paidAt.Valid {
		payment.PaidAt = &paidAt.Time
	}

	return &payment, nil
}

// getTotalRefundedAmount calculates total refunded amount for a payment
func (s *RefundService) getTotalRefundedAmount(ctx context.Context, paymentID string) (float64, error) {
	var total float64
	err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM refunds
		WHERE payment_id = $1 AND status = 'succeeded'`, paymentID).Scan(&total)

	if err != nil {
		return 0, fmt.Errorf("failed to get total refunded amount: %w", err)
	}

	return total, nil
}

// processRefund processes a refund with the payment provider
func (s *RefundService) processRefund(ctx context.Context, payment *models.Payment, amount float64) (*models.ProviderResponse, *string, error) {
	if s.config.UseStripeMock {
		// Mock successful refund
		response := &models.ProviderResponse{
			ID:       "rf_mock_" + uuid.New().String(),
			Object:   "refund",
			Amount:   int64(amount * 100), // Convert to cents
			Currency: payment.Currency,
			Status:   "succeeded",
			RefundID: "rf_mock_" + uuid.New().String(),
		}
		refundID := "rf_mock_" + uuid.New().String()
		return response, &refundID, nil
	}

	if s.stripeClient == nil {
		return nil, nil, fmt.Errorf("Stripe client not configured")
	}

	if payment.ProviderPaymentID == nil {
		return nil, nil, fmt.Errorf("no provider payment ID found")
	}

	// Create refund
	params := &stripe.RefundParams{
		PaymentIntent: payment.ProviderPaymentID,
		Amount:        stripe.Int64(int64(amount * 100)), // Convert to cents
		Reason:        stripe.String(string(stripe.RefundReasonRequestedByCustomer)),
		Metadata: map[string]string{
			"payment_id": payment.ID,
		},
	}

	rf, err := refund.New(params)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create refund: %w", err)
	}

	response := &models.ProviderResponse{
		ID:       rf.ID,
		Object:   "refund",
		Amount:   rf.Amount,
		Currency: rf.Currency,
		Status:   string(rf.Status),
		RefundID: rf.ID,
	}

	return response, &rf.ID, nil
}

// publishRefundEvent publishes a refund event to Kafka
func (s *RefundService) publishRefundEvent(ctx context.Context, eventType string, refund *models.Refund) error {
	event := map[string]interface{}{
		"specversion":    "1.0",
		"type":          fmt.Sprintf("com.ecommerce.%s", eventType),
		"source":        "/payment-service",
		"id":            uuid.New().String(),
		"time":          time.Now().UTC().Format(time.RFC3339),
		"correlation_id": ctx.Value("request_id"),
		"data": map[string]interface{}{
			"refund_id":   refund.ID,
			"payment_id":  refund.PaymentID,
			"amount":      refund.Amount,
			"reason":      refund.Reason,
			"status":      refund.Status,
			"initiated_by": refund.InitiatedBy,
			"refunded_at": refund.RefundedAt,
		},
	}

	eventBytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	err = s.kafkaWriter.WriteMessages(ctx, kafka.Message{
		Topic: eventType,
		Key:   []byte(refund.ID),
		Value: eventBytes,
	})

	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}

	return nil
}
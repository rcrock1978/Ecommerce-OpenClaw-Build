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
	"github.com/stripe/stripe-go/v76/paymentintent"

	"payment-service/config"
	"payment-service/models"
)

// PaymentService handles payment business logic
type PaymentService struct {
	db           *sql.DB
	kafkaWriter  *kafka.Writer
	config       *config.Config
	stripeClient *stripe.Client
}

// NewPaymentService creates a new payment service
func NewPaymentService(db *sql.DB, kafkaWriter *kafka.Writer, cfg *config.Config) *PaymentService {
	var stripeClient *stripe.Client
	if !cfg.UseStripeMock && cfg.StripeSecretKey != "" {
		stripeClient = &stripe.Client{}
		stripeClient.Init(cfg.StripeSecretKey, nil)
	}

	return &PaymentService{
		db:           db,
		kafkaWriter:  kafkaWriter,
		config:       cfg,
		stripeClient: stripeClient,
	}
}

// CreatePayment creates a new payment
func (s *PaymentService) CreatePayment(ctx context.Context, req *models.PaymentRequest, userID string) (*models.Payment, error) {
	// Check idempotency
	var existingID string
	err := s.db.QueryRowContext(ctx,
		"SELECT id FROM payments WHERE idempotency_key = $1",
		req.IdempotencyKey).Scan(&existingID)

	if err == nil {
		// Payment already exists, return it
		return s.GetPayment(ctx, existingID)
	} else if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check idempotency: %w", err)
	}

	// Validate payment method and create provider payment
	var providerResponse *models.ProviderResponse
	var providerPaymentID *string
	var status models.PaymentStatus = models.PaymentStatusPending

	switch req.PaymentMethod {
	case models.PaymentMethodCard:
		if req.Card == nil {
			return nil, fmt.Errorf("card details required for card payment")
		}
		response, paymentID, err := s.processCardPayment(ctx, req)
		if err != nil {
			status = models.PaymentStatusFailed
			failureReason := err.Error()
			providerResponse = &models.ProviderResponse{
				FailureCode:    "CARD_ERROR",
				FailureMessage: failureReason,
			}
		} else {
			providerResponse = response
			providerPaymentID = paymentID
			if response.Status == "succeeded" {
				status = models.PaymentStatusSucceeded
			}
		}
	default:
		return nil, fmt.Errorf("unsupported payment method: %s", req.PaymentMethod)
	}

	// Create payment record
	paymentID := uuid.New().String()
	payment := &models.Payment{
		ID:                paymentID,
		OrderID:           req.OrderID,
		UserID:            userID,
		IdempotencyKey:    req.IdempotencyKey,
		PaymentMethod:     req.PaymentMethod,
		Provider:          "stripe",
		ProviderPaymentID: providerPaymentID,
		ProviderResponse:  providerResponse,
		Currency:          req.Currency,
		Amount:            req.Amount,
		Status:            status,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}

	if status == models.PaymentStatusSucceeded {
		now := time.Now().UTC()
		payment.PaidAt = &now
	}

	// Insert into database
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO payments (
			id, order_id, user_id, idempotency_key, payment_method, provider,
			provider_payment_id, provider_response, currency, amount, status,
			paid_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		payment.ID, payment.OrderID, payment.UserID, payment.IdempotencyKey,
		payment.PaymentMethod, payment.Provider, payment.ProviderPaymentID,
		payment.ProviderResponse, payment.Currency, payment.Amount, payment.Status,
		payment.PaidAt, payment.CreatedAt, payment.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}

	// Publish event
	if err := s.publishPaymentEvent(ctx, "payment.created", payment); err != nil {
		log.Printf("Failed to publish payment.created event: %v", err)
		// Don't fail the payment creation for event publishing errors
	}

	if status == models.PaymentStatusSucceeded {
		if err := s.publishPaymentEvent(ctx, "payment.succeeded", payment); err != nil {
			log.Printf("Failed to publish payment.succeeded event: %v", err)
		}
	}

	return payment, nil
}

// GetPayment retrieves a payment by ID
func (s *PaymentService) GetPayment(ctx context.Context, paymentID string) (*models.Payment, error) {
	var payment models.Payment
	var paidAt sql.NullTime
	var providerPaymentID sql.NullString
	var failureReason sql.NullString

	err := s.db.QueryRowContext(ctx, `
		SELECT id, order_id, user_id, idempotency_key, payment_method, provider,
			   provider_payment_id, provider_response, currency, amount, status,
			   failure_reason, paid_at, version, created_at, updated_at
		FROM payments WHERE id = $1`, paymentID).Scan(
		&payment.ID, &payment.OrderID, &payment.UserID, &payment.IdempotencyKey,
		&payment.PaymentMethod, &payment.Provider, &providerPaymentID,
		&payment.ProviderResponse, &payment.Currency, &payment.Amount, &payment.Status,
		&failureReason, &paidAt, &payment.Version, &payment.CreatedAt, &payment.UpdatedAt)

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
	if failureReason.Valid {
		payment.FailureReason = &failureReason.String
	}

	return &payment, nil
}

// ListPayments retrieves payments for a user
func (s *PaymentService) ListPayments(ctx context.Context, userID string, limit, offset int) ([]*models.Payment, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, order_id, user_id, idempotency_key, payment_method, provider,
			   provider_payment_id, provider_response, currency, amount, status,
			   failure_reason, paid_at, version, created_at, updated_at
		FROM payments
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`, userID, limit, offset)

	if err != nil {
		return nil, fmt.Errorf("failed to list payments: %w", err)
	}
	defer rows.Close()

	var payments []*models.Payment
	for rows.Next() {
		var payment models.Payment
		var paidAt sql.NullTime
		var providerPaymentID sql.NullString
		var failureReason sql.NullString

		err := rows.Scan(
			&payment.ID, &payment.OrderID, &payment.UserID, &payment.IdempotencyKey,
			&payment.PaymentMethod, &payment.Provider, &providerPaymentID,
			&payment.ProviderResponse, &payment.Currency, &payment.Amount, &payment.Status,
			&failureReason, &paidAt, &payment.Version, &payment.CreatedAt, &payment.UpdatedAt)

		if err != nil {
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}

		if providerPaymentID.Valid {
			payment.ProviderPaymentID = &providerPaymentID.String
		}
		if paidAt.Valid {
			payment.PaidAt = &paidAt.Time
		}
		if failureReason.Valid {
			payment.FailureReason = &failureReason.String
		}

		payments = append(payments, &payment)
	}

	return payments, nil
}

// processCardPayment processes a card payment
func (s *PaymentService) processCardPayment(ctx context.Context, req *models.PaymentRequest) (*models.ProviderResponse, *string, error) {
	if s.config.UseStripeMock {
		// Mock successful payment
		response := &models.ProviderResponse{
			ID:              "pi_mock_" + uuid.New().String(),
			Object:          "payment_intent",
			Amount:          int64(req.Amount * 100), // Convert to cents
			Currency:        req.Currency,
			Status:          "succeeded",
			ClientSecret:    "pi_mock_client_secret",
			PaymentIntentID: "pi_mock_" + uuid.New().String(),
		}
		paymentID := "pi_mock_" + uuid.New().String()
		return response, &paymentID, nil
	}

	if s.stripeClient == nil {
		return nil, nil, fmt.Errorf("Stripe client not configured")
	}

	// Create PaymentIntent
	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(int64(req.Amount * 100)), // Convert to cents
		Currency: stripe.String(req.Currency),
		PaymentMethodTypes: stripe.StringSlice([]string{
			"card",
		}),
		Metadata: map[string]string{
			"order_id": req.OrderID,
		},
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create payment intent: %w", err)
	}

	response := &models.ProviderResponse{
		ID:              pi.ID,
		Object:          "payment_intent",
		Amount:          pi.Amount,
		Currency:        pi.Currency,
		Status:          string(pi.Status),
		ClientSecret:    pi.ClientSecret,
		PaymentIntentID: pi.ID,
	}

	return response, &pi.ID, nil
}

// publishPaymentEvent publishes a payment event to Kafka
func (s *PaymentService) publishPaymentEvent(ctx context.Context, eventType string, payment *models.Payment) error {
	event := map[string]interface{}{
		"specversion":    "1.0",
		"type":          fmt.Sprintf("com.ecommerce.%s", eventType),
		"source":        "/payment-service",
		"id":            uuid.New().String(),
		"time":          time.Now().UTC().Format(time.RFC3339),
		"correlation_id": ctx.Value("request_id"),
		"data": map[string]interface{}{
			"payment_id":     payment.ID,
			"order_id":       payment.OrderID,
			"user_id":        payment.UserID,
			"amount":         payment.Amount,
			"currency":       payment.Currency,
			"payment_method": payment.PaymentMethod,
			"provider":       payment.Provider,
			"status":         payment.Status,
			"paid_at":        payment.PaidAt,
		},
	}

	eventBytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	err = s.kafkaWriter.WriteMessages(ctx, kafka.Message{
		Topic: eventType,
		Key:   []byte(payment.ID),
		Value: eventBytes,
	})

	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}

	return nil
}
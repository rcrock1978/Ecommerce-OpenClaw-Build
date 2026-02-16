package tests

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"

	"payment-service/config"
	"payment-service/models"
	"payment-service/services"
)

type PaymentServiceTestSuite struct {
	suite.Suite
	db          *sql.DB
	mock        sqlmock.Sqlmock
	kafkaWriter *kafka.Writer
	config      *config.Config
	service     *services.PaymentService
}

func (suite *PaymentServiceTestSuite) SetupTest() {
	var err error
	suite.db, suite.mock, err = sqlmock.New()
	suite.Require().NoError(err)

	suite.config = &config.Config{
		UseStripeMock: true,
	}

	// Mock Kafka writer
	suite.kafkaWriter = &kafka.Writer{}

	suite.service = services.NewPaymentService(suite.db, suite.kafkaWriter, suite.config)
}

func (suite *PaymentServiceTestSuite) TearDownTest() {
	suite.db.Close()
}

func (suite *PaymentServiceTestSuite) TestCreatePayment_Success() {
	userID := uuid.New().String()
	orderID := uuid.New().String()
	idempotencyKey := "test-key-123"

	req := &models.PaymentRequest{
		OrderID:        orderID,
		IdempotencyKey: idempotencyKey,
		PaymentMethod:  models.PaymentMethodCard,
		Amount:         99.99,
		Currency:       "USD",
		Card: &models.CardDetails{
			Number:     "4242424242424242",
			ExpMonth:   12,
			ExpYear:    2026,
			CVC:        "123",
			HolderName: "John Doe",
		},
	}

	// Mock the idempotency check (no existing payment)
	suite.mock.ExpectQuery(`SELECT id FROM payments WHERE idempotency_key = \$1`).
		WithArgs(idempotencyKey).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	// Mock the insert
	paymentID := uuid.New().String()
	suite.mock.ExpectExec(`INSERT INTO payments`).
		WithArgs(sqlmock.AnyArg(), orderID, userID, idempotencyKey, models.PaymentMethodCard, "stripe",
			sqlmock.AnyArg(), sqlmock.AnyArg(), "USD", 99.99, models.PaymentStatusSucceeded,
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	payment, err := suite.service.CreatePayment(context.Background(), req, userID)

	suite.NoError(err)
	suite.NotNil(payment)
	suite.Equal(paymentID, payment.ID)
	suite.Equal(orderID, payment.OrderID)
	suite.Equal(userID, payment.UserID)
	suite.Equal(models.PaymentStatusSucceeded, payment.Status)
	suite.Equal(99.99, payment.Amount)
	suite.Equal("USD", payment.Currency)
}

func (suite *PaymentServiceTestSuite) TestCreatePayment_Idempotency() {
	userID := uuid.New().String()
	orderID := uuid.New().String()
	idempotencyKey := "test-key-123"
	existingPaymentID := uuid.New().String()

	req := &models.PaymentRequest{
		OrderID:        orderID,
		IdempotencyKey: idempotencyKey,
		PaymentMethod:  models.PaymentMethodCard,
		Amount:         99.99,
		Currency:       "USD",
	}

	// Mock existing payment found
	suite.mock.ExpectQuery(`SELECT id FROM payments WHERE idempotency_key = \$1`).
		WithArgs(idempotencyKey).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(existingPaymentID))

	// Mock the get payment query
	suite.mock.ExpectQuery(`SELECT .* FROM payments WHERE id = \$1`).
		WithArgs(existingPaymentID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "order_id", "user_id", "idempotency_key", "payment_method", "provider",
			"provider_payment_id", "provider_response", "currency", "amount", "status",
			"failure_reason", "paid_at", "version", "created_at", "updated_at",
		}).AddRow(
			existingPaymentID, orderID, userID, idempotencyKey, models.PaymentMethodCard, "stripe",
			nil, nil, "USD", 99.99, models.PaymentStatusSucceeded,
			nil, time.Now(), 1, time.Now(), time.Now(),
		))

	payment, err := suite.service.CreatePayment(context.Background(), req, userID)

	suite.NoError(err)
	suite.NotNil(payment)
	suite.Equal(existingPaymentID, payment.ID)
}

func (suite *PaymentServiceTestSuite) TestGetPayment_Success() {
	paymentID := uuid.New().String()
	userID := uuid.New().String()
	orderID := uuid.New().String()

	suite.mock.ExpectQuery(`SELECT .* FROM payments WHERE id = \$1`).
		WithArgs(paymentID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "order_id", "user_id", "idempotency_key", "payment_method", "provider",
			"provider_payment_id", "provider_response", "currency", "amount", "status",
			"failure_reason", "paid_at", "version", "created_at", "updated_at",
		}).AddRow(
			paymentID, orderID, userID, "test-key", models.PaymentMethodCard, "stripe",
			nil, nil, "USD", 99.99, models.PaymentStatusSucceeded,
			nil, time.Now(), 1, time.Now(), time.Now(),
		))

	payment, err := suite.service.GetPayment(context.Background(), paymentID)

	suite.NoError(err)
	suite.NotNil(payment)
	suite.Equal(paymentID, payment.ID)
	suite.Equal(orderID, payment.OrderID)
	suite.Equal(userID, payment.UserID)
}

func (suite *PaymentServiceTestSuite) TestGetPayment_NotFound() {
	paymentID := uuid.New().String()

	suite.mock.ExpectQuery(`SELECT .* FROM payments WHERE id = \$1`).
		WithArgs(paymentID).
		WillReturnRows(sqlmock.NewRows([]string{}))

	payment, err := suite.service.GetPayment(context.Background(), paymentID)

	suite.Error(err)
	suite.Nil(payment)
	suite.Contains(err.Error(), "payment not found")
}

func TestPaymentServiceTestSuite(t *testing.T) {
	suite.Run(t, new(PaymentServiceTestSuite))
}
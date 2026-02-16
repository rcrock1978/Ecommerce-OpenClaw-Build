package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"payment-service/models"
	"payment-service/services"
)

// PaymentHandler handles payment HTTP requests
type PaymentHandler struct {
	paymentService *services.PaymentService
	refundService  *services.RefundService
}

// NewPaymentHandler creates a new payment handler
func NewPaymentHandler(paymentService *services.PaymentService, refundService *services.RefundService) *PaymentHandler {
	return &PaymentHandler{
		paymentService: paymentService,
		refundService:  refundService,
	}
}

// CreatePayment handles POST /api/v1/payments
func (h *PaymentHandler) CreatePayment(c *gin.Context) {
	var req models.PaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Invalid request data",
				"details": err.Error(),
			},
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "User not authenticated",
			},
		})
		return
	}

	payment, err := h.paymentService.CreatePayment(c.Request.Context(), &req, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "PAYMENT_CREATION_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"payment": payment,
	})
}

// GetPayment handles GET /api/v1/payments/:id
func (h *PaymentHandler) GetPayment(c *gin.Context) {
	paymentID := c.Param("id")

	// Validate UUID format
	if _, err := uuid.Parse(paymentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_PAYMENT_ID",
				"message": "Invalid payment ID format",
			},
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "User not authenticated",
			},
		})
		return
	}

	payment, err := h.paymentService.GetPayment(c.Request.Context(), paymentID)
	if err != nil {
		if err.Error() == "payment not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    "PAYMENT_NOT_FOUND",
					"message": "Payment not found",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "PAYMENT_RETRIEVAL_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	// Check if user owns this payment
	if payment.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": gin.H{
				"code":    "FORBIDDEN",
				"message": "Access denied to this payment",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"payment": payment,
	})
}

// ListPayments handles GET /api/v1/payments
func (h *PaymentHandler) ListPayments(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "User not authenticated",
			},
		})
		return
	}

	// Parse pagination parameters
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	payments, err := h.paymentService.ListPayments(c.Request.Context(), userID.(string), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "PAYMENT_LIST_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"payments": payments,
		"pagination": gin.H{
			"limit":  limit,
			"offset": offset,
			"count":  len(payments),
		},
	})
}

// RefundPayment handles POST /api/v1/payments/:id/refund
func (h *PaymentHandler) RefundPayment(c *gin.Context) {
	paymentID := c.Param("id")

	// Validate UUID format
	if _, err := uuid.Parse(paymentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_PAYMENT_ID",
				"message": "Invalid payment ID format",
			},
		})
		return
	}

	var req models.RefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Invalid request data",
				"details": err.Error(),
			},
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "User not authenticated",
			},
		})
		return
	}

	refund, err := h.refundService.CreateRefund(c.Request.Context(), paymentID, &req, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "REFUND_CREATION_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"refund": refund,
	})
}

// GetRefund handles GET /api/v1/refunds/:id
func (h *PaymentHandler) GetRefund(c *gin.Context) {
	refundID := c.Param("id")

	// Validate UUID format
	if _, err := uuid.Parse(refundID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_REFUND_ID",
				"message": "Invalid refund ID format",
			},
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "User not authenticated",
			},
		})
		return
	}

	refund, err := h.refundService.GetRefund(c.Request.Context(), refundID)
	if err != nil {
		if err.Error() == "refund not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    "REFUND_NOT_FOUND",
					"message": "Refund not found",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "REFUND_RETRIEVAL_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	// Get payment to check ownership
	payment, err := h.paymentService.GetPayment(c.Request.Context(), refund.PaymentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "PAYMENT_RETRIEVAL_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	// Check if user owns this payment
	if payment.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": gin.H{
				"code":    "FORBIDDEN",
				"message": "Access denied to this refund",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"refund": refund,
	})
}
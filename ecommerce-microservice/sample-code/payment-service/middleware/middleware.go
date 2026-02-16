package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// CORS middleware
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// RequestID middleware generates a unique request ID
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// RateLimiter middleware implements basic rate limiting
func RateLimiter() gin.HandlerFunc {
	// Simple in-memory rate limiter (in production, use Redis)
	requests := make(map[string][]time.Time)

	return func(c *gin.Context) {
		// Get client identifier (IP or user ID if authenticated)
		clientID := c.ClientIP()
		if userID, exists := c.Get("user_id"); exists {
			clientID = userID.(string)
		}

		now := time.Now()
		window := now.Add(-time.Minute) // 1 minute window

		// Clean old requests
		var recentRequests []time.Time
		for _, t := range requests[clientID] {
			if t.After(window) {
				recentRequests = append(recentRequests, t)
			}
		}

		// Check rate limit (100 requests per minute)
		if len(recentRequests) >= 100 {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": gin.H{
					"code":    "RATE_LIMITED",
					"message": "Too many requests",
				},
			})
			c.Abort()
			return
		}

		// Add current request
		requests[clientID] = append(recentRequests, now)
		c.Next()
	}
}

// JWTClaims represents JWT claims
type JWTClaims struct {
	UserID    string   `json:"user_id"`
	Email     string   `json:"email"`
	Roles     []string `json:"roles,omitempty"`
	Issuer    string   `json:"iss"`
	Subject   string   `json:"sub"`
	ExpiresAt int64    `json:"exp"`
	IssuedAt  int64    `json:"iat"`
}

// Valid implements jwt.Claims interface
func (c JWTClaims) Valid() error {
	return nil
}

// JWTAuth middleware validates JWT tokens
func JWTAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{
					"code":    "MISSING_AUTH_HEADER",
					"message": "Authorization header required",
				},
			})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{
					"code":    "INVALID_AUTH_FORMAT",
					"message": "Invalid authorization header format",
				},
			})
			c.Abort()
			return
		}

		tokenString := tokenParts[1]

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(secret), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{
					"code":    "INVALID_TOKEN",
					"message": "Invalid or expired token",
				},
			})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
			c.Set("user_id", claims.UserID)
			c.Set("user_email", claims.Email)
			c.Set("user_roles", claims.Roles)
			c.Next()
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{
					"code":    "INVALID_TOKEN_CLAIMS",
					"message": "Invalid token claims",
				},
			})
			c.Abort()
			return
		}
	}
}
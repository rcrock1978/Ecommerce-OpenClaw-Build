package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port             int
	Environment      string
	JWTSecret        string
	JWTRefreshSecret string
	DatabaseURL      string
	KafkaBrokers     []string
	StripeSecretKey  string
	StripePublishableKey string
	StripeWebhookSecret  string
	UseStripeMock    bool
	BackoffFactor    float64
}

func Load() *Config {
	return &Config{
		Port:                  getEnvAsInt("PORT", 3005),
		Environment:           getEnv("NODE_ENV", "development"),
		JWTSecret:             getEnv("JWT_SECRET", "local-dev-jwt-secret-change-in-prod"),
		JWTRefreshSecret:      getEnv("JWT_REFRESH_SECRET", "local-dev-refresh-secret-change-in-prod"),
		DatabaseURL:           getEnv("DATABASE_URL", "postgres://postgres:postgres@postgres:5432/payments?sslmode=disable"),
		KafkaBrokers:          strings.Split(getEnv("KAFKA_BROKERS", "kafka:29092"), ","),
		StripeSecretKey:       getEnv("STRIPE_SECRET_KEY", ""),
		StripePublishableKey:  getEnv("STRIPE_PUBLISHABLE_KEY", ""),
		StripeWebhookSecret:   getEnv("STRIPE_WEBHOOK_SECRET", ""),
		UseStripeMock:         getEnvAsBool("USE_STRIPE_MOCK", true),
		BackoffFactor:         getEnvAsFloat("BACKOFF_FACTOR", 2.0),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
		log.Printf("Invalid value for %s, using default: %d", key, defaultValue)
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
		log.Printf("Invalid value for %s, using default: %t", key, defaultValue)
	}
	return defaultValue
}

func getEnvAsFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
		log.Printf("Invalid value for %s, using default: %f", key, defaultValue)
	}
	return defaultValue
}
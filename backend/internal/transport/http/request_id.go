package httptransport

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"meal/backend/internal/security"
)

const (
	requestIDContextKey = "requestId"
	requestIDHeader     = "X-Request-ID"
)

func RequestID(generator security.Generator) gin.HandlerFunc {
	return func(context *gin.Context) {
		requestID := context.GetHeader(requestIDHeader)
		if requestID == "" {
			generated, err := generator.UUID()
			if err != nil {
				context.AbortWithStatusJSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "処理を完了できませんでした。", ""))
				return
			}
			requestID = generated
		}
		context.Set(requestIDContextKey, requestID)
		context.Header(requestIDHeader, requestID)
		context.Next()
	}
}

func requestID(context *gin.Context) string {
	value, exists := context.Get(requestIDContextKey)
	if !exists {
		return ""
	}
	requestID, valid := value.(string)
	if !valid {
		return ""
	}
	return requestID
}

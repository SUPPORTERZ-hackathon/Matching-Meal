package httptransport

import (
	stdcontext "context"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"meal/backend/internal/domain"
	"meal/backend/internal/service"
)

type RestaurantSearchHandler struct {
	service *service.RestaurantSearchService
}

type restaurantCoordinatesResponse struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type restaurantCandidateResponse struct {
	ID           string                         `json:"id"`
	Name         string                         `json:"name"`
	PhotoURL     *string                        `json:"photoUrl"`
	OpeningHours *string                        `json:"openingHours"`
	ClosedDays   *string                        `json:"closedDays"`
	DinnerBudget *string                        `json:"dinnerBudget"`
	Access       *string                        `json:"access"`
	StationName  *string                        `json:"stationName"`
	DetailURL    *string                        `json:"detailUrl"`
	Coordinates  *restaurantCoordinatesResponse `json:"coordinates"`
	Source       string                         `json:"source"`
}

type restaurantSearchResponse struct {
	Data struct {
		Room        restaurantSearchRoomResponse  `json:"room"`
		GenreID     string                        `json:"genreId"`
		Restaurants []restaurantCandidateResponse `json:"restaurants"`
	} `json:"data"`
}

type restaurantSearchRoomResponse struct {
	ID        string            `json:"id"`
	Status    domain.RoomStatus `json:"status"`
	Version   int64             `json:"version"`
	ExpiresAt time.Time         `json:"expiresAt"`
}

func NewRestaurantSearchHandler(restaurantService *service.RestaurantSearchService) *RestaurantSearchHandler {
	return &RestaurantSearchHandler{service: restaurantService}
}

func RegisterRestaurantSearchRoutes(routes gin.IRoutes, handler *RestaurantSearchHandler) {
	routes.POST("/api/v1/rooms/:roomId/restaurant-candidates/search", handler.Search)
	routes.GET("/api/v1/rooms/:roomId/restaurant-candidates", handler.Get)
}

func (handler *RestaurantSearchHandler) Search(context *gin.Context) {
	handler.respond(context, true)
}

func (handler *RestaurantSearchHandler) Get(context *gin.Context) {
	handler.respond(context, false)
}

func (handler *RestaurantSearchHandler) respond(context *gin.Context, executeSearch bool) {
	sessionToken, ok := bearerToken(context.GetHeader("Authorization"))
	if !ok {
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
		return
	}
	var result service.RestaurantSearchResult
	var err error
	if executeSearch {
		result, err = handler.service.Search(context.Request.Context(), context.Param(roomIDParam), sessionToken)
	} else {
		result, err = handler.service.Get(context.Request.Context(), context.Param(roomIDParam), sessionToken)
	}
	switch {
	case errors.Is(err, domain.ErrInvalidRoomID):
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_REQUEST", "ルームIDを確認してください。", requestID(context)))
	case errors.Is(err, service.ErrUnauthorized):
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
	case errors.Is(err, service.ErrForbidden):
		context.JSON(http.StatusForbidden, errorResponse("FORBIDDEN", "このルームへアクセスする権限がありません。", requestID(context)))
	case errors.Is(err, service.ErrHostRequired):
		context.JSON(http.StatusForbidden, errorResponse("HOST_REQUIRED", "ホストだけが店舗を検索できます。", requestID(context)))
	case errors.Is(err, service.ErrRoomNotFound):
		context.JSON(http.StatusNotFound, errorResponse("ROOM_NOT_FOUND", "ルームが見つかりません。", requestID(context)))
	case errors.Is(err, service.ErrRestaurantCandidatesNotReady):
		context.JSON(http.StatusConflict, errorResponse("RESTAURANT_CANDIDATES_NOT_READY", "店舗候補を準備しています。", requestID(context)))
	case errors.Is(err, service.ErrRestaurantSearchNotActive):
		context.JSON(http.StatusConflict, errorResponse("RESTAURANT_SEARCH_NOT_ACTIVE", "現在は店舗を検索できません。", requestID(context)))
	case errors.Is(err, service.ErrRestaurantCandidatesNotFound):
		context.JSON(http.StatusUnprocessableEntity, errorResponse("RESTAURANT_CANDIDATES_NOT_FOUND", "条件に合う店舗が見つかりませんでした。", requestID(context)))
	case errors.Is(err, service.ErrRestaurantSearchFailed):
		context.JSON(http.StatusBadGateway, errorResponse("RESTAURANT_SEARCH_FAILED", "店舗検索サービスから結果を取得できませんでした。", requestID(context)))
	case errors.Is(err, service.ErrRestaurantSearchTimeout):
		context.JSON(http.StatusGatewayTimeout, errorResponse("RESTAURANT_SEARCH_TIMEOUT", "店舗検索がタイムアウトしました。", requestID(context)))
	case errors.Is(err, stdcontext.DeadlineExceeded):
		context.JSON(http.StatusServiceUnavailable, errorResponse("SERVICE_UNAVAILABLE", "時間をおいて再度お試しください。", requestID(context)))
	case err != nil:
		context.Error(err)
		context.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "処理を完了できませんでした。", requestID(context)))
	default:
		context.JSON(http.StatusOK, newRestaurantSearchResponse(result))
	}
}

func newRestaurantSearchResponse(result service.RestaurantSearchResult) restaurantSearchResponse {
	var response restaurantSearchResponse
	response.Data.Room = restaurantSearchRoomResponse{
		ID: result.Room.ID, Status: result.Room.Status, Version: result.Room.Version, ExpiresAt: result.Room.ExpiresAt,
	}
	response.Data.GenreID = result.GenreID
	response.Data.Restaurants = make([]restaurantCandidateResponse, 0, len(result.Candidates))
	for _, candidate := range result.Candidates {
		response.Data.Restaurants = append(response.Data.Restaurants, restaurantCandidateToResponse(candidate))
	}
	return response
}

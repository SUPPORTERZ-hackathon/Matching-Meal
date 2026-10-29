package httptransport

import (
	stdcontext "context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"meal/backend/internal/domain"
	"meal/backend/internal/service"
)

const (
	roomIDParam  = "roomId"
	roomRefParam = "roomRef"
)

type RoomHandler struct {
	service *service.RoomService
}

type createRoomRequest struct {
	Nickname string `json:"nickname" binding:"required"`
}

type joinRoomRequest struct {
	Nickname string `json:"nickname" binding:"required"`
}

type roomResponse struct {
	ID        string            `json:"id"`
	JoinCode  string            `json:"joinCode"`
	Status    domain.RoomStatus `json:"status"`
	Version   int64             `json:"version"`
	ExpiresAt time.Time         `json:"expiresAt"`
}

type participantResponse struct {
	ID       string                 `json:"id"`
	Nickname string                 `json:"nickname"`
	Role     domain.ParticipantRole `json:"role"`
}

type roomSessionResponse struct {
	Data struct {
		Room         roomResponse        `json:"room"`
		Participant  participantResponse `json:"participant"`
		SessionToken string              `json:"sessionToken"`
	} `json:"data"`
}

type roomStateResponse struct {
	Data struct {
		Room                 roomResponse          `json:"room"`
		CurrentParticipantID string                `json:"currentParticipantId"`
		Participants         []participantResponse `json:"participants"`
	} `json:"data"`
}

type apiError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"requestId"`
}

type apiErrorResponse struct {
	Error apiError `json:"error"`
}

func NewRoomHandler(roomService *service.RoomService) *RoomHandler {
	return &RoomHandler{service: roomService}
}

func RegisterRoomRoutes(routes gin.IRoutes, handler *RoomHandler) {
	routes.POST("/api/v1/rooms", handler.Create)
	routes.POST("/api/v1/rooms/:roomRef/participants", handler.Join)
	routes.GET("/api/v1/rooms/:roomId", handler.GetState)
	routes.POST("/api/v1/rooms/:roomRef/genre-voting/start", handler.StartGenreVoting)
}

func (handler *RoomHandler) Create(context *gin.Context) {
	var request createRoomRequest
	if err := context.ShouldBindJSON(&request); err != nil {
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_REQUEST", "入力内容を確認してください。", requestID(context)))
		return
	}
	result, err := handler.service.Create(context.Request.Context(), request.Nickname)
	if errors.Is(err, domain.ErrInvalidNickname) {
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_REQUEST", "ニックネームは1文字以上20文字以下で入力してください。", requestID(context)))
		return
	}
	if errors.Is(err, service.ErrRoomCodeGeneration) {
		context.JSON(http.StatusInternalServerError, errorResponse("ROOM_CODE_GENERATION_FAILED", "ルームを作成できませんでした。", requestID(context)))
		return
	}
	if errors.Is(err, stdcontext.DeadlineExceeded) {
		context.JSON(http.StatusServiceUnavailable, errorResponse("SERVICE_UNAVAILABLE", "時間をおいて再度お試しください。", requestID(context)))
		return
	}
	if err != nil {
		context.Error(err)
		context.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "処理を完了できませんでした。", requestID(context)))
		return
	}

	response := newRoomSessionResponse(result.Room, result.Participant, result.SessionToken)
	context.JSON(http.StatusCreated, response)
}

func (handler *RoomHandler) Join(context *gin.Context) {
	var request joinRoomRequest
	if err := context.ShouldBindJSON(&request); err != nil {
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_REQUEST", "入力内容を確認してください。", requestID(context)))
		return
	}
	result, err := handler.service.Join(context.Request.Context(), context.Param(roomRefParam), request.Nickname)
	switch {
	case errors.Is(err, domain.ErrInvalidJoinCode), errors.Is(err, domain.ErrInvalidNickname):
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_REQUEST", "参加コードまたはニックネームを確認してください。", requestID(context)))
		return
	case errors.Is(err, service.ErrRoomNotFound):
		context.JSON(http.StatusNotFound, errorResponse("ROOM_NOT_FOUND", "ルームが見つかりません。", requestID(context)))
		return
	case errors.Is(err, service.ErrRoomNotJoinable):
		context.JSON(http.StatusConflict, errorResponse("ROOM_NOT_JOINABLE", "このルームには現在参加できません。", requestID(context)))
		return
	case errors.Is(err, service.ErrRoomCapacityReached):
		context.JSON(http.StatusConflict, errorResponse("ROOM_CAPACITY_REACHED", "このルームにはこれ以上参加できません。", requestID(context)))
		return
	case errors.Is(err, stdcontext.DeadlineExceeded):
		context.JSON(http.StatusServiceUnavailable, errorResponse("SERVICE_UNAVAILABLE", "時間をおいて再度お試しください。", requestID(context)))
		return
	case err != nil:
		context.Error(err)
		context.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "処理を完了できませんでした。", requestID(context)))
		return
	}

	response := newRoomSessionResponse(result.Room, result.Participant, result.SessionToken)
	context.JSON(http.StatusCreated, response)
}

func (handler *RoomHandler) GetState(context *gin.Context) {
	sessionToken, ok := bearerToken(context.GetHeader("Authorization"))
	if !ok {
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
		return
	}

	result, err := handler.service.GetState(context.Request.Context(), context.Param(roomIDParam), sessionToken)
	switch {
	case errors.Is(err, domain.ErrInvalidRoomID):
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_REQUEST", "ルームIDを確認してください。", requestID(context)))
		return
	case errors.Is(err, service.ErrUnauthorized):
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
		return
	case errors.Is(err, service.ErrForbidden):
		context.JSON(http.StatusForbidden, errorResponse("FORBIDDEN", "このルームを表示する権限がありません。", requestID(context)))
		return
	case errors.Is(err, service.ErrRoomNotFound):
		context.JSON(http.StatusNotFound, errorResponse("ROOM_NOT_FOUND", "ルームが見つかりません。", requestID(context)))
		return
	case errors.Is(err, stdcontext.DeadlineExceeded):
		context.JSON(http.StatusServiceUnavailable, errorResponse("SERVICE_UNAVAILABLE", "時間をおいて再度お試しください。", requestID(context)))
		return
	case err != nil:
		context.Error(err)
		context.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "処理を完了できませんでした。", requestID(context)))
		return
	}

	context.JSON(http.StatusOK, newRoomStateResponse(result))
}

func (handler *RoomHandler) StartGenreVoting(context *gin.Context) {
	sessionToken, ok := bearerToken(context.GetHeader("Authorization"))
	if !ok {
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
		return
	}

	result, err := handler.service.StartGenreVoting(context.Request.Context(), context.Param(roomRefParam), sessionToken)
	switch {
	case errors.Is(err, domain.ErrInvalidRoomID):
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_REQUEST", "ルームIDを確認してください。", requestID(context)))
		return
	case errors.Is(err, service.ErrUnauthorized):
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
		return
	case errors.Is(err, service.ErrForbidden):
		context.JSON(http.StatusForbidden, errorResponse("FORBIDDEN", "このルームを操作する権限がありません。", requestID(context)))
		return
	case errors.Is(err, service.ErrHostRequired):
		context.JSON(http.StatusForbidden, errorResponse("HOST_REQUIRED", "ホストだけが投票を開始できます。", requestID(context)))
		return
	case errors.Is(err, service.ErrRoomNotFound):
		context.JSON(http.StatusNotFound, errorResponse("ROOM_NOT_FOUND", "ルームが見つかりません。", requestID(context)))
		return
	case errors.Is(err, service.ErrNotEnoughParticipants):
		context.JSON(http.StatusConflict, errorResponse("NOT_ENOUGH_PARTICIPANTS", "投票開始には2人以上の参加者が必要です。", requestID(context)))
		return
	case errors.Is(err, service.ErrInvalidRoomTransition):
		context.JSON(http.StatusConflict, errorResponse("INVALID_ROOM_TRANSITION", "現在のルーム状態では投票を開始できません。", requestID(context)))
		return
	case errors.Is(err, stdcontext.DeadlineExceeded):
		context.JSON(http.StatusServiceUnavailable, errorResponse("SERVICE_UNAVAILABLE", "時間をおいて再度お試しください。", requestID(context)))
		return
	case err != nil:
		context.Error(err)
		context.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "処理を完了できませんでした。", requestID(context)))
		return
	}

	context.JSON(http.StatusOK, newRoomStateResponse(result))
}

func newRoomSessionResponse(room domain.Room, participant domain.Participant, sessionToken string) roomSessionResponse {
	response := roomSessionResponse{}
	response.Data.Room = roomResponse{
		ID: room.ID, JoinCode: room.JoinCode, Status: room.Status,
		Version: room.Version, ExpiresAt: room.ExpiresAt,
	}
	response.Data.Participant = participantResponse{
		ID: participant.ID, Nickname: participant.Nickname, Role: participant.Role,
	}
	response.Data.SessionToken = sessionToken
	return response
}

func newRoomStateResponse(result service.GetRoomStateResult) roomStateResponse {
	response := roomStateResponse{}
	response.Data.Room = roomResponse{
		ID: result.Room.ID, JoinCode: result.Room.JoinCode, Status: result.Room.Status,
		Version: result.Room.Version, ExpiresAt: result.Room.ExpiresAt,
	}
	response.Data.CurrentParticipantID = result.CurrentParticipantID
	response.Data.Participants = make([]participantResponse, 0, len(result.Participants))
	for _, participant := range result.Participants {
		response.Data.Participants = append(response.Data.Participants, participantResponse{
			ID: participant.ID, Nickname: participant.Nickname, Role: participant.Role,
		})
	}
	return response
}

func bearerToken(authorization string) (string, bool) {
	parts := strings.Fields(authorization)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
		return "", false
	}
	return parts[1], true
}

func errorResponse(code string, message string, requestID string) apiErrorResponse {
	return apiErrorResponse{Error: apiError{Code: code, Message: message, RequestID: requestID}}
}

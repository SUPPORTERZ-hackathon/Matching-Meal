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
	result, err := handler.service.Join(context.Request.Context(), context.Param("joinCode"), request.Nickname)
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

func errorResponse(code string, message string, requestID string) apiErrorResponse {
	return apiErrorResponse{Error: apiError{Code: code, Message: message, RequestID: requestID}}
}

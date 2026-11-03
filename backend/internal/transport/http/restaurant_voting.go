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

type RestaurantVotingHandler struct {
	service restaurantVotingUseCase
}

type restaurantVotingUseCase interface {
	Submit(stdcontext.Context, string, string, []domain.RestaurantVote) (domain.RestaurantVotingState, error)
	GetState(stdcontext.Context, string, string) (domain.RestaurantVotingState, error)
}

type restaurantVoteRequest struct {
	RestaurantID string                      `json:"restaurantId" binding:"required"`
	Choice       domain.RestaurantVoteChoice `json:"choice" binding:"required"`
}

type submitRestaurantVotesRequest struct {
	Votes []restaurantVoteRequest `json:"votes" binding:"required"`
}

type restaurantVotingParticipantResponse struct {
	ID        string                 `json:"id"`
	Nickname  string                 `json:"nickname"`
	Role      domain.ParticipantRole `json:"role"`
	Submitted bool                   `json:"submitted"`
}

type restaurantVoteResultResponse struct {
	Restaurant     restaurantCandidateResponse     `json:"restaurant"`
	LikeCount      int                             `json:"likeCount"`
	DecisionMethod domain.RestaurantDecisionMethod `json:"decisionMethod"`
	DecidedAt      time.Time                       `json:"decidedAt"`
}

type restaurantVotingResponse struct {
	Data struct {
		Room                      roomResponse                          `json:"room"`
		CurrentParticipantID      string                                `json:"currentParticipantId"`
		Submitted                 bool                                  `json:"submitted"`
		SubmittedAt               *time.Time                            `json:"submittedAt"`
		SubmittedParticipantCount int                                   `json:"submittedParticipantCount"`
		TotalParticipantCount     int                                   `json:"totalParticipantCount"`
		Participants              []restaurantVotingParticipantResponse `json:"participants"`
		Result                    *restaurantVoteResultResponse         `json:"result"`
	} `json:"data"`
}

func NewRestaurantVotingHandler(votingService restaurantVotingUseCase) *RestaurantVotingHandler {
	return &RestaurantVotingHandler{service: votingService}
}

func RegisterRestaurantVotingRoutes(routes gin.IRoutes, handler *RestaurantVotingHandler) {
	routes.PUT("/api/v1/rooms/:roomKey/restaurant-votes", handler.Submit)
	routes.GET("/api/v1/rooms/:roomKey/restaurant-voting", handler.GetState)
}

func (handler *RestaurantVotingHandler) Submit(context *gin.Context) {
	sessionToken, ok := bearerToken(context.GetHeader("Authorization"))
	if !ok {
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
		return
	}
	var request submitRestaurantVotesRequest
	if err := context.ShouldBindJSON(&request); err != nil {
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_RESTAURANT_VOTES", "店舗投票を確認してください。", requestID(context)))
		return
	}
	votes := make([]domain.RestaurantVote, 0, len(request.Votes))
	for _, vote := range request.Votes {
		votes = append(votes, domain.RestaurantVote{RestaurantID: vote.RestaurantID, Choice: vote.Choice})
	}
	result, err := handler.service.Submit(context.Request.Context(), context.Param(roomKeyParam), sessionToken, votes)
	if writeRestaurantVotingError(context, err) {
		return
	}
	context.JSON(http.StatusOK, newRestaurantVotingResponse(result))
}

func (handler *RestaurantVotingHandler) GetState(context *gin.Context) {
	sessionToken, ok := bearerToken(context.GetHeader("Authorization"))
	if !ok {
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
		return
	}
	result, err := handler.service.GetState(context.Request.Context(), context.Param(roomKeyParam), sessionToken)
	if writeRestaurantVotingError(context, err) {
		return
	}
	context.JSON(http.StatusOK, newRestaurantVotingResponse(result))
}

func writeRestaurantVotingError(context *gin.Context, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, domain.ErrInvalidRoomID), errors.Is(err, domain.ErrInvalidRestaurantVotes):
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_RESTAURANT_VOTES", "店舗投票を確認してください。", requestID(context)))
	case errors.Is(err, service.ErrUnauthorized):
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
	case errors.Is(err, service.ErrForbidden):
		context.JSON(http.StatusForbidden, errorResponse("FORBIDDEN", "このルームを操作する権限がありません。", requestID(context)))
	case errors.Is(err, service.ErrRoomNotFound):
		context.JSON(http.StatusNotFound, errorResponse("ROOM_NOT_FOUND", "ルームが見つかりません。", requestID(context)))
	case errors.Is(err, service.ErrRestaurantCandidatesMismatch):
		context.JSON(http.StatusConflict, errorResponse("RESTAURANT_CANDIDATES_MISMATCH", "投票対象の店舗候補を確認してください。", requestID(context)))
	case errors.Is(err, service.ErrRestaurantVotingNotActive):
		context.JSON(http.StatusConflict, errorResponse("RESTAURANT_VOTING_NOT_ACTIVE", "現在は店舗投票を提出できません。", requestID(context)))
	case errors.Is(err, service.ErrRestaurantVotingNotReady):
		context.JSON(http.StatusConflict, errorResponse("RESTAURANT_VOTING_NOT_READY", "店舗投票を準備しています。", requestID(context)))
	case errors.Is(err, service.ErrVoteAlreadySubmitted):
		context.JSON(http.StatusConflict, errorResponse("VOTE_ALREADY_SUBMITTED", "店舗投票はすでに提出済みです。", requestID(context)))
	case errors.Is(err, stdcontext.DeadlineExceeded):
		context.JSON(http.StatusServiceUnavailable, errorResponse("SERVICE_UNAVAILABLE", "時間をおいて再度お試しください。", requestID(context)))
	default:
		context.Error(err)
		context.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "処理を完了できませんでした。", requestID(context)))
	}
	return true
}

func newRestaurantVotingResponse(state domain.RestaurantVotingState) restaurantVotingResponse {
	response := restaurantVotingResponse{}
	response.Data.Room = roomResponse{
		ID: state.Room.ID, JoinCode: state.Room.JoinCode, Status: state.Room.Status,
		Version: state.Room.Version, ExpiresAt: state.Room.ExpiresAt,
	}
	response.Data.CurrentParticipantID = state.CurrentParticipantID
	response.Data.Submitted = state.Submitted
	response.Data.SubmittedAt = state.SubmittedAt
	response.Data.SubmittedParticipantCount = state.SubmittedParticipantCount
	response.Data.TotalParticipantCount = state.TotalParticipantCount
	response.Data.Participants = make([]restaurantVotingParticipantResponse, 0, len(state.Participants))
	for _, participant := range state.Participants {
		response.Data.Participants = append(response.Data.Participants, restaurantVotingParticipantResponse{
			ID: participant.Participant.ID, Nickname: participant.Participant.Nickname,
			Role: participant.Participant.Role, Submitted: participant.Submitted,
		})
	}
	if state.Result != nil {
		response.Data.Result = &restaurantVoteResultResponse{
			Restaurant: restaurantCandidateToResponse(state.Result.Restaurant),
			LikeCount:  state.Result.LikeCount, DecisionMethod: state.Result.DecisionMethod,
			DecidedAt: state.Result.DecidedAt,
		}
	}
	return response
}

func restaurantCandidateToResponse(candidate domain.RestaurantCandidate) restaurantCandidateResponse {
	var coordinates *restaurantCoordinatesResponse
	if candidate.Latitude != nil && candidate.Longitude != nil {
		coordinates = &restaurantCoordinatesResponse{Latitude: *candidate.Latitude, Longitude: *candidate.Longitude}
	}
	return restaurantCandidateResponse{
		ID: candidate.RestaurantID, Name: candidate.Name, PhotoURL: candidate.PhotoURL,
		OpeningHours: candidate.OpeningHours, ClosedDays: candidate.ClosedDays,
		DinnerBudget: candidate.DinnerBudget, Access: candidate.Access, StationName: candidate.StationName,
		DetailURL: candidate.DetailURL, Coordinates: coordinates, Source: candidate.Source,
	}
}

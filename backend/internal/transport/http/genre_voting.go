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

type GenreVotingHandler struct {
	service genreVotingUseCase
}

type genreVotingUseCase interface {
	Submit(stdcontext.Context, string, string, []domain.GenreVote) (domain.GenreVotingState, error)
	GetState(stdcontext.Context, string, string) (domain.GenreVotingState, error)
}

type genreVoteRequest struct {
	GenreID string                 `json:"genreId" binding:"required"`
	Choice  domain.GenreVoteChoice `json:"choice" binding:"required"`
}

type submitGenreVotesRequest struct {
	Votes []genreVoteRequest `json:"votes" binding:"required"`
}

type genreVotingParticipantResponse struct {
	ID        string                 `json:"id"`
	Nickname  string                 `json:"nickname"`
	Role      domain.ParticipantRole `json:"role"`
	Submitted bool                   `json:"submitted"`
}

type genreVoteResultResponse struct {
	GenreID        string                     `json:"genreId"`
	LikeCount      int                        `json:"likeCount"`
	DecisionMethod domain.GenreDecisionMethod `json:"decisionMethod"`
	DecidedAt      time.Time                  `json:"decidedAt"`
}

type genreVotingResponse struct {
	Data struct {
		Room                      roomResponse                     `json:"room"`
		CurrentParticipantID      string                           `json:"currentParticipantId"`
		Submitted                 bool                             `json:"submitted"`
		SubmittedAt               *time.Time                       `json:"submittedAt"`
		SubmittedParticipantCount int                              `json:"submittedParticipantCount"`
		TotalParticipantCount     int                              `json:"totalParticipantCount"`
		Participants              []genreVotingParticipantResponse `json:"participants"`
		Result                    *genreVoteResultResponse         `json:"result"`
	} `json:"data"`
}

func NewGenreVotingHandler(genreVotingService genreVotingUseCase) *GenreVotingHandler {
	return &GenreVotingHandler{service: genreVotingService}
}

func RegisterGenreVotingRoutes(routes gin.IRoutes, handler *GenreVotingHandler) {
	routes.PUT("/api/v1/rooms/:roomId/genre-votes", handler.Submit)
	routes.GET("/api/v1/rooms/:roomId/genre-voting", handler.GetState)
}

func (handler *GenreVotingHandler) Submit(context *gin.Context) {
	sessionToken, ok := bearerToken(context.GetHeader("Authorization"))
	if !ok {
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
		return
	}
	var request submitGenreVotesRequest
	if err := context.ShouldBindJSON(&request); err != nil {
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_GENRE_VOTES", "ジャンル投票を確認してください。", requestID(context)))
		return
	}
	votes := make([]domain.GenreVote, 0, len(request.Votes))
	for _, vote := range request.Votes {
		votes = append(votes, domain.GenreVote{GenreID: vote.GenreID, Choice: vote.Choice})
	}
	result, err := handler.service.Submit(context.Request.Context(), context.Param(roomIDParam), sessionToken, votes)
	if writeGenreVotingError(context, err) {
		return
	}
	context.JSON(http.StatusOK, newGenreVotingResponse(result))
}

func (handler *GenreVotingHandler) GetState(context *gin.Context) {
	sessionToken, ok := bearerToken(context.GetHeader("Authorization"))
	if !ok {
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
		return
	}
	result, err := handler.service.GetState(context.Request.Context(), context.Param(roomIDParam), sessionToken)
	if writeGenreVotingError(context, err) {
		return
	}
	context.JSON(http.StatusOK, newGenreVotingResponse(result))
}

func writeGenreVotingError(context *gin.Context, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, domain.ErrInvalidRoomID), errors.Is(err, domain.ErrInvalidGenreVotes):
		context.JSON(http.StatusBadRequest, errorResponse("INVALID_GENRE_VOTES", "ジャンル投票を確認してください。", requestID(context)))
	case errors.Is(err, service.ErrUnauthorized):
		context.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "認証情報を確認してください。", requestID(context)))
	case errors.Is(err, service.ErrForbidden):
		context.JSON(http.StatusForbidden, errorResponse("FORBIDDEN", "このルームを操作する権限がありません。", requestID(context)))
	case errors.Is(err, service.ErrRoomNotFound):
		context.JSON(http.StatusNotFound, errorResponse("ROOM_NOT_FOUND", "ルームが見つかりません。", requestID(context)))
	case errors.Is(err, service.ErrGenreVotingNotActive):
		context.JSON(http.StatusConflict, errorResponse("GENRE_VOTING_NOT_ACTIVE", "現在はジャンル投票を提出できません。", requestID(context)))
	case errors.Is(err, service.ErrVoteAlreadySubmitted):
		context.JSON(http.StatusConflict, errorResponse("VOTE_ALREADY_SUBMITTED", "ジャンル投票はすでに提出済みです。", requestID(context)))
	case errors.Is(err, stdcontext.DeadlineExceeded):
		context.JSON(http.StatusServiceUnavailable, errorResponse("SERVICE_UNAVAILABLE", "時間をおいて再度お試しください。", requestID(context)))
	default:
		context.Error(err)
		context.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "処理を完了できませんでした。", requestID(context)))
	}
	return true
}

func newGenreVotingResponse(state domain.GenreVotingState) genreVotingResponse {
	response := genreVotingResponse{}
	response.Data.Room = roomResponse{
		ID: state.Room.ID, JoinCode: state.Room.JoinCode, Status: state.Room.Status,
		Version: state.Room.Version, ExpiresAt: state.Room.ExpiresAt,
	}
	response.Data.CurrentParticipantID = state.CurrentParticipantID
	response.Data.Submitted = state.Submitted
	response.Data.SubmittedAt = state.SubmittedAt
	response.Data.SubmittedParticipantCount = state.SubmittedParticipantCount
	response.Data.TotalParticipantCount = state.TotalParticipantCount
	response.Data.Participants = make([]genreVotingParticipantResponse, 0, len(state.Participants))
	for _, participant := range state.Participants {
		response.Data.Participants = append(response.Data.Participants, genreVotingParticipantResponse{
			ID: participant.Participant.ID, Nickname: participant.Participant.Nickname,
			Role: participant.Participant.Role, Submitted: participant.Submitted,
		})
	}
	if state.Result != nil {
		response.Data.Result = &genreVoteResultResponse{
			GenreID: state.Result.GenreID, LikeCount: state.Result.LikeCount,
			DecisionMethod: state.Result.DecisionMethod, DecidedAt: state.Result.DecidedAt,
		}
	}
	return response
}

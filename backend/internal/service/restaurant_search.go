package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"meal/backend/internal/domain"
	"meal/backend/internal/hotpepper"
	"meal/backend/internal/repository"
	"meal/backend/internal/security"
)

const restaurantSearchOperationTimeout = 12 * time.Second

var (
	ErrRestaurantCandidatesNotReady = errors.New("restaurant candidates not ready")
	ErrRestaurantCandidatesNotFound = errors.New("restaurant candidates not found")
	ErrRestaurantSearchFailed       = errors.New("restaurant search failed")
	ErrRestaurantSearchTimeout      = errors.New("restaurant search timeout")
	ErrRestaurantSearchNotActive    = errors.New("restaurant search not active")
	ErrRestaurantSearchInconsistent = errors.New("restaurant search inconsistent")
)

type RestaurantSearchResult struct {
	Room       domain.Room
	GenreID    string
	Candidates []domain.RestaurantCandidate
}

type RestaurantSearchService struct {
	repository     repository.RestaurantSearchRepository
	roomRepository repository.RoomRepository
	searcher       hotpepper.Searcher
	selector       RandomIndexSelector
	clock          Clock
}

type restaurantQueryDefinition struct {
	genreCode string
	keyword   string
}

func NewRestaurantSearchService(
	restaurantRepository repository.RestaurantSearchRepository,
	roomRepository repository.RoomRepository,
	searcher hotpepper.Searcher,
	selector RandomIndexSelector,
	clock Clock,
) *RestaurantSearchService {
	return &RestaurantSearchService{
		repository: restaurantRepository, roomRepository: roomRepository,
		searcher: searcher, selector: selector, clock: clock,
	}
}

func (service *RestaurantSearchService) Search(ctx context.Context, rawRoomID string, sessionToken string) (RestaurantSearchResult, error) {
	operationContext, cancel := context.WithTimeout(ctx, restaurantSearchOperationTimeout)
	defer cancel()

	roomID, participant, err := service.validateAndAuthenticate(operationContext, rawRoomID, sessionToken)
	if err != nil {
		return RestaurantSearchResult{}, err
	}
	if participant.Role != domain.ParticipantRoleHost {
		return RestaurantSearchResult{}, ErrHostRequired
	}
	searchContext, err := service.findContext(operationContext, roomID)
	if err != nil {
		return RestaurantSearchResult{}, err
	}
	if len(searchContext.Candidates) > 0 {
		if searchContext.Room.Status != domain.RoomStatusRestaurantVoting && searchContext.Room.Status != domain.RoomStatusDecided {
			return RestaurantSearchResult{}, ErrRestaurantSearchInconsistent
		}
		return resultFromContext(searchContext), nil
	}
	if searchContext.Room.Status != domain.RoomStatusRestaurantSearching {
		return RestaurantSearchResult{}, ErrRestaurantSearchNotActive
	}

	definitions, ok := restaurantQueryDefinitions[searchContext.GenreID]
	if !ok || len(definitions) == 0 || len(definitions) > 2 {
		return RestaurantSearchResult{}, ErrRestaurantSearchInconsistent
	}
	queryCount := domain.MaxRestaurantSearchPool
	if len(definitions) == 2 {
		queryCount = domain.MaxRestaurantSearchPool / 2
	}
	pool := make([]domain.RestaurantCandidate, 0, domain.MaxRestaurantSearchPool)
	seen := make(map[string]struct{}, domain.MaxRestaurantSearchPool)
	for _, definition := range definitions {
		candidates, err := service.searcher.Search(operationContext, hotpepper.Query{
			Latitude: searchContext.SearchCondition.Latitude, Longitude: searchContext.SearchCondition.Longitude,
			Range: searchContext.SearchCondition.Range, GenreCode: definition.genreCode,
			Keyword: definition.keyword, Count: queryCount,
		})
		if errors.Is(err, hotpepper.ErrSearchTimeout) || errors.Is(err, context.DeadlineExceeded) {
			return RestaurantSearchResult{}, ErrRestaurantSearchTimeout
		}
		if err != nil {
			return RestaurantSearchResult{}, ErrRestaurantSearchFailed
		}
		for candidateIndex, candidate := range candidates {
			if candidateIndex >= queryCount {
				break
			}
			if _, exists := seen[candidate.RestaurantID]; exists || candidate.RestaurantID == "" || candidate.Name == "" {
				continue
			}
			seen[candidate.RestaurantID] = struct{}{}
			pool = append(pool, candidate)
			if len(pool) == domain.MaxRestaurantSearchPool {
				break
			}
		}
	}
	if len(pool) == 0 {
		return RestaurantSearchResult{}, ErrRestaurantCandidatesNotFound
	}
	selected, err := service.selectCandidates(pool)
	if err != nil {
		return RestaurantSearchResult{}, err
	}
	room, stored, err := service.repository.SaveCandidatesAndAdvance(operationContext, roomID, selected, service.clock.Now())
	if errors.Is(err, repository.ErrRestaurantSearchNotActive) {
		return RestaurantSearchResult{}, ErrRestaurantSearchNotActive
	}
	if errors.Is(err, repository.ErrRoomNotFound) {
		return RestaurantSearchResult{}, ErrRoomNotFound
	}
	if err != nil {
		return RestaurantSearchResult{}, err
	}
	if len(stored) == 0 || room.Status != domain.RoomStatusRestaurantVoting && room.Status != domain.RoomStatusDecided {
		return RestaurantSearchResult{}, ErrRestaurantSearchInconsistent
	}
	return RestaurantSearchResult{Room: room, GenreID: searchContext.GenreID, Candidates: stored}, nil
}

func (service *RestaurantSearchService) Get(ctx context.Context, rawRoomID string, sessionToken string) (RestaurantSearchResult, error) {
	operationContext, cancel := context.WithTimeout(ctx, roomOperationTimeout)
	defer cancel()

	roomID, _, err := service.validateAndAuthenticate(operationContext, rawRoomID, sessionToken)
	if err != nil {
		return RestaurantSearchResult{}, err
	}
	searchContext, err := service.findContext(operationContext, roomID)
	if err != nil {
		return RestaurantSearchResult{}, err
	}
	if len(searchContext.Candidates) == 0 {
		if searchContext.Room.Status == domain.RoomStatusRestaurantSearching {
			return RestaurantSearchResult{}, ErrRestaurantCandidatesNotReady
		}
		return RestaurantSearchResult{}, ErrRestaurantSearchInconsistent
	}
	if searchContext.Room.Status != domain.RoomStatusRestaurantVoting && searchContext.Room.Status != domain.RoomStatusDecided {
		return RestaurantSearchResult{}, ErrRestaurantSearchInconsistent
	}
	return resultFromContext(searchContext), nil
}

func (service *RestaurantSearchService) validateAndAuthenticate(ctx context.Context, rawRoomID string, sessionToken string) (string, domain.Participant, error) {
	roomID, err := domain.NormalizeRoomID(rawRoomID)
	if err != nil {
		return "", domain.Participant{}, err
	}
	if sessionToken == "" {
		return "", domain.Participant{}, ErrUnauthorized
	}
	participant, err := service.roomRepository.FindParticipantBySessionTokenHash(ctx, security.HashSessionToken(sessionToken))
	if errors.Is(err, repository.ErrParticipantNotFound) {
		return "", domain.Participant{}, ErrUnauthorized
	}
	if err != nil {
		return "", domain.Participant{}, err
	}
	if participant.RoomID != roomID {
		return "", domain.Participant{}, ErrForbidden
	}
	return roomID, participant, nil
}

func (service *RestaurantSearchService) findContext(ctx context.Context, roomID string) (domain.RestaurantSearchContext, error) {
	searchContext, err := service.repository.FindContext(ctx, roomID)
	if errors.Is(err, repository.ErrRoomNotFound) {
		return domain.RestaurantSearchContext{}, ErrRoomNotFound
	}
	if errors.Is(err, repository.ErrRestaurantSearchConditionNotFound) || errors.Is(err, repository.ErrGenreVoteResultNotFound) {
		return domain.RestaurantSearchContext{}, ErrRestaurantSearchInconsistent
	}
	if err != nil {
		return domain.RestaurantSearchContext{}, err
	}
	if searchContext.Room.Status == domain.RoomStatusExpired || !service.clock.Now().Before(searchContext.Room.ExpiresAt) {
		return domain.RestaurantSearchContext{}, ErrRoomNotFound
	}
	return searchContext, nil
}

func (service *RestaurantSearchService) selectCandidates(pool []domain.RestaurantCandidate) ([]domain.RestaurantCandidate, error) {
	selected := append([]domain.RestaurantCandidate(nil), pool...)
	limit := len(selected)
	if limit > domain.MaxRestaurantCandidates {
		limit = domain.MaxRestaurantCandidates
	}
	for index := 0; index < limit && len(selected) > domain.MaxRestaurantCandidates; index++ {
		offset, err := service.selector.SelectIndex(len(selected) - index)
		if err != nil {
			return nil, fmt.Errorf("select restaurant candidate: %w", err)
		}
		if offset < 0 || offset >= len(selected)-index {
			return nil, ErrRestaurantSearchInconsistent
		}
		selected[index], selected[index+offset] = selected[index+offset], selected[index]
	}
	return selected[:limit], nil
}

func resultFromContext(searchContext domain.RestaurantSearchContext) RestaurantSearchResult {
	return RestaurantSearchResult{
		Room: searchContext.Room, GenreID: searchContext.GenreID, Candidates: searchContext.Candidates,
	}
}

var restaurantQueryDefinitions = map[string][]restaurantQueryDefinition{
	"ramen":                {{genreCode: "G013"}},
	"sushi-seafood":        {{genreCode: "G004", keyword: "寿司"}, {genreCode: "G004", keyword: "海鮮"}},
	"yakiniku":             {{genreCode: "G008"}},
	"steak-hamburg":        {{genreCode: "G005", keyword: "ステーキ"}, {genreCode: "G005", keyword: "ハンバーグ"}},
	"curry":                {{keyword: "カレー"}},
	"soba-udon":            {{genreCode: "G004", keyword: "そば"}, {genreCode: "G004", keyword: "うどん"}},
	"teishoku":             {{genreCode: "G004", keyword: "定食"}},
	"italian":              {{genreCode: "G006"}},
	"chinese":              {{genreCode: "G007"}},
	"korean":               {{genreCode: "G017"}},
	"asian":                {{genreCode: "G009"}},
	"hamburger":            {{keyword: "ハンバーガー"}},
	"okonomiyaki-takoyaki": {{genreCode: "G016", keyword: "お好み焼き"}, {genreCode: "G016", keyword: "たこ焼き"}},
	"nabe-shabushabu":      {{genreCode: "G004", keyword: "鍋"}, {genreCode: "G004", keyword: "しゃぶしゃぶ"}},
	"izakaya":              {{genreCode: "G001"}},
	"cafe":                 {{genreCode: "G014"}},
}

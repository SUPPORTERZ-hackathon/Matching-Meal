package domain

import "time"

const (
	MaxRestaurantCandidates   = 5
	MaxRestaurantSearchPool   = 100
	RestaurantSearchRangeMin  = 1
	RestaurantSearchRangeMax  = 5
	RestaurantSourceHotPepper = "hotpepper"
)

type RestaurantCandidate struct {
	RoomID       string
	RestaurantID string
	Position     int16
	Name         string
	PhotoURL     *string
	OpeningHours *string
	ClosedDays   *string
	DinnerBudget *string
	Access       *string
	StationName  *string
	DetailURL    *string
	Latitude     *float64
	Longitude    *float64
	Source       string
	CreatedAt    time.Time
}

type RestaurantSearchContext struct {
	Room            Room
	SearchCondition RoomSearchCondition
	GenreID         string
	Candidates      []RestaurantCandidate
}

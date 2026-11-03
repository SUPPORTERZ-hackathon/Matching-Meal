package httptransport

import (
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAllAPIRoutesCanBeRegisteredTogether(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	RegisterRoomRoutes(router, NewRoomHandler(nil))
	RegisterGenreVotingRoutes(router, NewGenreVotingHandler(&genreVotingUseCaseStub{}))
	RegisterRestaurantSearchRoutes(router, NewRestaurantSearchHandler(nil))
	RegisterRestaurantVotingRoutes(router, NewRestaurantVotingHandler(&restaurantVotingUseCaseStub{}))

	const expectedRouteCount = 10
	if routes := router.Routes(); len(routes) != expectedRouteCount {
		t.Fatalf("registered route count = %d, want %d", len(routes), expectedRouteCount)
	}
}

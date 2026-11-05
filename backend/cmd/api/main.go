package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"meal/backend/internal/hotpepper"
	"meal/backend/internal/repository/postgres"
	"meal/backend/internal/security"
	"meal/backend/internal/service"
	httptransport "meal/backend/internal/transport/http"
)

const (
	hotPepperGourmetSearchURL = "https://webservice.recruit.co.jp/hotpepper/gourmet/v1/"
	hotPepperRequestTimeout   = 5 * time.Second
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		log.Fatal("database configuration failed")
	}
	defer pool.Close()
	randomGenerator := security.RandomGenerator{}
	idempotencyKey, _ := security.DecodeIdempotencyHMACKey(os.Getenv("ROOM_IDEMPOTENCY_HMAC_KEY"))
	roomRepository := postgres.NewRoomRepository(pool)
	genreVotingRepository := postgres.NewGenreVotingRepository(pool)
	restaurantSearchRepository := postgres.NewRestaurantSearchRepository(pool)
	restaurantVotingRepository := postgres.NewRestaurantVotingRepository(pool)
	hotPepperClient := hotpepper.NewClient(
		&http.Client{Timeout: hotPepperRequestTimeout}, hotPepperGourmetSearchURL, os.Getenv("HOTPEPPER_API_KEY"),
	)
	roomService := service.NewRoomService(
		roomRepository, randomGenerator, service.SystemClock{}, service.WithRoomIdempotencyKey(idempotencyKey),
	)
	genreVotingService := service.NewGenreVotingService(genreVotingRepository, roomRepository, randomGenerator, service.SystemClock{})
	restaurantSearchService := service.NewRestaurantSearchService(
		restaurantSearchRepository, roomRepository, hotPepperClient, randomGenerator, service.SystemClock{},
	)
	restaurantVotingService := service.NewRestaurantVotingService(
		restaurantVotingRepository, roomRepository, randomGenerator, service.SystemClock{},
	)
	roomHandler := httptransport.NewRoomHandler(roomService)
	genreVotingHandler := httptransport.NewGenreVotingHandler(genreVotingService)
	restaurantSearchHandler := httptransport.NewRestaurantSearchHandler(restaurantSearchService)
	restaurantVotingHandler := httptransport.NewRestaurantVotingHandler(restaurantVotingService)
	router := gin.New()
	router.Use(httptransport.RequestID(randomGenerator), gin.Logger(), gin.Recovery())
	router.GET("/api/health", func(c *gin.Context) {
		probe, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		var ready bool
		err := pool.QueryRow(probe, "SELECT EXISTS (SELECT 1 FROM development_checks WHERE id = 1)").Scan(&ready)
		if err != nil || !ready {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "database": "unavailable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "database": "ok"})
	})
	httptransport.RegisterRoomRoutes(router, roomHandler)
	httptransport.RegisterGenreVotingRoutes(router, genreVotingHandler)
	httptransport.RegisterRestaurantSearchRoutes(router, restaurantSearchHandler)
	httptransport.RegisterRestaurantVotingRoutes(router, restaurantVotingHandler)
	server := &http.Server{Addr: ":8080", Handler: router, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil {
		log.Print(err)
	}
}

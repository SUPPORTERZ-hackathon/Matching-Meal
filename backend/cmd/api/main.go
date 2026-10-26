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
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		log.Fatal("database configuration failed")
	}
	defer pool.Close()
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
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

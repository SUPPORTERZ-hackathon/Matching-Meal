package hotpepper

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"strings"

	"meal/backend/internal/domain"
)

const maxResponseBytes = 2 << 20

var (
	ErrSearchFailed  = errors.New("hot pepper search failed")
	ErrSearchTimeout = errors.New("hot pepper search timeout")
)

type Query struct {
	Latitude  float64
	Longitude float64
	Range     int16
	GenreCode string
	Keyword   string
	Count     int
}

type Searcher interface {
	Search(ctx context.Context, query Query) ([]domain.RestaurantCandidate, error)
}

type Client struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

func NewClient(httpClient *http.Client, baseURL string, apiKey string) *Client {
	return &Client{httpClient: httpClient, baseURL: baseURL, apiKey: apiKey}
}

func (client *Client) Search(ctx context.Context, query Query) ([]domain.RestaurantCandidate, error) {
	if client.apiKey == "" {
		return nil, ErrSearchFailed
	}
	endpoint, err := url.Parse(client.baseURL)
	if err != nil {
		return nil, ErrSearchFailed
	}
	parameters := endpoint.Query()
	parameters.Set("key", client.apiKey)
	parameters.Set("lat", fmt.Sprintf("%.8f", query.Latitude))
	parameters.Set("lng", fmt.Sprintf("%.8f", query.Longitude))
	parameters.Set("range", fmt.Sprintf("%d", query.Range))
	parameters.Set("count", fmt.Sprintf("%d", query.Count))
	parameters.Set("start", "1")
	parameters.Set("format", "json")
	parameters.Set("datum", "world")
	if query.GenreCode != "" {
		parameters.Set("genre", query.GenreCode)
	}
	if query.Keyword != "" {
		parameters.Set("keyword", query.Keyword)
	}
	endpoint.RawQuery = parameters.Encode()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, ErrSearchFailed
	}
	response, err := client.httpClient.Do(request)
	if err != nil {
		var networkError net.Error
		if errors.Is(err, context.DeadlineExceeded) || errors.As(err, &networkError) && networkError.Timeout() {
			return nil, ErrSearchTimeout
		}
		return nil, ErrSearchFailed
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, ErrSearchFailed
	}

	var payload searchResponse
	decoder := json.NewDecoder(io.LimitReader(response.Body, maxResponseBytes))
	if err := decoder.Decode(&payload); err != nil || len(payload.Results.Errors) > 0 {
		return nil, ErrSearchFailed
	}
	candidates := make([]domain.RestaurantCandidate, 0, len(payload.Results.Shops))
	for _, shop := range payload.Results.Shops {
		candidate, ok := candidateFromShop(shop)
		if ok {
			candidates = append(candidates, candidate)
		}
	}
	return candidates, nil
}

type searchResponse struct {
	Results struct {
		Errors []struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
		Shops []shopResponse `json:"shop"`
	} `json:"results"`
}

type shopResponse struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
	Open         string  `json:"open"`
	Close        string  `json:"close"`
	Access       string  `json:"access"`
	MobileAccess string  `json:"mobile_access"`
	StationName  string  `json:"station_name"`
	Photo        struct {
		PC struct {
			Large  string `json:"l"`
			Medium string `json:"m"`
		} `json:"pc"`
	} `json:"photo"`
	Budget struct {
		Name    string `json:"name"`
		Average string `json:"average"`
	} `json:"budget"`
	URLs struct {
		PC string `json:"pc"`
	} `json:"urls"`
}

func candidateFromShop(shop shopResponse) (domain.RestaurantCandidate, bool) {
	restaurantID := strings.TrimSpace(shop.ID)
	name := strings.TrimSpace(shop.Name)
	if restaurantID == "" || name == "" {
		return domain.RestaurantCandidate{}, false
	}
	photoURL := safeHTTPSURL(firstNonBlank(shop.Photo.PC.Large, shop.Photo.PC.Medium))
	detailURL := safeHotPepperDetailURL(shop.URLs.PC)
	access := optionalString(firstNonBlank(shop.MobileAccess, shop.Access))
	dinnerBudget := optionalString(firstNonBlank(shop.Budget.Average, shop.Budget.Name))

	var latitude *float64
	var longitude *float64
	if !math.IsNaN(shop.Lat) && !math.IsInf(shop.Lat, 0) && shop.Lat >= -90 && shop.Lat <= 90 &&
		!math.IsNaN(shop.Lng) && !math.IsInf(shop.Lng, 0) && shop.Lng >= -180 && shop.Lng <= 180 {
		latitudeValue := shop.Lat
		longitudeValue := shop.Lng
		latitude = &latitudeValue
		longitude = &longitudeValue
	}

	return domain.RestaurantCandidate{
		RestaurantID: restaurantID,
		Name:         name,
		PhotoURL:     photoURL,
		OpeningHours: optionalString(shop.Open),
		ClosedDays:   optionalString(shop.Close),
		DinnerBudget: dinnerBudget,
		Access:       access,
		StationName:  optionalString(shop.StationName),
		DetailURL:    detailURL,
		Latitude:     latitude,
		Longitude:    longitude,
		Source:       domain.RestaurantSourceHotPepper,
	}, true
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func optionalString(value string) *string {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return nil
	}
	return &normalized
}

func safeHTTPSURL(value string) *string {
	normalized := strings.TrimSpace(value)
	parsed, err := url.Parse(normalized)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return nil
	}
	return &normalized
}

func safeHotPepperDetailURL(value string) *string {
	safeURL := safeHTTPSURL(value)
	if safeURL == nil {
		return nil
	}
	parsed, _ := url.Parse(*safeURL)
	host := strings.ToLower(parsed.Hostname())
	if host != "hotpepper.jp" && host != "www.hotpepper.jp" {
		return nil
	}
	path := strings.Trim(parsed.Path, "/")
	if !strings.HasPrefix(path, "strJ") || strings.Contains(path, "/") {
		return nil
	}
	for _, character := range strings.TrimPrefix(path, "strJ") {
		if character < '0' || character > '9' {
			return nil
		}
	}
	if path == "strJ" {
		return nil
	}
	return safeURL
}

package hotpepper

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestClientSearchMapsRequestAndResponse(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		query := request.URL.Query()
		if query.Get("key") != "secret" || query.Get("lat") != "35.65800000" || query.Get("lng") != "139.70160000" {
			t.Errorf("query = %v", query)
		}
		if query.Get("range") != "3" || query.Get("genre") != "G013" || query.Get("count") != "100" || query.Get("format") != "json" {
			t.Errorf("query = %v", query)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"results":{"shop":[
			{"id":"J001","name":" 店舗A ","address":" 東京都渋谷区東1-2-3 ","lat":35.6,"lng":139.7,"open":"11時","close":"なし","mobile_access":"駅前","station_name":"渋谷","photo":{"pc":{"l":"https://img.example/a.jpg"}},"budget":{"average":"3000円"},"urls":{"pc":"https://www.hotpepper.jp/strJ001/"}},
			{"id":"","name":"欠損店舗"},
			{"id":"J002","name":"店舗B","lat":999,"lng":139.7,"photo":{"pc":{"l":"http://unsafe.example/a.jpg"}},"urls":{"pc":"https://evil.example/strJ002/"}}
		]}}`))
	}))
	defer server.Close()

	client := NewClient(server.Client(), server.URL, "secret")
	candidates, err := client.Search(context.Background(), Query{
		Latitude: 35.658, Longitude: 139.7016, Range: 3, GenreCode: "G013", Count: 100,
	})
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}
	if len(candidates) != 2 {
		t.Fatalf("candidate count = %d", len(candidates))
	}
	first := candidates[0]
	if first.RestaurantID != "J001" || first.Name != "店舗A" || first.PhotoURL == nil || first.DetailURL == nil {
		t.Fatalf("first candidate = %+v", first)
	}
	if first.Address == nil || *first.Address != "東京都渋谷区東1-2-3" {
		t.Fatalf("address = %v", first.Address)
	}
	if first.Access == nil || *first.Access != "駅前" || first.DinnerBudget == nil || *first.DinnerBudget != "3000円" {
		t.Fatalf("mapped optional fields = %+v", first)
	}
	second := candidates[1]
	if second.Address != nil || second.PhotoURL != nil || second.DetailURL != nil || second.Latitude != nil || second.Longitude != nil {
		t.Fatalf("unsafe fields were not removed: %+v", second)
	}
}

func TestClientSearchErrors(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		handler  http.HandlerFunc
		expected error
	}{
		{name: "http error", handler: func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusBadGateway) }, expected: ErrSearchFailed},
		{name: "invalid json", handler: func(writer http.ResponseWriter, _ *http.Request) { _, _ = writer.Write([]byte(`{`)) }, expected: ErrSearchFailed},
		{name: "api error", handler: func(writer http.ResponseWriter, _ *http.Request) {
			_, _ = writer.Write([]byte(`{"results":{"error":[{"code":1000,"message":"error"}]}}`))
		}, expected: ErrSearchFailed},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(test.handler)
			defer server.Close()
			client := NewClient(server.Client(), server.URL, "secret")
			_, err := client.Search(context.Background(), Query{Count: 100, Range: 3})
			if !errors.Is(err, test.expected) {
				t.Fatalf("Search() error = %v, want %v", err, test.expected)
			}
		})
	}
}

func TestClientSearchTimeout(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		time.Sleep(30 * time.Millisecond)
		_, _ = writer.Write([]byte(`{"results":{"shop":[]}}`))
	}))
	defer server.Close()
	client := NewClient(&http.Client{Timeout: time.Millisecond}, server.URL, "secret")

	_, err := client.Search(context.Background(), Query{Count: 100, Range: 3})
	if !errors.Is(err, ErrSearchTimeout) {
		t.Fatalf("Search() error = %v, want ErrSearchTimeout", err)
	}
}

func TestClientSearchRejectsMissingAPIKey(t *testing.T) {
	t.Parallel()
	client := NewClient(http.DefaultClient, "https://example.com", "")
	_, err := client.Search(context.Background(), Query{})
	if !errors.Is(err, ErrSearchFailed) {
		t.Fatalf("Search() error = %v, want ErrSearchFailed", err)
	}
}

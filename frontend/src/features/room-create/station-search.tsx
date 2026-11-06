"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { LoaderCircle, MapPin, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseStations, searchStations, type Station, type StationDataDocument } from "./station-data";
import styles from "./room-create.module.css";

const STATION_DATA_URL = "/data/stations-2025.json";

type StationSearchProps = {
  disabled: boolean;
  onStationChange: (station: Station | null) => void;
};

export function StationSearch({ disabled, onStationChange }: StationSearchProps) {
  const listboxId = useId();
  const statusId = useId();
  const [stations, setStations] = useState<Station[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Station | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const composingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(STATION_DATA_URL, { cache: "force-cache", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("station data response failed");
        const document = await response.json() as StationDataDocument;
        const parsed = parseStations(document);
        if (!parsed) throw new Error("station data validation failed");
        setStations(parsed);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStations([]);
        setLoading(false);
        setLoadError(true);
      });
    return () => controller.abort();
  }, [loadAttempt]);

  const results = useMemo(() => searchStations(stations, query), [stations, query]);
  const showResults = open && query.trim() !== "" && !loading && !loadError;
  const activeOptionId = activeIndex >= 0 && results[activeIndex]
    ? `${listboxId}-option-${results[activeIndex].id}`
    : undefined;

  function editQuery(value: string) {
    setQuery(value);
    setSelected(null);
    setActiveIndex(-1);
    setOpen(value.trim() !== "");
    onStationChange(null);
  }

  function chooseStation(station: Station) {
    if (disabled || !results.some((candidate) => candidate.id === station.id)) return;
    setQuery(station.name);
    setSelected(station);
    setOpen(false);
    setActiveIndex(-1);
    onStationChange(station);
  }

  function clearStation() {
    setQuery("");
    setSelected(null);
    setOpen(false);
    setActiveIndex(-1);
    onStationChange(null);
  }

  function retryLoad() {
    setLoading(true);
    setLoadError(false);
    setLoadAttempt((attempt) => attempt + 1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (composingRef.current || event.nativeEvent.isComposing || !showResults) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      chooseStation(results[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={styles.stationSearch}>
      <div className={styles.locationInput}>
        <MapPin aria-hidden="true" />
        <input
          id="room-location"
          type="text"
          role="combobox"
          autoComplete="off"
          value={query}
          placeholder={loading ? "駅データを読み込み中" : "駅名を入力"}
          disabled={disabled || loading || loadError}
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-describedby={statusId}
          onChange={(event) => editQuery(event.target.value)}
          onFocus={() => setOpen(query.trim() !== "" && !selected)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
        />
        {query && !disabled && (
          <button type="button" className={styles.clearButton} aria-label="駅の入力をクリア" onClick={clearStation}>
            <X aria-hidden="true" />
          </button>
        )}
        {loading && <LoaderCircle className={styles.stationLoader} aria-hidden="true" />}
      </div>

      <p id={statusId} className={selected ? styles.stationSelected : styles.stationHelp} aria-live="polite">
        {selected ? `${selected.name}駅を選択中` : "候補から駅を選択してください"}
      </p>

      {showResults && (
        <ul id={listboxId} className={styles.stationResults} role="listbox" aria-label="駅の候補">
          {results.map((station, index) => (
            <li
              id={`${listboxId}-option-${station.id}`}
              key={station.id}
              role="option"
              aria-selected={activeIndex === index}
              className={activeIndex === index ? styles.stationOptionActive : styles.stationOption}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseStation(station)}
            >
              <strong>{station.name}駅</strong>
              <span>{station.line}・{station.operator}</span>
            </li>
          ))}
          {results.length === 0 && <li className={styles.stationEmpty}>一致する駅がありません</li>}
        </ul>
      )}

      {loadError && (
        <div className={styles.stationDataError} role="alert">
          <p>駅データを読み込めませんでした。現在地は引き続き利用できます。</p>
          <Button type="button" variant="ghost" disabled={disabled} onClick={retryLoad}>
            <RotateCw aria-hidden="true" />再試行
          </Button>
        </div>
      )}
    </div>
  );
}

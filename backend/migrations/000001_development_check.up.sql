CREATE TABLE development_checks (
    id INTEGER PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO development_checks (id) VALUES (1);

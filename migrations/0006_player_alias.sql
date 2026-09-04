-- Alias-Spalte: zusaetzliche Anzeige neben dem echten Namen, kein Ersatz.
-- Nullable, kein UNIQUE -- display_name hat ebenfalls keine Eindeutigkeit,
-- Aliase sollen aus demselben Grund nicht strenger sein als Namen.
ALTER TABLE player ADD COLUMN alias TEXT;

-- Add persistent guest cookie identifier to cart_items
ALTER TABLE cart_items
  ADD COLUMN cookie_id VARCHAR(255) AFTER session_id;

-- Optional (recommended) uniqueness guard to prevent duplicates per identity
-- Note: this allows NULLs for user_id/cookie_id/session_id rows.
-- CREATE UNIQUE INDEX unique_cart_identity
--   ON cart_items (user_id, cookie_id, session_id, product_id, variation_id);

-- Orders tables migration

CREATE TABLE IF NOT EXISTS tbl_orders (
  order_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id      INT UNSIGNED NOT NULL DEFAULT 0,
  user_id        INT UNSIGNED NOT NULL DEFAULT 0,
  order_name     VARCHAR(200) NOT NULL DEFAULT '',
  order_title    VARCHAR(200) NOT NULL DEFAULT '',
  order_content  TEXT NOT NULL,
  order_status   VARCHAR(50)  NOT NULL DEFAULT 'wc-pending',
  order_type     VARCHAR(50)  NOT NULL DEFAULT 'shop_order',
  order_date     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  order_modified DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id    (user_id),
  INDEX idx_order_status (order_status),
  INDEX idx_order_type   (order_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_ordermeta (
  meta_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED NOT NULL,
  meta_key   VARCHAR(255) NOT NULL DEFAULT '',
  meta_value LONGTEXT,
  INDEX idx_order_id (order_id),
  INDEX idx_meta_key (meta_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_order_items (
  order_item_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_item_name VARCHAR(200) NOT NULL DEFAULT '',
  order_item_type VARCHAR(50)  NOT NULL DEFAULT 'line_item',
  order_id        INT UNSIGNED NOT NULL,
  product_id      INT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_order_id (order_id),
  INDEX idx_order_item_type (order_item_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_order_itemmeta (
  meta_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT UNSIGNED NOT NULL,
  meta_key      VARCHAR(255) NOT NULL DEFAULT '',
  meta_value    LONGTEXT,
  INDEX idx_order_item_id (order_item_id),
  INDEX idx_meta_key      (meta_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

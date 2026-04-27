-- Cost precision upgrade: store cost per base unit with 4 decimals for accurate gross profit

ALTER TABLE products
  ALTER COLUMN cost_price TYPE DECIMAL(10,4) USING cost_price::numeric;

ALTER TABLE inventory_movements
  ALTER COLUMN cost_price TYPE DECIMAL(10,4) USING cost_price::numeric;

ALTER TABLE stock_transactions
  ALTER COLUMN cost_price TYPE DECIMAL(10,4) USING cost_price::numeric;

ALTER TABLE order_items
  ALTER COLUMN cost_price TYPE DECIMAL(10,4) USING cost_price::numeric;

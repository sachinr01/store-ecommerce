const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/store/api';

export interface Product {
  ID: number;
  title: string;
  slug: string;
  short_description: string;
  menu_order: number;
  price_min: number | null;
  price_max: number | null;
  sale_price_min: number | null;
  thumbnail_id: string | null;
  gallery_ids: string | null;
  sku: string | null;
  stock_status: string | null;
  total_sales: number | null;
  date_added: string;
}

export interface Variation {
  ID: number;
  title: string;
  price: string;
  regular_price: string;
  sale_price: string | null;
  color: string | null;
  size: string | null;
  stock_status: string;
  stock_qty: string | null;
  thumbnail_id: string | null;
  sku: string | null;
}

export interface Attribute {
  attr_id: number;
  attr_name: string;
  attr_slug: string;
  in_stock: number;
}

export interface ProductDetail extends Product {
  description: string;
  price: string | null;
  regular_price: string | null;
  sale_price: string | null;
  seo_title: string | null;
  seo_description: string | null;
  variations: Variation[];
  attributes: {
    colors: Attribute[];
    sizes: Attribute[];
  };
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'API returned failure');
  return json.data as T;
}

async function apiPost<T>(path: string, body: object): Promise<{ success: boolean; message: string; data?: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export const getProducts    = ()        => apiFetch<Product[]>('/products');
export const getFeatured    = (n = 4)   => apiFetch<Product[]>(`/products/featured?limit=${n}`);
export const getOnSale      = (n?: number) => apiFetch<Product[]>(`/products/on-sale${n ? `?limit=${n}` : ''}`);
export const getProductById = (id: number | string) => apiFetch<ProductDetail>(`/products/${id}`);

export const authLogin    = (username: string, password: string) =>
  apiPost<AuthUser>('/auth/login', { username, password });

export const authRegister = (username: string, email: string, password: string) =>
  apiPost<{ userId: number }>('/auth/register', { username, email, password });

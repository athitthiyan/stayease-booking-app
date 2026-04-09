export type RoomType = 'standard' | 'deluxe' | 'suite' | 'penthouse';
export type RoomSortOption =
  | 'recommended'
  | 'price_low_to_high'
  | 'price_high_to_low'
  | 'top_rated'
  | 'most_popular';

export interface Room {
  id: number;
  hotel_name: string;
  room_type: RoomType;
  description?: string;
  price: number;
  original_price?: number;
  availability: boolean;
  rating: number;
  review_count: number;
  image_url?: string;
  gallery_urls?: string;   // JSON string
  amenities?: string;      // JSON string
  location?: string;
  city?: string;
  country?: string;
  max_guests: number;
  beds: number;
  bathrooms: number;
  size_sqft?: number;
  floor?: number;
  is_featured: boolean;
  created_at: string;
  latitude?: number;
  longitude?: number;
  map_embed_url?: string;
  availabilityState?: 'available' | 'unavailable' | 'loading';
  availabilityMessage?: string;
}

export interface RoomListResponse {
  rooms: Room[];
  total: number;
  page: number;
  per_page: number;
}

export interface RoomSearchParams {
  query?: string;
  city?: string;
  landmark?: string;
  room_type?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  amenities?: string;
  guests?: number;
  adults?: number;
  children?: number;
  infants?: number;
  check_in?: string;
  check_out?: string;
  featured?: boolean;
  sort_by?: RoomSortOption;
  page?: number;
  per_page?: number;
}

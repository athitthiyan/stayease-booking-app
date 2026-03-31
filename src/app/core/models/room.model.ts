export type RoomType = 'standard' | 'deluxe' | 'suite' | 'penthouse';

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
}

export interface RoomListResponse {
  rooms: Room[];
  total: number;
  page: number;
  per_page: number;
}

export interface RoomSearchParams {
  city?: string;
  room_type?: string;
  min_price?: number;
  max_price?: number;
  guests?: number;
  check_in?: string;
  check_out?: string;
  page?: number;
  per_page?: number;
}

export interface ReviewCreate {
  room_id: number;
  booking_id: number;
  rating: number;
  cleanliness_rating?: number;
  service_rating?: number;
  value_rating?: number;
  location_rating?: number;
  title?: string;
  body?: string;
}

export interface ReviewResponse {
  id: number;
  user_id: number;
  room_id: number;
  booking_id: number;
  rating: number;
  cleanliness_rating: number | null;
  service_rating: number | null;
  value_rating: number | null;
  location_rating: number | null;
  title: string | null;
  body: string | null;
  is_verified: boolean;
  host_reply: string | null;
  host_replied_at: string | null;
  reviewer_name: string;
  created_at: string;
}

export interface ReviewListResponse {
  reviews: ReviewResponse[];
  total: number;
  average_rating: number;
  rating_breakdown: Record<string, number>;
}

export interface HostReplyRequest {
  reply: string;
}

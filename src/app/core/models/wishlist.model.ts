import { Room } from './room.model';

export interface WishlistToggleResponse {
  saved: boolean;
  message: string;
}

export interface WishlistItemResponse {
  id: number;
  room_id: number;
  room: Room | null;
  created_at: string;
}

export interface WishlistResponse {
  items: WishlistItemResponse[];
  total: number;
}

export interface WishlistStatusResponse {
  room_ids: number[];
}

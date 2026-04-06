import { Room } from '../../core/models/room.model';

const ROOM_PLACEHOLDER_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" fill="none">
    <rect width="1200" height="800" fill="#0f1527"/>
    <rect x="56" y="56" width="1088" height="688" rx="36" fill="#161f36" stroke="#2b3554" stroke-width="4"/>
    <circle cx="974" cy="210" r="110" fill="#d0b45a" fill-opacity="0.18"/>
    <circle cx="247" cy="603" r="140" fill="#22d3ee" fill-opacity="0.08"/>
    <path d="M239 540h722" stroke="#384362" stroke-width="6" stroke-linecap="round"/>
    <path d="M286 540V332h216v208" stroke="#d0b45a" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M698 540V276h216v264" stroke="#d0b45a" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M371 540V428h48v112" stroke="#d0b45a" stroke-width="18" stroke-linecap="round"/>
    <path d="M783 540V372h48v168" stroke="#d0b45a" stroke-width="18" stroke-linecap="round"/>
    <rect x="536" y="280" width="88" height="260" rx="18" fill="#d0b45a"/>
    <text x="600" y="646" text-anchor="middle" fill="#f4f7fb" font-family="Georgia, serif" font-size="64" font-weight="700">Stayvora</text>
    <text x="600" y="694" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="28">Stay preview coming soon</text>
  </svg>
`;

export const ROOM_IMAGE_PLACEHOLDER = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  ROOM_PLACEHOLDER_SVG,
)}`;

export function normalizeRoomImageUrl(url?: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }

  return null;
}

export function getRoomGalleryImages(room: Pick<Room, 'image_url' | 'gallery_urls'>): string[] {
  const images = new Set<string>();

  const mainImage = normalizeRoomImageUrl(room.image_url);
  if (mainImage) {
    images.add(mainImage);
  }

  try {
    const parsedGallery = JSON.parse(room.gallery_urls || '[]');
    if (Array.isArray(parsedGallery)) {
      parsedGallery.forEach(image => {
        const normalized = normalizeRoomImageUrl(typeof image === 'string' ? image : '');
        if (normalized) {
          images.add(normalized);
        }
      });
    }
  } catch {
    // Ignore malformed gallery payloads and fall back to the main image/placeholder.
  }

  return images.size > 0 ? Array.from(images) : [ROOM_IMAGE_PLACEHOLDER];
}

export function applyRoomImageFallback(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLImageElement)) {
    return;
  }

  if (target.src !== ROOM_IMAGE_PLACEHOLDER) {
    target.src = ROOM_IMAGE_PLACEHOLDER;
  }
}

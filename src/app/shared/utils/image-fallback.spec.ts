import {
  ROOM_IMAGE_PLACEHOLDER,
  applyRoomImageFallback,
  getRoomGalleryImages,
  normalizeRoomImageUrl,
} from './image-fallback';

describe('image-fallback utils', () => {
  it('normalizes supported room image URLs and rejects invalid ones', () => {
    expect(normalizeRoomImageUrl(' https://example.com/room.jpg ')).toBe('https://example.com/room.jpg');
    expect(normalizeRoomImageUrl('//cdn.example.com/room.jpg')).toBe('https://cdn.example.com/room.jpg');
    expect(normalizeRoomImageUrl('/assets/room.jpg')).toBe('/assets/room.jpg');
    expect(normalizeRoomImageUrl('not-a-url')).toBeNull();
    expect(normalizeRoomImageUrl('')).toBeNull();
  });

  it('builds a unique room gallery and falls back to the placeholder when needed', () => {
    expect(
      getRoomGalleryImages({
        image_url: 'https://example.com/main.jpg',
        gallery_urls: JSON.stringify([
          'https://example.com/main.jpg',
          'https://example.com/second.jpg',
          'bad-value',
        ]),
      }),
    ).toEqual(['https://example.com/main.jpg', 'https://example.com/second.jpg']);

    expect(
      getRoomGalleryImages({
        image_url: 'invalid-value',
        gallery_urls: 'invalid-json',
      }),
    ).toEqual([ROOM_IMAGE_PLACEHOLDER]);
  });

  it('replaces broken images with the local placeholder exactly once', () => {
    const image = document.createElement('img');
    image.src = 'https://example.com/broken.jpg';

    applyRoomImageFallback({ target: image } as unknown as Event);
    expect(image.src).toBe(ROOM_IMAGE_PLACEHOLDER);

    applyRoomImageFallback({ target: image } as unknown as Event);
    expect(image.src).toBe(ROOM_IMAGE_PLACEHOLDER);
  });

  it('handles non-string values in gallery_urls array', () => {
    expect(
      getRoomGalleryImages({
        image_url: 'https://example.com/main.jpg',
        gallery_urls: JSON.stringify([null, 42, 'https://example.com/valid.jpg']),
      }),
    ).toEqual(['https://example.com/main.jpg', 'https://example.com/valid.jpg']);
  });

  it('does nothing when the event target is not an HTMLImageElement', () => {
    const div = document.createElement('div');
    applyRoomImageFallback({ target: div } as unknown as Event);
    expect((div as unknown as HTMLImageElement).src).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import {
  RecapFormSchema,
  buildRecap,
  hasRecap,
  labelFromFileName,
  slideRef,
  videoEmbed,
  videoSite,
} from '../src/lib/recap';
import type { EventRecap } from '../src/db/schema';

const prev: EventRecap = {
  photos: [{ key: 'events/recap/a.jpg', alt: 'Panel' }, { key: 'events/recap/b.jpg' }],
  slides: [
    { label: 'Deck', key: 'files/deck.pdf' },
    { label: 'Online', url: 'https://example.com/s' },
  ],
  videoUrl: null,
  postId: null,
};

const form = (over: Record<string, unknown> = {}) =>
  RecapFormSchema.parse({
    photoKey: prev.photos.map((p) => p.key),
    photoAlt: ['Panel', ''],
    slideRef: prev.slides.map(slideRef),
    slideLabel: ['Deck', 'Online'],
    ...over,
  });

const none = { photos: [], slides: [] };

describe('hasRecap', () => {
  it('is true when anything is set', () => {
    expect(hasRecap(null)).toBe(false);
    expect(hasRecap({ photos: [], slides: [] })).toBe(false);
    expect(hasRecap({ photos: [], slides: [], videoUrl: 'https://youtu.be/x' })).toBe(true);
    expect(hasRecap({ photos: [], slides: [], postId: 3 })).toBe(true);
    expect(hasRecap(prev)).toBe(true);
  });

  it('ignores a write-up that is no longer published', () => {
    const onlyPost = { photos: [], slides: [], postId: 3 };
    expect(hasRecap(onlyPost, (id) => id === 4)).toBe(false);
    expect(hasRecap(onlyPost, (id) => id === 3)).toBe(true);
    expect(hasRecap({ ...onlyPost, videoUrl: 'https://youtu.be/x' }, () => false)).toBe(true);
  });
});

describe('buildRecap', () => {
  it('keeps order from the form, edits alt and labels, appends uploads', () => {
    const { recap, removedPhotos } = buildRecap(
      prev,
      form({
        photoKey: ['events/recap/b.jpg', 'events/recap/a.jpg'],
        photoAlt: ['Crowd', ''],
        slideLabel: ['Keynote deck', ''],
      }),
      { photos: ['events/recap/c.jpg'], slides: [{ key: 'files/new.pdf', label: 'New' }] },
    );
    expect(recap.photos).toEqual([
      { key: 'events/recap/b.jpg', alt: 'Crowd' },
      { key: 'events/recap/a.jpg' },
      { key: 'events/recap/c.jpg' },
    ]);
    expect(recap.slides.map((s) => s.label)).toEqual(['Keynote deck', 'Online', 'New']);
    expect(removedPhotos).toEqual([]);
  });

  it('removes photos and slides, and reports removed photo keys', () => {
    const { recap, removedPhotos } = buildRecap(
      prev,
      form({ photoRemove: ['events/recap/a.jpg'], slideRemove: ['u:https://example.com/s'] }),
      none,
    );
    expect(recap.photos.map((p) => p.key)).toEqual(['events/recap/b.jpg']);
    expect(recap.slides).toEqual([{ label: 'Deck', key: 'files/deck.pdf' }]);
    expect(removedPhotos).toEqual(['events/recap/a.jpg']);
  });

  it('ignores keys that are not already in the recap', () => {
    const { recap, removedPhotos } = buildRecap(
      prev,
      form({
        photoKey: ['backups/db.sql', ...prev.photos.map((p) => p.key)],
        photoAlt: ['x', 'Panel', ''],
        photoRemove: ['backups/db.sql'],
        slideRef: ['k:backups/db.sql', ...prev.slides.map(slideRef)],
        slideLabel: ['x', 'Deck', 'Online'],
      }),
      none,
    );
    expect(recap.photos.map((p) => p.key)).toEqual(prev.photos.map((p) => p.key));
    expect(recap.slides).toHaveLength(2);
    expect(removedPhotos).toEqual([]);
  });

  it('keeps photos missing from the form, adds a slides link, video and post', () => {
    const { recap } = buildRecap(
      prev,
      form({
        photoKey: ['events/recap/a.jpg'],
        photoAlt: ['Panel'],
        newSlideUrl: 'docs.google.com/presentation/d/1',
        videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
        postId: '7',
      }),
      none,
    );
    expect(recap.photos.map((p) => p.key)).toEqual(['events/recap/a.jpg', 'events/recap/b.jpg']);
    expect(recap.slides.at(-1)).toEqual({
      label: 'Slides',
      url: 'https://docs.google.com/presentation/d/1',
    });
    expect(recap.videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(recap.postId).toBe(7);
  });

  it('starts from an empty recap', () => {
    const { recap } = buildRecap(null, RecapFormSchema.parse({ postId: '' }), {
      photos: ['events/recap/a.jpg'],
      slides: [],
    });
    expect(recap).toEqual({
      photos: [{ key: 'events/recap/a.jpg' }],
      slides: [],
      videoUrl: null,
      postId: null,
    });
  });

  it('rejects a bad video URL', () => {
    expect(RecapFormSchema.safeParse({ videoUrl: 'not a url' }).success).toBe(false);
  });
});

describe('videoEmbed', () => {
  it('embeds YouTube without cookies', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ])
      expect(videoEmbed(url)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
  it('embeds Vimeo with do-not-track, keeping unlisted hashes', () => {
    expect(videoEmbed('https://vimeo.com/123456')).toBe(
      'https://player.vimeo.com/video/123456?dnt=1',
    );
    expect(videoEmbed('https://vimeo.com/123456/abc123')).toBe(
      'https://player.vimeo.com/video/123456?dnt=1&h=abc123',
    );
  });
  it('returns null for other links', () => {
    expect(videoEmbed('https://www.linkedin.com/events/123')).toBeNull();
    expect(videoEmbed('https://www.youtube.com/@frenchtech')).toBeNull();
    expect(videoEmbed('nope')).toBeNull();
    expect(videoEmbed(null)).toBeNull();
  });
  it('names the site', () => {
    expect(videoSite('https://youtu.be/x')).toBe('YouTube');
    expect(videoSite('https://vimeo.com/1')).toBe('Vimeo');
    expect(videoSite('https://www.facebook.com/x')).toBe('facebook.com');
  });
});

describe('labelFromFileName', () => {
  it('turns a file name into a label', () => {
    expect(labelFromFileName('AI_in-Thailand--v2.pdf')).toBe('AI in Thailand v2');
    expect(labelFromFileName('.pdf')).toBe('Slides');
  });
});

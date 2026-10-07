// What a share image shows (lib/share.ts), in a module of its own so the admin's browser code
// (lib/share-image-client.ts) doesn't bundle the server-side helpers.

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;

export type ShareEntity = 'event' | 'post';

/** What the share image shows. */
export interface ShareSpec {
  entity: ShareEntity;
  id: number;
  /** The red label: French Tech Connect, French Tech Talk, the series, or Blog. */
  label: string;
  title: string;
  /** Up to two lines under the title (date and time, venue / author and date). */
  lines: string[];
  /** Same-origin path of the photo on the right. */
  photo: string;
}

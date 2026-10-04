// Shared by the post editor scripts in the browser: nothing here may import server modules.

export interface ListedFile {
  name: string;
  key: string;
  size?: number;
}

/** The text tag that shows a download button for an attachment, see expandDownloads(). */
export const attachmentTag = (name: string, label?: string) =>
  `{{download: ${name}${label ? ` | ${label}` : ''}}}`;

export const mediaPath = (key: string) =>
  `/media/${key.split('/').map(encodeURIComponent).join('/')}`;

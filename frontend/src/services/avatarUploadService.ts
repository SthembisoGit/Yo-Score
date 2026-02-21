const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const AVATAR_BUCKET = (import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || 'avatars').trim();

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type UploadAvatarInput = {
  userId: string;
  file: File;
  previousUrl?: string | null;
};

type UploadAvatarResult = {
  publicUrl: string;
  objectPath: string;
};

const encodeObjectPath = (path: string) =>
  path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const inferExtension = (file: File) => {
  const byMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  if (byMime[file.type]) return byMime[file.type];
  const nameExt = file.name.split('.').pop()?.toLowerCase();
  return nameExt && nameExt.length <= 5 ? nameExt : 'jpg';
};

const ensureConfig = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Avatar upload is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
};

const parseObjectPathFromPublicUrl = (publicUrl: string): string | null => {
  try {
    const parsed = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const objectPath = parsed.pathname.slice(markerIndex + marker.length);
    return objectPath || null;
  } catch {
    return null;
  }
};

async function removeAvatarByUrl(publicUrl?: string | null): Promise<void> {
  if (!publicUrl) return;
  const objectPath = parseObjectPathFromPublicUrl(publicUrl);
  if (!objectPath) return;

  try {
    await fetch(
      `${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}/${encodeObjectPath(objectPath)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );
  } catch {
    // best-effort cleanup
  }
}

async function uploadAvatar({ userId, file, previousUrl }: UploadAvatarInput): Promise<UploadAvatarResult> {
  ensureConfig();

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Unsupported image format. Use JPG, PNG, WEBP, or GIF.');
  }

  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Image is too large. Maximum size is 2MB.');
  }

  const extension = inferExtension(file);
  const objectPath = `${userId}/avatar-${Date.now()}.${extension}`;
  const encodedPath = encodeObjectPath(objectPath);

  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errorBody = await uploadResponse.text().catch(() => '');
    throw new Error(errorBody || `Avatar upload failed with status ${uploadResponse.status}.`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${objectPath}`;
  await removeAvatarByUrl(previousUrl);

  return { publicUrl, objectPath };
}

export const avatarUploadService = {
  uploadAvatar,
};


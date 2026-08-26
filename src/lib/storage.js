import { supabase } from './supabaseClient';

// Uploads a file to a user-scoped folder in the given bucket and returns its
// public URL. Storage policies only allow writes under `${userId}/...`.
export const uploadImage = async (bucket, userId, file) => {
  const ext = file.name?.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

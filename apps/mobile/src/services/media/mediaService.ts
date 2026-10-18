import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { apiClient, TokenKeys } from '../api/apiClient';
import { getApiBase } from '../../config/serverConfig';

export interface UploadedMedia { id: string; contentType: string; size: number; duplicate: boolean }

const guessType = (uri: string): string => {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
};

/** Uploads a picture from a local file. The id is the image's SHA-256, so the same picture is stored once. */
export async function uploadImage(uri: string): Promise<UploadedMedia> {
  const form = new FormData();
  // React Native's FormData takes a file descriptor object here.
  form.append('file', { uri, name: `photo.${guessType(uri).split('/')[1]}`, type: guessType(uri) } as any);
  const { data } = await apiClient.post<UploadedMedia>('/media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
    transformRequest: (d) => d, // let React Native build the multipart body
  });
  return data;
}

const cachePath = (id: string) => `${FileSystem.cacheDirectory}media-${id}`;

/**
 * A local file for a stored picture. Images never change for a given id, so the first download is kept
 * and reused (including offline). Needs the signed-in session, so it sends the token like any other call.
 */
export async function fetchMediaFile(id: string): Promise<string> {
  const target = cachePath(id);
  const have = await FileSystem.getInfoAsync(target);
  if (have.exists) return target;

  const download = async () => {
    const token = await SecureStore.getItemAsync(TokenKeys.ACCESS_TOKEN);
    const society = await SecureStore.getItemAsync(TokenKeys.SOCIETY_ID);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (society) headers['X-Society-Id'] = society;
    return FileSystem.downloadAsync(`${await getApiBase()}/media/${id}`, target, { headers });
  };

  let res = await download();
  if (res.status === 401) {
    await apiClient.get('/auth/me'); // an expired token is refreshed by the client's interceptor
    res = await download();
  }
  if (res.status !== 200) {
    await FileSystem.deleteAsync(target, { idempotent: true });
    throw new Error(`Could not load the picture (${res.status}).`);
  }
  return target;
}

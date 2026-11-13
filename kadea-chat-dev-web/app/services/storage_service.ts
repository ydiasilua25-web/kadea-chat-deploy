import { randomUUID } from 'node:crypto'
import { v2 as cloudinary } from 'cloudinary'
import env from '#start/env'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv']

export const ALLOWED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...DOCUMENT_EXTENSIONS]
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export function isImageExtension(extension: string) {
  return IMAGE_EXTENSIONS.includes(extension.toLowerCase())
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

export default class StorageService {
  constructor() {
    const cloudName = env.get('CLOUDINARY_CLOUD_NAME')
    const apiKey = env.get('CLOUDINARY_API_KEY')
    const apiSecret = env.get('CLOUDINARY_API_SECRET')

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Le stockage de fichiers (Cloudinary) n’est pas configuré.')
    }
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    })
  }

  /** Photo de profil : publique, recadrée en carré, elle remplace la précédente. */
  async uploadAvatar(tmpPath: string, userId: number) {
    const result = await cloudinary.uploader.upload(tmpPath, {
      folder: 'kadea-chat/avatars',
      public_id: `user-${userId}`,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'auto' }],
    })
    return result.secure_url
  }

  /** Pièce jointe : privée, accessible uniquement par une adresse signée générée par le serveur. */
  async uploadAttachment(tmpPath: string, extension: string, conversationId: number) {
    const isImage = isImageExtension(extension)
    const publicId = `kadea-chat/files/${conversationId}/${randomUUID()}${isImage ? '' : `.${extension}`}`

    await cloudinary.uploader.upload(tmpPath, {
      public_id: publicId,
      resource_type: isImage ? 'image' : 'raw',
      type: 'authenticated',
      overwrite: false,
    })
    return publicId
  }

  signedUrl(publicId: string, isImage: boolean) {
    return cloudinary.url(publicId, {
      resource_type: isImage ? 'image' : 'raw',
      type: 'authenticated',
      sign_url: true,
      secure: true,
    })
  }
}
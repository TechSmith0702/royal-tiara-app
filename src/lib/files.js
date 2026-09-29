import { supabase } from './supabase.js'

// Proof-of-payment files go into a private bucket, in a folder named after the
// distributor account. Only that distributor and the admin can open them.

const MAX_BYTES = 5 * 1024 * 1024

export async function uploadProof(userId, file) {
  const isImage = file.type.startsWith('image/')
  let body = file
  let type = file.type || 'application/octet-stream'

  if (isImage) {
    try {
      body = await shrinkImage(file)
      type = 'image/jpeg'
    } catch {
      body = file
      type = file.type
    }
  } else if (type !== 'application/pdf') {
    throw new Error('Please upload a photo or a PDF.')
  }

  if (body.size > MAX_BYTES) {
    throw new Error('That file is larger than 5MB - try a photo instead of a scan.')
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-60)
  const suffix = isImage && !/\.jpe?g$/i.test(safe) ? '.jpg' : ''
  const path = userId + '/' + Date.now() + '-' + safe + suffix

  const { error } = await supabase.storage.from('proofs').upload(path, body, { contentType: type })
  if (error) throw new Error(error.message)

  return { name: file.name, type, size: body.size, path, uploadedAt: new Date().toISOString() }
}

/** Short-lived link so the admin can view a proof of payment. */
export async function proofUrl(path) {
  const { data, error } = await supabase.storage.from('proofs').createSignedUrl(path, 300)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function openProof(path) {
  const win = window.open('', '_blank')
  try {
    const url = await proofUrl(path)
    if (win) win.location.href = url
    else window.location.href = url
  } catch (e) {
    if (win) win.close()
    throw e
  }
}

function shrinkImage(file, maxSide) {
  const limit = maxSide || 1400
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, limit / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Could not read that image.'))),
        'image/jpeg',
        0.75,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}

/** Admin only: remove every stored proof-of-payment file. */
export async function deleteAllProofs() {
  const bucket = supabase.storage.from('proofs')
  const { data: folders, error } = await bucket.list('', { limit: 1000 })
  if (error) throw new Error(error.message)

  const paths = []
  for (const folder of folders || []) {
    if (folder.id) {
      paths.push(folder.name)
      continue
    }
    const { data: inside } = await bucket.list(folder.name, { limit: 1000 })
    ;(inside || []).forEach(file => paths.push(folder.name + '/' + file.name))
  }

  if (!paths.length) return 0
  const { error: removeError } = await bucket.remove(paths)
  if (removeError) throw new Error(removeError.message)
  return paths.length
}

/* ---------- product photos (admin) ---------- */

const PRODUCT_BUCKET = 'product-photos'

/** Admin only: upload a product photo and return its public web address. */
export async function uploadProductPhoto(productId, file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo (JPG or PNG).')

  let body = file
  let type = 'image/jpeg'
  try {
    body = await shrinkImage(file, 1200)
  } catch {
    body = file
    type = file.type
  }
  if (body.size > 5 * 1024 * 1024) throw new Error('That photo is larger than 5MB.')

  const path = productId + '/' + Date.now() + '.jpg'
  const { error } = await supabase.storage.from(PRODUCT_BUCKET).upload(path, body, { contentType: type })
  if (error) throw new Error(error.message)

  return supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Removes the stored file, if the photo is one we uploaded. */
export async function deleteProductPhoto(url) {
  const marker = '/' + PRODUCT_BUCKET + '/'
  const at = String(url).indexOf(marker)
  if (at === -1) return false   // e.g. one of the original files in public/products
  const path = decodeURIComponent(String(url).slice(at + marker.length).split('?')[0])
  const { error } = await supabase.storage.from(PRODUCT_BUCKET).remove([path])
  if (error) throw new Error(error.message)
  return true
}

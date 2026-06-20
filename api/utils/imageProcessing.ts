import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')

export interface BrushStroke {
  x: number
  y: number
  radius: number
  mode: 'keep' | 'erase'
}

export interface FeatherParams {
  radius: number
}

export interface ThresholdParams {
  value: number
  softness: number
}

export interface LightingAdjustParams {
  brightness: number
  contrast: number
  saturation: number
  lightDirection: { x: number; y: number }
  shadowIntensity: number
}

export interface BackgroundReplaceParams {
  type: 'solid' | 'gradient' | 'image'
  solidColor?: { r: number; g: number; b: number; a?: number }
  gradient?: {
    type: 'linear' | 'radial'
    colors: Array<{ offset: number; r: number; g: number; b: number; a?: number }>
    angle?: number
    startX?: number
    startY?: number
    endX?: number
    endY?: number
  }
  imagePath?: string
  imageFit?: 'cover' | 'contain' | 'fill' | 'stretch'
  imageOpacity?: number
}

export interface MaskEditorState {
  originalMaskPath: string
  currentMaskPath: string
  strokes: BrushStroke[]
}

export const uploadsDir = path.resolve(projectRoot, 'uploads')
export const masksDir = path.resolve(uploadsDir, 'masks')
export const processedDir = path.resolve(uploadsDir, 'processed')
export const backgroundsDir = path.resolve(uploadsDir, 'backgrounds')
;[masksDir, processedDir, backgroundsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
})

export function imageUrlToFilePath(url: string): string {
  const relativePath = url.replace(/^\/uploads\//, 'uploads/')
  return path.resolve(projectRoot, relativePath)
}

export function filePathToUrl(filePath: string): string {
  const relative = path.relative(projectRoot, filePath).replace(/\\/g, '/')
  return '/' + relative
}

export async function getImageStats(
  bufferOrPath: Buffer | string
): Promise<{
  avgBrightness: number
  avgContrast: number
  dominantLightDirection: { x: number; y: number }
  lightIntensityMap: number[][]
}> {
  const { data, info } = await sharp(bufferOrPath)
    .greyscale()
    .resize(32, 32, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels: number[][] = []
  let totalBrightness = 0
  const width = 32
  const height = 32

  for (let y = 0; y < height; y++) {
    const row: number[] = []
    for (let x = 0; x < width; x++) {
      const val = data[y * width + x] / 255
      row.push(val)
      totalBrightness += val
    }
    pixels.push(row)
  }

  const avgBrightness = totalBrightness / (width * height)

  let variance = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      variance += Math.pow(pixels[y][x] - avgBrightness, 2)
    }
  }
  const avgContrast = Math.sqrt(variance / (width * height))

  let weightedX = 0
  let weightedY = 0
  let totalWeight = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const intensity = pixels[y][x]
      const weight = intensity * intensity
      weightedX += (x / (width - 1) - 0.5) * 2 * weight
      weightedY += (y / (height - 1) - 0.5) * 2 * weight
      totalWeight += weight
    }
  }

  const dominantLightDirection = totalWeight > 0
    ? { x: weightedX / totalWeight, y: weightedY / totalWeight }
    : { x: 0, y: -1 }

  const magnitude = Math.sqrt(
    dominantLightDirection.x ** 2 + dominantLightDirection.y ** 2
  )
  if (magnitude > 0) {
    dominantLightDirection.x /= magnitude
    dominantLightDirection.y /= magnitude
  }

  return {
    avgBrightness,
    avgContrast,
    dominantLightDirection,
    lightIntensityMap: pixels,
  }
}

export async function removeBackground(
  inputPath: string,
  outputPath: string
): Promise<{ outputPath: string; maskPath: string }> {
  const image = sharp(inputPath)
  const metadata = await image.metadata()
  const width = metadata.width || 512
  const height = metadata.height || 512

  const resizedBuffer = await image
    .clone()
    .resize(512, 512, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer()

  const estimatedMask = estimateMaskU2NetLike(resizedBuffer, 512, 512)

  const mask = sharp(estimatedMask, {
    raw: { width: 512, height: 512, channels: 1 },
  }).resize(width, height, { fit: 'fill' })

  const maskBuffer = await mask.toBuffer()
  const maskFilename = `mask-${Date.now()}.png`
  const maskPath = path.resolve(masksDir, maskFilename)
  await sharp(maskBuffer, {
    raw: { width, height, channels: 1 },
  }).png().toFile(maskPath)

  const rgbBuffer = await image
    .clone()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const rgbaBuffer = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgbaBuffer[i * 4] = rgbBuffer.data[i * 3]
    rgbaBuffer[i * 4 + 1] = rgbBuffer.data[i * 3 + 1]
    rgbaBuffer[i * 4 + 2] = rgbBuffer.data[i * 3 + 2]
    rgbaBuffer[i * 4 + 3] = maskBuffer[i]
  }

  await sharp(rgbaBuffer, {
    raw: {
      width,
      height,
      channels: 4,
    },
  }).png().toFile(outputPath)

  return { outputPath, maskPath }
}

function estimateMaskU2NetLike(
  rgbBuffer: Buffer,
  width: number,
  height: number
): Buffer {
  const mask = new Float32Array(width * height)
  const luminance = new Float32Array(width * height)

  for (let i = 0; i < width * height; i++) {
    const r = rgbBuffer[i * 3] / 255
    const g = rgbBuffer[i * 3 + 1] / 255
    const b = rgbBuffer[i * 3 + 2] / 255
    luminance[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }

  let cornerSum = 0
  const corners = [
    [0, 0], [width - 1, 0],
    [0, height - 1], [width - 1, height - 1],
  ]
  corners.forEach(([cx, cy]) => {
    for (let dy = 0; dy < 20; dy++) {
      for (let dx = 0; dx < 20; dx++) {
        const x = Math.min(Math.max(cx - 10 + dx, 0), width - 1)
        const y = Math.min(Math.max(cy - 10 + dy, 0), height - 1)
        cornerSum += luminance[y * width + x]
      }
    }
  })
  const cornerAvg = cornerSum / (20 * 20 * 4)

  let edgePixels: Array<{ l: number; idx: number }> = []
  for (let x = 0; x < width; x++) {
    edgePixels.push({ l: luminance[x], idx: x })
    edgePixels.push({ l: luminance[(height - 1) * width + x], idx: (height - 1) * width + x })
  }
  for (let y = 0; y < height; y++) {
    edgePixels.push({ l: luminance[y * width], idx: y * width })
    edgePixels.push({ l: luminance[y * width + width - 1], idx: y * width + width - 1 })
  }
  edgePixels.sort((a, b) => a.l - b.l)
  const bgLuminance = edgePixels[Math.floor(edgePixels.length * 0.15)].l

  const edgeColor = { r: 0, g: 0, b: 0 }
  const edgeCount = Math.floor(edgePixels.length * 0.1)
  for (let i = 0; i < edgeCount; i++) {
    const idx = edgePixels[i].idx * 3
    edgeColor.r += rgbBuffer[idx]
    edgeColor.g += rgbBuffer[idx + 1]
    edgeColor.b += rgbBuffer[idx + 2]
  }
  edgeColor.r /= edgeCount
  edgeColor.g /= edgeCount
  edgeColor.b /= edgeCount

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const rgbIdx = idx * 3
      const r = rgbBuffer[rgbIdx]
      const g = rgbBuffer[rgbIdx + 1]
      const b = rgbBuffer[rgbIdx + 2]

      const lum = luminance[idx]
      const edgeDist = Math.min(x, y, width - 1 - x, height - 1 - y)
      const edgeFactor = Math.min(1, edgeDist / 20)

      const bgDiff = Math.sqrt(
        Math.pow(r - edgeColor.r, 2) +
        Math.pow(g - edgeColor.g, 2) +
        Math.pow(b - edgeColor.b, 2)
      ) / Math.sqrt(255 * 255 * 3)

      let saliency = bgDiff * 0.7 + edgeFactor * 0.3

      const centerX = width / 2
      const centerY = height / 2
      const distFromCenter = Math.sqrt(
        Math.pow((x - centerX) / (width / 2), 2) +
        Math.pow((y - centerY) / (height / 2), 2)
      )
      const centerFactor = 1 - Math.min(1, distFromCenter) * 0.3
      saliency *= centerFactor

      mask[idx] = Math.max(0, Math.min(1, saliency))
    }
  }

  const temp = new Float32Array(mask)
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x
        let sum = 0
        let count = 0
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            sum += temp[(y + dy) * width + (x + dx)]
            count++
          }
        }
        mask[idx] = sum / count
      }
    }
  }

  const minVal = Math.min(...mask)
  const maxVal = Math.max(...mask)
  const range = maxVal - minVal || 1
  const result = Buffer.alloc(width * height)
  for (let i = 0; i < width * height; i++) {
    const normalized = (mask[i] - minVal) / range
    result[i] = Math.round(Math.pow(normalized, 0.8) * 255)
  }

  return result
}

export async function applyBrushStrokes(
  maskPath: string,
  width: number,
  height: number,
  strokes: BrushStroke[],
  outputMaskPath: string
): Promise<string> {
  const maskData = await sharp(maskPath)
    .resize(width, height, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const mask = new Float32Array(maskData.data)

  for (const stroke of strokes) {
    const centerX = stroke.x
    const centerY = stroke.y
    const radius = stroke.radius
    const mode = stroke.mode

    for (let y = Math.max(0, Math.floor(centerY - radius)); y < Math.min(height, Math.ceil(centerY + radius)); y++) {
      for (let x = Math.max(0, Math.floor(centerX - radius)); x < Math.min(width, Math.ceil(centerX + radius)); x++) {
        const dx = x - centerX
        const dy = y - centerY
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist <= radius) {
          const falloff = 1 - (dist / radius)
          const softFalloff = falloff * falloff * (3 - 2 * falloff)
          const idx = y * width + x

          if (mode === 'keep') {
            mask[idx] = Math.max(mask[idx], softFalloff)
          } else {
            mask[idx] = Math.min(mask[idx], 1 - softFalloff)
          }
        }
      }
    }
  }

  const result = Buffer.alloc(width * height)
  for (let i = 0; i < width * height; i++) {
    result[i] = Math.round(Math.max(0, Math.min(1, mask[i])) * 255)
  }

  await sharp(result, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputMaskPath)

  return outputMaskPath
}

export async function applyFeather(
  maskPath: string,
  params: FeatherParams,
  outputMaskPath: string
): Promise<string> {
  const { data, info } = await sharp(maskPath)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  const radius = Math.max(1, Math.round(params.radius))

  const mask = new Float32Array(data)
  const temp = new Float32Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx
        if (nx >= 0 && nx < width) {
          const weight = Math.exp(-(dx * dx) / (2 * radius * radius / 9))
          sum += mask[y * width + nx] * weight
          count += weight
        }
      }
      temp[y * width + x] = sum / (count || 1)
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy
        if (ny >= 0 && ny < height) {
          const weight = Math.exp(-(dy * dy) / (2 * radius * radius / 9))
          sum += temp[ny * width + x] * weight
          count += weight
        }
      }
      mask[y * width + x] = sum / (count || 1)
    }
  }

  const result = Buffer.alloc(width * height)
  for (let i = 0; i < width * height; i++) {
    result[i] = Math.round(Math.max(0, Math.min(255, mask[i])))
  }

  await sharp(result, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputMaskPath)

  return outputMaskPath
}

export async function applyThreshold(
  maskPath: string,
  params: ThresholdParams,
  outputMaskPath: string
): Promise<string> {
  const { data, info } = await sharp(maskPath)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const threshold = params.value * 255
  const softness = Math.max(1, params.softness * 255)

  const result = Buffer.alloc(info.width * info.height)
  for (let i = 0; i < info.width * info.height; i++) {
    const val = data[i]
    if (softness <= 1) {
      result[i] = val >= threshold ? 255 : 0
    } else {
      const normalized = (val - threshold + softness / 2) / softness
      const clamped = Math.max(0, Math.min(1, normalized))
      const smooth = clamped * clamped * (3 - 2 * clamped)
      result[i] = Math.round(smooth * 255)
    }
  }

  await sharp(result, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png()
    .toFile(outputMaskPath)

  return outputMaskPath
}

export async function applyMaskToImage(
  imagePath: string,
  maskPath: string,
  outputPath: string
): Promise<string> {
  const image = sharp(imagePath)
  const metadata = await image.metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  const rgbBuffer = await image
    .clone()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const maskBuffer = await sharp(maskPath)
    .resize(width, height, { fit: 'fill' })
    .raw()
    .toBuffer()

  const rgbaBuffer = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgbaBuffer[i * 4] = rgbBuffer.data[i * 3]
    rgbaBuffer[i * 4 + 1] = rgbBuffer.data[i * 3 + 1]
    rgbaBuffer[i * 4 + 2] = rgbBuffer.data[i * 3 + 2]
    rgbaBuffer[i * 4 + 3] = maskBuffer[i]
  }

  await sharp(rgbaBuffer, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(outputPath)

  return outputPath
}

export async function matchLightingToTemplate(
  imagePath: string,
  templatePath: string,
  outputPath: string,
  customParams?: Partial<LightingAdjustParams>
): Promise<{
  outputPath: string
  params: LightingAdjustParams
}> {
  const templateStats = await getImageStats(templatePath)
  const imageStats = await getImageStats(imagePath)

  const brightnessDelta = templateStats.avgBrightness - imageStats.avgBrightness
  const contrastDelta = templateStats.avgContrast / (imageStats.avgContrast || 1)

  const lightDirDot =
    templateStats.dominantLightDirection.x * imageStats.dominantLightDirection.x +
    templateStats.dominantLightDirection.y * imageStats.dominantLightDirection.y

  const lightDirection = templateStats.dominantLightDirection

  const params: LightingAdjustParams = {
    brightness: Math.max(-100, Math.min(100, brightnessDelta * 100 * 0.5 * (customParams?.brightness !== undefined ? 1 : 1))),
    contrast: Math.max(0.5, Math.min(2, contrastDelta * 0.8 + 0.2)),
    saturation: 1.0,
    lightDirection,
    shadowIntensity: Math.max(0, Math.min(1, (1 - (lightDirDot + 1) / 2) * 0.3)),
    ...customParams,
  }

  const image = sharp(imagePath)
  const metadata = await image.metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0
  const hasAlpha = metadata.channels === 4

  const rgbaData = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = 4
  const pixels = width * height

  const brightnessOffset = params.brightness * 2.55
  const contrastFactor = params.contrast

  for (let i = 0; i < pixels; i++) {
    const idx = i * channels
    const alpha = rgbaData.data[idx + 3]
    if (alpha === 0) continue

    let r = rgbaData.data[idx]
    let g = rgbaData.data[idx + 1]
    let b = rgbaData.data[idx + 2]

    const avg = (r + g + b) / 3
    r = avg + (r - avg) * contrastFactor
    g = avg + (g - avg) * contrastFactor
    b = avg + (b - avg) * contrastFactor

    r += brightnessOffset
    g += brightnessOffset
    b += brightnessOffset

    if (params.saturation !== 1) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      r = gray + (r - gray) * params.saturation
      g = gray + (g - gray) * params.saturation
      b = gray + (b - gray) * params.saturation
    }

    rgbaData.data[idx] = Math.max(0, Math.min(255, r))
    rgbaData.data[idx + 1] = Math.max(0, Math.min(255, g))
    rgbaData.data[idx + 2] = Math.max(0, Math.min(255, b))
  }

  if (params.shadowIntensity > 0) {
    applyDirectionalShadow(
      rgbaData.data,
      width,
      height,
      params.lightDirection,
      params.shadowIntensity
    )
  }

  let pipeline = sharp(rgbaData.data, {
    raw: { width, height, channels: 4 },
  })

  if (!hasAlpha) {
    pipeline = pipeline.toColorspace('srgb')
  }

  await pipeline.png().toFile(outputPath)

  return { outputPath, params }
}

function applyDirectionalShadow(
  rgba: Buffer,
  width: number,
  height: number,
  lightDir: { x: number; y: number },
  intensity: number
): void {
  const channels = 4
  const edgeMask = new Float32Array(width * height)

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x
      const alpha = rgba[idx * channels + 3]
      if (alpha < 128) continue

      let neighborAlpha = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          neighborAlpha += rgba[((y + dy) * width + (x + dx)) * channels + 3]
          count++
        }
      }
      neighborAlpha /= count
      if (neighborAlpha < 64) {
        edgeMask[idx] = 1
      }
    }
  }

  const shadowOffsetX = -Math.round(lightDir.x * 4)
  const shadowOffsetY = -Math.round(lightDir.y * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (edgeMask[idx] === 0) continue

      const shadowX = x + shadowOffsetX
      const shadowY = y + shadowOffsetY

      if (shadowX >= 0 && shadowX < width && shadowY >= 0 && shadowY < height) {
        const shadowIdx = shadowY * width + shadowOffsetX
        const pxIdx = idx * channels
        const sIdx = shadowIdx * channels
        if (rgba[sIdx + 3] > 0) {
          const shadowAmount = intensity * 0.15
          rgba[pxIdx] = Math.round(rgba[pxIdx] * (1 - shadowAmount))
          rgba[pxIdx + 1] = Math.round(rgba[pxIdx + 1] * (1 - shadowAmount))
          rgba[pxIdx + 2] = Math.round(rgba[pxIdx + 2] * (1 - shadowAmount))
        }
      }
    }
  }
}

export async function replaceBackground(
  foregroundPath: string,
  params: BackgroundReplaceParams,
  outputPath: string,
  targetWidth?: number,
  targetHeight?: number
): Promise<string> {
  const foreground = sharp(foregroundPath)
  const fgMeta = await foreground.metadata()
  const width = targetWidth || fgMeta.width || 0
  const height = targetHeight || fgMeta.height || 0

  let background: sharp.Sharp

  if (params.type === 'solid') {
    const color = params.solidColor || { r: 255, g: 255, b: 255 }
    const alpha = color.a !== undefined ? color.a / 255 : 1
    background = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { ...color, alpha },
      },
    })
  } else if (params.type === 'gradient' && params.gradient) {
    background = await createGradientBackground(
      width,
      height,
      params.gradient
    )
  } else if (params.type === 'image' && params.imagePath) {
    background = await createImageBackground(
      width,
      height,
      params.imagePath,
      params.imageFit || 'cover',
      params.imageOpacity ?? 1
    )
  } else {
    background = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
  }

  const fgBuffer = await foreground
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .toBuffer()

  await background
    .composite([
      {
        input: fgBuffer,
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toFile(outputPath)

  return outputPath
}

async function createGradientBackground(
  width: number,
  height: number,
  gradient: NonNullable<BackgroundReplaceParams['gradient']>
): Promise<sharp.Sharp> {
  const canvas = Buffer.alloc(width * height * 4)

  const angleRad = ((gradient.angle ?? 180) * Math.PI) / 180
  const centerX = width / 2
  const centerY = height / 2
  const diag = Math.sqrt(width * width + height * height) / 2

  const colors = gradient.colors.sort((a, b) => a.offset - b.offset)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let t: number

      if (gradient.type === 'linear') {
        const dx = x - centerX
        const dy = y - centerY
        const proj = dx * Math.cos(angleRad) + dy * Math.sin(angleRad)
        t = (proj + diag) / (2 * diag)
      } else {
        const radX = (gradient.endX ?? 0.5) * width
        const radY = (gradient.endY ?? 0.5) * height
        const maxR = Math.max(width, height) / 2
        const dx = (x - (gradient.startX ?? 0.5) * width) / Math.max(1, radX - centerX + width / 2)
        const dy = (y - (gradient.startY ?? 0.5) * height) / Math.max(1, radY - centerY + height / 2)
        t = Math.min(1, Math.sqrt(dx * dx + dy * dy))
      }

      t = Math.max(0, Math.min(1, t))

      let c1 = colors[0]
      let c2 = colors[colors.length - 1]
      for (let i = 0; i < colors.length - 1; i++) {
        if (t >= colors[i].offset && t <= colors[i + 1].offset) {
          c1 = colors[i]
          c2 = colors[i + 1]
          break
        }
      }

      const range = Math.max(0.001, c2.offset - c1.offset)
      const localT = (t - c1.offset) / range
      const smoothT = localT * localT * (3 - 2 * localT)

      const idx = (y * width + x) * 4
      canvas[idx] = Math.round(c1.r + (c2.r - c1.r) * smoothT)
      canvas[idx + 1] = Math.round(c1.g + (c2.g - c1.g) * smoothT)
      canvas[idx + 2] = Math.round(c1.b + (c2.b - c1.b) * smoothT)
      const a1 = c1.a !== undefined ? c1.a : 255
      const a2 = c2.a !== undefined ? c2.a : 255
      canvas[idx + 3] = Math.round(a1 + (a2 - a1) * smoothT)
    }
  }

  return sharp(canvas, { raw: { width, height, channels: 4 } })
}

async function createImageBackground(
  width: number,
  height: number,
  imagePath: string,
  fit: 'cover' | 'contain' | 'fill' | 'stretch',
  opacity: number
): Promise<sharp.Sharp> {
  let resizeOptions: sharp.ResizeOptions
  switch (fit) {
    case 'contain':
      resizeOptions = { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
      break
    case 'fill':
      resizeOptions = { fit: 'fill' }
      break
    case 'stretch':
      resizeOptions = { fit: 'fill', withoutEnlargement: false }
      break
    case 'cover':
    default:
      resizeOptions = { fit: 'cover' }
  }

  const imgBuffer = await sharp(imagePath)
    .resize(width, height, resizeOptions)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  if (opacity < 1) {
    const data = imgBuffer.data
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 3] = Math.round(data[i * 4 + 3] * opacity)
    }
  }

  return sharp(imgBuffer.data, { raw: { width, height, channels: 4 } })
}

export async function generateCheckeredBackground(
  width: number,
  height: number,
  tileSize = 16
): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 4)
  const color1 = { r: 204, g: 204, b: 204, a: 255 }
  const color2 = { r: 255, g: 255, b: 255, a: 255 }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tileX = Math.floor(x / tileSize)
      const tileY = Math.floor(y / tileSize)
      const isColor2 = (tileX + tileY) % 2 === 0
      const color = isColor2 ? color2 : color1
      const idx = (y * width + x) * 4
      data[idx] = color.r
      data[idx + 1] = color.g
      data[idx + 2] = color.b
      data[idx + 3] = color.a
    }
  }

  return data
}

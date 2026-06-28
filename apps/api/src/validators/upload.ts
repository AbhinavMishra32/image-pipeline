import { acceptedMimeTypes, maxUploadBytes } from "@image-pipeline/core";

function hasValidImageSignature(file: Express.Multer.File) {
  const buffer = file.buffer;

  if (file.mimetype === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (file.mimetype === "image/png") {
    return buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a;
  }

  if (file.mimetype === "image/webp") {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  return false;
}

export function validateUploadFile(file: Express.Multer.File | undefined) {
  if (!file) {
    throw new Error("Image file is required");
  }

  if (!acceptedMimeTypes.includes(file.mimetype as (typeof acceptedMimeTypes)[number])) {
    throw new Error("Unsupported image type");
  }

  if (file.size > maxUploadBytes) {
    throw new Error("Image exceeds 5MB limit");
  }

  if (!hasValidImageSignature(file)) {
    throw new Error("Image content does not match the declared type");
  }
}

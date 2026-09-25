export type PreparedImage = { dataUrl: string; base64: string; mediaType: string };

const PENDING_IMAGE_KEY = "wajbti_pending_meal_image";

// Phone camera photos can be several MB, which blows past the serverless
// function's request body limit once base64-encoded. Downscale and
// re-encode as JPEG before sending.
export function prepareImageFile(file: File): Promise<PreparedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("image decode failed"));
      img.onload = () => {
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ dataUrl, base64: dataUrl.split(",")[1] || "", mediaType: file.type || "image/jpeg" });
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const jpeg = canvas.toDataURL("image/jpeg", 0.8);
        resolve({ dataUrl: jpeg, base64: jpeg.split(",")[1] || "", mediaType: "image/jpeg" });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// Hand a photo picked from the quick-add sheet over to the /log page.
export function stashPendingImage(image: PreparedImage) {
  try {
    sessionStorage.setItem(PENDING_IMAGE_KEY, JSON.stringify(image));
  } catch {
    // Storage full/unavailable - /log just opens without the photo.
  }
}

export function takePendingImage(): PreparedImage | null {
  try {
    const raw = sessionStorage.getItem(PENDING_IMAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_IMAGE_KEY);
    return JSON.parse(raw) as PreparedImage;
  } catch {
    return null;
  }
}

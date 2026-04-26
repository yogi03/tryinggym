import { db } from "./firebase/config";
import { doc, getDoc } from "firebase/firestore";

/**
 * Optimized fast image compression.
 */
export async function compressImage(file: File, maxBytes: number, removeWhiteBg: boolean = false): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Compression timeout")), 20000); // 20s timeout

    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = async () => {
      URL.revokeObjectURL(url);
      
      try {
        const canvas = document.createElement("canvas");
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        // Scale down to 1000px max dimension (faster & usually plenty for profile pics)
        const MAX_DIM = 1000;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          clearTimeout(timeout);
          return reject(new Error("Canvas context failed"));
        }
        
        ctx.drawImage(img, 0, 0, width, height);

        if (removeWhiteBg) {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
             if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
                data[i+3] = 0;
             }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        // Faster steps: 0.8 -> 0.5 -> 0.2
        const qualities = [0.8, 0.5, 0.2];
        let finalBlob: Blob | null = null;
        const format = removeWhiteBg ? "image/png" : "image/jpeg";

        for (const quality of qualities) {
          finalBlob = await new Promise<Blob | null>((res) => 
            canvas.toBlob((b) => res(b), format, quality)
          );
          
          if (!finalBlob) continue;
          console.log(`[Cloudinary Storage] Quality ${quality}: ${(finalBlob.size / 1024).toFixed(2)} KB`);
          
          if (finalBlob.size <= maxBytes) break;
        }

        clearTimeout(timeout);
        if (finalBlob) resolve(finalBlob);
        else reject(new Error("Failed to compress"));
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    img.src = url;
  });
}

/**
 * Helper to get gym name and sanitize it for folder structure
 */
async function getSanitizedGymName(gymId: string): Promise<string> {
  try {
    const gymDoc = await getDoc(doc(db, "gyms", gymId));
    if (gymDoc.exists()) {
      const name = gymDoc.data().name;
      if (name) {
        return name.replace(/[^a-zA-Z0-9 -]/g, '').trim().replace(/\s+/g, '_');
      }
    }
  } catch (e) {
    console.error("Failed to fetch gym name for folder:", e);
  }
  return gymId;
}

/**
 * Compresses an image file to under 500 KB using canvas,
 * then uploads it to Cloudinary Storage using an unsigned preset.
 */
export async function compressAndUploadPhoto(
  file: File,
  gymId: string,
  memberId: string
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration missing in environment variables.");
  }

  try {
    console.log(`[Cloudinary Storage] Starting upload for member: ${memberId}`);
    
    let fileToProcess = file;
    // Handle HEIC images from iPhones
    if (fileToProcess.name.toLowerCase().endsWith(".heic") || fileToProcess.name.toLowerCase().endsWith(".heif") || fileToProcess.type === "image/heic") {
      console.log("[Cloudinary Storage] Converting HEIC image to JPEG...");
      const heic2any = (await import("heic2any")).default;
      const convertedBlob = await heic2any({
        blob: fileToProcess,
        toType: "image/jpeg",
        quality: 0.8,
      });
      const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      fileToProcess = new File([singleBlob], fileToProcess.name.replace(/\.heic$|\.heif$/i, ".jpg"), {
        type: "image/jpeg",
      });
    }

    // 1. Compression (always compress to ensure consistent format and size)
    console.log(`[Cloudinary Storage] Compressing file: ${fileToProcess.name} (${(fileToProcess.size / 1024).toFixed(2)} KB)`);
    const fileToUpload = await compressImage(fileToProcess, 500 * 1024);
    
    // 2. Upload to Cloudinary
    const formData = new FormData();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${memberId}_${randomSuffix}.jpg`;
    
    // Important: Provide a filename because fileToUpload is a Blob
    const sanitizedGymName = await getSanitizedGymName(gymId);
    formData.append("file", fileToUpload, fileName);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", `${sanitizedGymName}/members`);
    formData.append("public_id", `${memberId}_${randomSuffix}`);

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const response = await fetch(cloudinaryUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Cloudinary upload failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Cloudinary Storage] Upload successful. URL: ${data.secure_url}`);
    
    return data.secure_url;
  } catch (error) {
    console.error("[Cloudinary Storage] Error in compressAndUploadPhoto:", error);
    throw error;
  }
}
/**
 * Uploads a document (like PDF) to Cloudinary for GST verification.
 * Uses resource_type: "auto" to handle PDFs.
 */
export async function uploadGSTDocument(
  file: File,
  gymId: string
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration missing in environment variables.");
  }

  try {
    const formData = new FormData();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `gst_doc_${gymId}_${randomSuffix}`;
    
    const sanitizedGymName = await getSanitizedGymName(gymId);
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", `${sanitizedGymName}/gst`);
    formData.append("public_id", fileName);
    formData.append("resource_type", "raw"); // Important for PDFs

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;

    const response = await fetch(cloudinaryUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Cloudinary upload failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error("[Cloudinary Storage] Error in uploadGSTDocument:", error);
    throw error;
  }
}

/**
 * Compresses an image file and uploads it to Cloudinary with AI background removal.
 */
export async function uploadGymLogoToCloudinary(
  file: File,
  gymId: string
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration missing in environment variables.");
  }

  try {
    const fileToUpload = await compressImage(file, 500 * 1024, true);
    
    const formData = new FormData();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `logo_${gymId}_${randomSuffix}.png`;
    
    const sanitizedGymName = await getSanitizedGymName(gymId);
    formData.append("file", fileToUpload, fileName);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", `${sanitizedGymName}/branding`);
    formData.append("public_id", `logo_${randomSuffix}`);

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const response = await fetch(cloudinaryUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Cloudinary upload failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error("[Cloudinary Storage] Error in uploadGymLogoToCloudinary:", error);
    throw error;
  }
}

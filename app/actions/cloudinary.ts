"use server";

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Deletes an image from Cloudinary using its secure URL.
 * Requires CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the environment.
 */
export async function deleteCloudinaryImage(url: string) {
  if (!url || !url.includes("cloudinary.com")) return false;

  try {
    // Extract public ID from the Cloudinary URL
    // Format: https://res.cloudinary.com/<cloud_name>/image/upload/v<version>/<folder>/<public_id>.<ext>
    const regex = /\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+$/;
    const match = url.match(regex);
    
    if (!match) return false;
    
    const publicId = match[1];
    console.log(`[Cloudinary] Deleting public_id: ${publicId}`);
    
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`[Cloudinary] Delete result:`, result);
    
    return result.result === "ok";
  } catch (error) {
    console.error("[Cloudinary] Error deleting image:", error);
    return false;
  }
}

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image_file");

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    /* Convert file to base64 */
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${imageFile.type};base64,${buffer.toString("base64")}`;

    /* Upload with eager background removal transformation */
    const result = await cloudinary.uploader.upload(base64, {
      folder: "menu-images",
      eager: [
        {
          effect: "background_removal",
          format: "png",
        },
      ],
      eager_async: false,
    });

    /* Use the bg-removed URL if available, else original */
    const bgRemovedUrl = result.eager?.[0]?.secure_url;
    const imageUrl = bgRemovedUrl || result.secure_url;

    return NextResponse.json({
      imageUrl,
      publicId: result.public_id,
      success: true,
      bgRemoved: !!bgRemovedUrl,
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

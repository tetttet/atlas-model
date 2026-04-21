import { ImageResponse } from "next/og";
import {
  AtlasSocialImage,
  socialImageAlt,
  socialImageSize,
} from "@/lib/admissions/site-metadata";

export const alt = socialImageAlt;
export const size = socialImageSize;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<AtlasSocialImage />, {
    ...size,
  });
}

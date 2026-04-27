import { createBotResponse } from "@/lib/admissions/bot";
import type { ChatRequest } from "@/lib/admissions/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ChatRequest>;
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return Response.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }

    if (message.length > 1200) {
      return Response.json(
        { error: "Message is too long. Keep it under 1200 characters." },
        { status: 413 },
      );
    }

    return createBotResponse(
      message,
      body.memory,
      body.leadProfile,
    );
  } catch {
    return Response.json(
      {
        error:
          "Could not process the message. Please try again or contact a manager.",
      },
      { status: 500 },
    );
  }
}

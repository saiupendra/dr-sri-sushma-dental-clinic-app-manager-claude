import { toWhatsAppNumber } from "./whatsapp.js";

const GRAPH_API_VERSION = "v21.0";

export interface WhatsAppCloudApiConfig {
  WHATSAPP_CLOUD_API_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_COMPLETED_TEMPLATE_NAME?: string;
  WHATSAPP_COMPLETED_TEMPLATE_LANG?: string;
}

export function isWhatsAppCloudApiConfigured(env: WhatsAppCloudApiConfig): boolean {
  return !!(env.WHATSAPP_CLOUD_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_COMPLETED_TEMPLATE_NAME);
}

export type SendTemplateResult = { ok: true } | { ok: false; error: string };

/**
 * Sends a pre-approved WhatsApp template message via Meta's Cloud API - the
 * only way to message a patient with zero staff interaction. Unlike the
 * wa.me flow in whatsapp.ts, this is a business-initiated message outside
 * any 24-hour customer session, so Meta requires it to use a template that
 * has already been submitted and approved in WhatsApp Manager; the body's
 * static wording is whatever was approved, and bodyParams fills in that
 * template's {{1}}, {{2}}, ... placeholders in order. There is no way to
 * send free-form text here - an unapproved template name is rejected by
 * Meta's API, not by this function.
 */
export async function sendWhatsAppTemplateMessage(
  env: WhatsAppCloudApiConfig,
  toRawPhone: string,
  bodyParams: string[],
): Promise<SendTemplateResult> {
  if (!isWhatsAppCloudApiConfigured(env)) {
    return { ok: false, error: "WhatsApp Cloud API is not configured (missing token, phone number ID, or template name)" };
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: toWhatsAppNumber(toRawPhone),
    type: "template",
    template: {
      name: env.WHATSAPP_COMPLETED_TEMPLATE_NAME,
      language: { code: env.WHATSAPP_COMPLETED_TEMPLATE_LANG ?? "en" },
      components: [
        {
          type: "body",
          parameters: bodyParams.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_CLOUD_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Meta API responded ${res.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error calling Meta API" };
  }
}

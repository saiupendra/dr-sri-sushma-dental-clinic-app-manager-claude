import { afterEach, describe, expect, it, vi } from "vitest";
import { isWhatsAppCloudApiConfigured, sendWhatsAppTemplateMessage } from "../src/lib/whatsappCloudApi.js";

const CONFIGURED = {
  WHATSAPP_CLOUD_API_TOKEN: "test-token",
  WHATSAPP_PHONE_NUMBER_ID: "123456",
  WHATSAPP_COMPLETED_TEMPLATE_NAME: "appointment_completed",
  WHATSAPP_COMPLETED_TEMPLATE_LANG: "en",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isWhatsAppCloudApiConfigured", () => {
  it("is true only once token, phone number ID and template name are all set", () => {
    expect(isWhatsAppCloudApiConfigured(CONFIGURED)).toBe(true);
    expect(isWhatsAppCloudApiConfigured({})).toBe(false);
    expect(isWhatsAppCloudApiConfigured({ WHATSAPP_CLOUD_API_TOKEN: "x" })).toBe(false);
  });
});

describe("sendWhatsAppTemplateMessage", () => {
  it("skips the network call and reports not configured when env is incomplete", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await sendWhatsAppTemplateMessage({}, "9876543210", ["Asha", "5 October"]);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("not configured") });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts a template message to Meta's Graph API with the formatted phone number and body params", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendWhatsAppTemplateMessage(CONFIGURED, "9876543210", ["Asha", "5 October 2026 at 4:30 PM"]);

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/123456/messages");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-token" });
    const body = JSON.parse(init.body as string) as {
      messaging_product: string;
      to: string;
      template: { name: string; language: { code: string }; components: { parameters: { text: string }[] }[] };
    };
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.to).toBe("919876543210");
    expect(body.template.name).toBe("appointment_completed");
    expect(body.template.language.code).toBe("en");
    expect(body.template.components[0]!.parameters.map((p) => p.text)).toEqual(["Asha", "5 October 2026 at 4:30 PM"]);
  });

  it("reports a failure result (not a throw) when Meta's API rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("template not approved", { status: 400 })),
    );
    const result = await sendWhatsAppTemplateMessage(CONFIGURED, "9876543210", ["Asha", "today"]);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("400");
  });

  it("reports a failure result when the network call itself throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    const result = await sendWhatsAppTemplateMessage(CONFIGURED, "9876543210", ["Asha", "today"]);
    expect(result).toEqual({ ok: false, error: "network down" });
  });
});

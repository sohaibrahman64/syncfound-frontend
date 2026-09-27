import { apiFetch } from "../utils/apiClient";
import { BASE_URL } from "../utils/Constants";

describe("apiFetch", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it("builds the backend URL and adds default headers while preserving caller headers", async () => {
    await apiFetch("/countries-new", {
      method: "GET",
      headers: {
        Authorization: "Bearer token-123",
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL).replace(/\/$/, "")}/countries-new`,
      expect.objectContaining({
        method: "GET",
        headers: {
          "ngrok-skip-browser-warning": "true",
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
      }),
    );
  });

  it("does not set a JSON content type for multipart bodies", async () => {
    if (typeof FormData === "undefined") {
      return;
    }

    const body = new FormData();
    await apiFetch("/images/upload", { method: "POST", body });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/images/upload"),
      expect.objectContaining({
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      }),
    );
  });
});
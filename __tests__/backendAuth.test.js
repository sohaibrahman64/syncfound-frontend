jest.mock("../utils/apiClient", () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from "../utils/apiClient";
import { submitUserProfile } from "../utils/backendAuth";

describe("submitUserProfile", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });
  });

  it("sends an absolute profile image URL as a path", async () => {
    const profileData = {
      firstName: "Ada",
      profileImageUri:
        "http://127.0.0.1:8000/uploads/images/2026/06/17/photo.jpg",
    };

    await submitUserProfile(profileData, "firebase-token");

    const [, options] = apiFetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      firstName: "Ada",
      profileImageUri: "/uploads/images/2026/06/17/photo.jpg",
    });
    expect(profileData.profileImageUri).toBe(
      "http://127.0.0.1:8000/uploads/images/2026/06/17/photo.jpg",
    );
  });
});
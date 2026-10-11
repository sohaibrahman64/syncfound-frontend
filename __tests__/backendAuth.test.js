jest.mock("../utils/apiClient", () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from "../utils/apiClient";
import {
  getMyProfile,
  getMyProfileIndustries,
  getPrompts,
  getUserSkills,
  submitUserProfile,
} from "../utils/backendAuth";

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

describe("getMyProfile", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ firstName: "Sohaib" }),
    });
  });

  it("requests the current-user profile with a bearer token", async () => {
    await expect(getMyProfile("firebase-token")).resolves.toEqual({
      firstName: "Sohaib",
    });

    expect(apiFetch).toHaveBeenCalledWith("/users/me/profile", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer firebase-token",
      },
    });
  });
});

describe("getMyProfileIndustries", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          id: 7,
          industry_name: "Retail",
          created_at: "2026-10-07T10:00:00Z",
          updated_at: "2026-10-07T10:00:00Z",
        },
      ]),
    });
  });

  describe("getPrompts", () => {
    beforeEach(() => {
      apiFetch.mockReset();
      apiFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 1, prompt_text: "My motivation to build a startup" },
        ]),
      });
    });

    it("loads the prompts list with the user's bearer token", async () => {
      await expect(getPrompts("firebase-token")).resolves.toEqual([
        { id: 1, prompt_text: "My motivation to build a startup" },
      ]);

      expect(apiFetch).toHaveBeenCalledWith("/prompts", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer firebase-token",
        },
      });
    });
  });

  it("requests the current user's profile industries with a bearer token", async () => {
    await expect(getMyProfileIndustries("firebase-token")).resolves.toEqual([
      {
        id: 7,
        industry_name: "Retail",
        created_at: "2026-10-07T10:00:00Z",
        updated_at: "2026-10-07T10:00:00Z",
      },
    ]);

    expect(apiFetch).toHaveBeenCalledWith("/users/me/profile/industries", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer firebase-token",
      },
    });
  });

  describe("getUserSkills", () => {
    beforeEach(() => {
      apiFetch.mockReset();
      apiFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 1, skill_name: "AI/ML" },
        ]),
      });
    });

    it("loads user skills from /user-skills with the user's bearer token", async () => {
      await expect(getUserSkills("firebase-token")).resolves.toEqual([
        { id: 1, skill_name: "AI/ML" },
      ]);

      expect(apiFetch).toHaveBeenCalledWith("/user-skills", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer firebase-token",
        },
      });
    });
  });
});
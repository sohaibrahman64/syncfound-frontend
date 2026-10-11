import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  getIndustries,
  getMyProfileIndustries,
  getMyProfileLinkedinDetails,
  getPrompts,
} from "../utils/backendAuth";
import ProfileEditScreen from "../screens/ProfileEditScreen";

jest.mock("../utils/backendAuth", () => ({
  getIndustries: jest.fn(),
  getMyProfileIndustries: jest.fn(),
  getMyProfileLinkedinDetails: jest.fn(),
  getPrompts: jest.fn(),
}));

beforeEach(() => {
  getIndustries.mockResolvedValue([]);
  getMyProfileIndustries.mockResolvedValue([]);
  getMyProfileLinkedinDetails.mockResolvedValue({});
  getPrompts.mockResolvedValue([]);
});

it("reflects edited city and location preferences in the Location row on Done", async () => {
  const profile = {
    locationPreference: [],
    locationDetails: {
      selected_city: "Old City",
      cities: ["New City"],
    },
    locationPreferenceQuestions: [
      {
        question_id: 1,
        question: "Are you open to work remotely?",
        answers: [
          { answer_id: 11, answer: "Yes" },
          { answer_id: 12, answer: "No" },
        ],
      },
      {
        question_id: 2,
        question: "What is your preference in working remotely?",
        answers: [{ answer_id: 21, answer: "Remote only" }],
      },
      {
        question_id: 3,
        question: "Are you willing to relocate?",
        answers: [
          { answer_id: 31, answer: "Yes" },
          { answer_id: 32, answer: "No" },
        ],
      },
    ],
  };

  const { getByLabelText, getAllByRole, getByRole, getByText, findByText } =
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}
      >
        <ProfileEditScreen profile={profile} />
      </SafeAreaProvider>,
    );

  fireEvent.press(getByLabelText("Location"));
  fireEvent.press(getByLabelText("Select City"));
  fireEvent.press(await findByText("New City"));
  const noOptions = getAllByRole("radio", { name: "No" });
  fireEvent.press(noOptions[0]);
  fireEvent.press(getByRole("radio", { name: "Remote only" }));
  fireEvent.press(noOptions[1]);
  fireEvent.press(getByText("Done"));

  expect(
    getByText(
      "New City · On-site · Remote only · Not willing to relocate",
    ),
  ).toBeTruthy();

  fireEvent.press(getByLabelText("Location"));
  const reopenedNoOptions = getAllByRole("radio", { name: "No" });
  expect(reopenedNoOptions[0].props.accessibilityState.checked).toBe(true);
  expect(
    getByRole("radio", { name: "Remote only" }).props.accessibilityState
      .checked,
  ).toBe(true);
  expect(reopenedNoOptions[1].props.accessibilityState.checked).toBe(true);
});

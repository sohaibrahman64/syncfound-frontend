import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
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

it("shows talent background details when Talent is selected", () => {
  const { getAllByText, getByText, queryByText } = render(
    <ProfileEditScreen profile={{ locationPreference: [] }} />,
  );

  fireEvent.press(getByText("Talent"));

  expect(getByText("My Background as a Talent")).toBeTruthy();
  expect(getByText("Job Search Profile*")).toBeTruthy();
  expect(
    getByText("Actively job seeking. Full-time or part-time roles"),
  ).toBeTruthy();
  expect(getByText("Primary Role*")).toBeTruthy();
  expect(getByText("Full-Stack Engineer, 5 years exp")).toBeTruthy();
  expect(getByText("Compensation*")).toBeTruthy();
  expect(
    getByText("Interested in some equity. Ideally above(Min: USD 250,000)"),
  ).toBeTruthy();
  expect(getByText("Company Size")).toBeTruthy();
  expect(getByText("Open to size: Mid-size (51-200)")).toBeTruthy();
  expect(getByText("Work Authorization*")).toBeTruthy();
  expect(getByText("I am not seeking work in the U.S.")).toBeTruthy();
  expect(queryByText("Matching Goal*")).toBeNull();
  expect(queryByText("Number of Founders")).toBeNull();

  fireEvent.press(getByText("Founder"));
  expect(getByText("My Background as a Founder")).toBeTruthy();
  expect(getByText("Matching Goal*")).toBeTruthy();

  fireEvent.press(getByText("Both"));
  const backgroundTitles = getAllByText(
    /^My Background as a (Founder|Talent)$/,
  );
  expect(backgroundTitles).toHaveLength(2);
  expect(backgroundTitles[0].props.children).toBe("My Background as a Founder");
  expect(backgroundTitles[1].props.children).toBe("My Background as a Talent");
  expect(getByText("Matching Goal*")).toBeTruthy();
  expect(getByText("Job Search Profile*")).toBeTruthy();
});

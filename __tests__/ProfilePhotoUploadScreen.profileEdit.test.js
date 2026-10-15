import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ProfilePhotoUploadScreen from "../screens/ProfilePhotoUploadScreen";

jest.mock("../utils/backendAuth", () => ({
  removeProfileImage: jest.fn(),
  uploadProfileImage: jest.fn(),
}));

describe("ProfilePhotoUploadScreen from ProfileEditScreen", () => {
  it("opens the photo source menu and reopens it from the edit badge", () => {
    const { getByLabelText, getByText } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}
      >
        <ProfilePhotoUploadScreen
          profileEditTheme
          openSourceMenuOnMount
          initialProfileImageUri="https://example.com/current-photo.jpg"
        />
      </SafeAreaProvider>,
    );

    expect(getByText("Upload From LinkedIn")).toBeTruthy();
    expect(getByText("Take A Picture")).toBeTruthy();
    expect(getByText("Upload From Gallery")).toBeTruthy();

    fireEvent.press(getByText("×"));
    fireEvent.press(getByLabelText("Edit photo options"));

    expect(getByText("Upload From LinkedIn")).toBeTruthy();
    expect(getByText("Take A Picture")).toBeTruthy();
    expect(getByText("Upload From Gallery")).toBeTruthy();
  });
});

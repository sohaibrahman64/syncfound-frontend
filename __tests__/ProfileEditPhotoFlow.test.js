import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import ProfileEditScreen from "../screens/ProfileEditScreen";

jest.mock("../utils/backendAuth", () => ({
  getIndustries: jest.fn().mockResolvedValue([]),
  getMyProfileIndustries: jest.fn().mockResolvedValue([]),
  getMyProfileLinkedinDetails: jest.fn().mockResolvedValue({}),
  getUserSkills: jest.fn().mockResolvedValue([]),
  getUserProfileSelectedSkills: jest.fn().mockResolvedValue([]),
  getPrompts: jest.fn().mockResolvedValue([]),
}));

jest.mock("../utils/apiClient", () => ({
  apiFetch: jest.fn().mockResolvedValue([]),
}));

jest.mock("../screens/ProfilePhotoUploadScreen", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");

  return function MockProfilePhotoUploadScreen(props) {
    return (
      <>
        <Text testID="upload-photo-screen">
          {String(props.profileEditTheme)}
        </Text>
        <Text testID="upload-source-menu-open">
          {String(props.openSourceMenuOnMount)}
        </Text>
        <Pressable
          testID="upload-photo-to-edit"
          onPress={() =>
            props.onContinue({
              pendingProfileImageUri: "file:///new-photo.jpg",
              pendingProfileImageSource: "gallery",
              profileImageRotation: 0,
              profileImageScale: 1,
              profileImageTranslateX: 0,
              profileImageTranslateY: 0,
            })
          }
        />
        <Pressable
          testID="finish-photo"
          onPress={() =>
            props.onContinue({
              profileImageUri: "https://example.com/new-photo.jpg",
              profileImageSource: "gallery",
              profileImageRotation: 90,
              profileImageScale: 1.2,
            })
          }
        />
      </>
    );
  };
});

jest.mock("../screens/ProfileEditPictureScreen", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");

  return function MockProfileEditPictureScreen(props) {
    return (
      <>
        <Text testID="edit-photo-screen">
          {String(props.profileEditTheme)}
        </Text>
        <Pressable
          testID="save-edited-photo"
          onPress={() =>
            props.onContinue({
              profileImageUri: props.initialImageUri,
              profileImageSource: props.initialImageSource,
              profileImageRotation: 90,
              profileImageScale: 1.2,
              profileImageTranslateX: 0,
              profileImageTranslateY: 0,
              profileImageCropRect: null,
              pendingProfileImageUri: "",
              pendingProfileImageSource: "",
            })
          }
        />
      </>
    );
  };
});

describe("ProfileEditScreen photo flow", () => {
  it("opens the themed upload and edit screens from the photo edit button", () => {
    const { getByLabelText, getByTestId } = render(
      <ProfileEditScreen profileImageUrl="https://example.com/current.jpg" />,
    );

    fireEvent.press(getByLabelText("Edit photo"));
    expect(getByTestId("upload-photo-screen").props.children).toBe("true");
    expect(getByTestId("upload-source-menu-open").props.children).toBe("true");

    fireEvent.press(getByTestId("upload-photo-to-edit"));
    expect(getByTestId("edit-photo-screen").props.children).toBe("true");

    fireEvent.press(getByTestId("save-edited-photo"));
    expect(getByTestId("upload-photo-screen")).toBeTruthy();

    fireEvent.press(getByTestId("finish-photo"));
    expect(getByLabelText("Edit photo")).toBeTruthy();
  });
});

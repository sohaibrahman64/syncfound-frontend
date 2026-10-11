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
  getIndustries.mockResolvedValue([
    { id: 1, industry_name: "Social Networks" },
    { id: 2, industry_name: "Travel" },
    { id: 3, industry_name: "Wellness" },
  ]);
  getMyProfileIndustries.mockResolvedValue([]);
  getMyProfileLinkedinDetails.mockResolvedValue({});
  getPrompts.mockResolvedValue([
    { id: 1, prompt_name: "My motivation to build a startup" },
    { id: 2, prompt_name: "I am passionate about" },
  ]);
});

describe("ProfileEditScreen headline editor", () => {
  it("opens an empty headline editor and saves the entered headline", () => {
    const { getByLabelText, getByPlaceholderText, getByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("My Headline"));

    const headlineInput = getByPlaceholderText("Write your headline here");
    expect(headlineInput.props.value).toBe("");

    fireEvent.changeText(headlineInput, "Founder and product builder");
    fireEvent.press(getByText("Done"));

    expect(getByText("Founder and product builder")).toBeTruthy();
  });
});

describe("ProfileEditScreen idea editor", () => {
  it("opens an empty idea editor and saves the entered idea", () => {
    const { getByLabelText, getByPlaceholderText, getByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("My Idea"));

    const ideaInput = getByPlaceholderText("Write your idea here");
    expect(ideaInput.props.value).toBe("");
    expect(getByText("Idea")).toBeTruthy();
    expect(getByText("I’m exploring")).toBeTruthy();
    expect(getByLabelText("Back")).toBeTruthy();

    fireEvent.changeText(ideaInput, "A platform for independent founders");
    fireEvent.press(getByText("Done"));

    expect(getByText("A platform for independent founders")).toBeTruthy();
  });
});

describe("ProfileEditScreen written prompt editor", () => {
  it("opens an empty answer editor and saves an entered answer", async () => {
    const {
      getByLabelText,
      getByPlaceholderText,
      getByText,
      getByRole,
      findByRole,
    } = render(<ProfileEditScreen firebaseToken="profile-token" />);

    fireEvent.press(getByLabelText("Prompt 1"));

    expect(getByPlaceholderText("Write your answer here").props.value).toBe("");
    expect(getByText("Written Prompt")).toBeTruthy();
    expect(getByText("Select A Prompt")).toBeTruthy();
    expect(getByLabelText("Select a prompt").props.accessibilityState.disabled).toBeFalsy();
    fireEvent.press(getByLabelText("Select a prompt"));
    expect(
      await findByRole("button", { name: "My motivation to build a startup" }),
    ).toBeTruthy();
    expect(getPrompts).toHaveBeenCalledWith("profile-token");
    fireEvent.press(
      getByRole("button", { name: "My motivation to build a startup" }),
    );

    const answerInput = getByPlaceholderText("Write your answer here");
    fireEvent.changeText(answerInput, "I want to help founders build better.");
    fireEvent.press(getByText("Done"));

    expect(
      getByText("I want to help founders build better."),
    ).toBeTruthy();
  });

  it("saves the selected prompt and displays it on its profile tile", async () => {
    const { getByLabelText, getByText, getAllByText, findByRole } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("Prompt 1"));
    fireEvent.press(getByLabelText("Select a prompt"));
    const promptOption = await findByRole("button", {
      name: "My motivation to build a startup",
    });
    fireEvent.press(promptOption);
    fireEvent.press(getByText("Done"));

    expect(getByText("My motivation to build a startup")).toBeTruthy();
    expect(getAllByText("And write your own answer")).toHaveLength(3);
  });

  it("shows empty prompt placeholders on every prompt tile", () => {
    const { getAllByText, queryByText } = render(<ProfileEditScreen />);

    expect(getAllByText("Select a prompt")).toHaveLength(3);
    expect(getAllByText("And write your own answer")).toHaveLength(3);
    expect(queryByText("My motivation to build a startup")).toBeNull();
    expect(queryByText("The risk I’m most glad I took")).toBeNull();
  });
});

describe("ProfileEditScreen matching goal editor", () => {
  it("opens goal choices and applies the selected goal when returning", () => {
    const { getByLabelText, getByRole, getByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("Matching Goal"));

    expect(getByText("Matching Goal")).toBeTruthy();
    expect(getByText("Select Your matching goal")).toBeTruthy();
    expect(getByText("Are you hiring?")).toBeTruthy();
    expect(getByText("Yes")).toBeTruthy();
    expect(getByText("No")).toBeTruthy();

    fireEvent.press(getByRole("button", { name: "Open to chatting" }));
    fireEvent.press(getByLabelText("Back"));

    expect(getByText("Open to chatting")).toBeTruthy();
  });

  it("shows the existing matching goal selected by default", () => {
    const { getByLabelText, getByRole } = render(<ProfileEditScreen />);

    fireEvent.press(getByLabelText("Matching Goal"));

    expect(
      getByRole("button", {
        name: "Have some ideas but open to exploring",
      }).props.accessibilityState.selected,
    ).toBe(true);
  });
});

describe("ProfileEditScreen commitment level editor", () => {
  it("opens commitment choices and applies the selected level when returning", () => {
    const { getByLabelText, getByRole, getByText, queryByText } = render(
      <ProfileEditScreen />,
    );

    expect(getByText("Commitment Level*")).toBeTruthy();
    expect(queryByText("Committing Goal*")).toBeNull();
    fireEvent.press(getByLabelText("Commitment Level"));

    expect(getByText("Commitment Level")).toBeTruthy();
    expect(getByText("Select Your Commitment Level")).toBeTruthy();
    fireEvent.press(
      getByRole("button", { name: "No specific startup plans yet" }),
    );
    fireEvent.press(getByLabelText("Back"));

    expect(getByText("No specific startup plans yet")).toBeTruthy();
  });

  it("shows the current commitment level selected by default", () => {
    const { getByLabelText, getByRole } = render(<ProfileEditScreen />);

    fireEvent.press(getByLabelText("Commitment Level"));

    expect(
      getByRole("button", {
        name: "Ready to go full-time with the right cofounder",
      }).props.accessibilityState.selected,
    ).toBe(true);
  });
});

describe("ProfileEditScreen prior startup experience editor", () => {
  it("opens the startup experience choices with no prior experience selected", () => {
    const { getByLabelText, getByRole, getByText } = render(
      <ProfileEditScreen />,
    );

    expect(getByText("Prior Startup Experience")).toBeTruthy();
    fireEvent.press(getByLabelText("Prior Startup Experience"));

    expect(getByText("Do you have any startup experience?")).toBeTruthy();
    expect(
      getByRole("button", { name: "No prior startup experience" }).props
        .accessibilityState.selected,
    ).toBe(true);
  });

  it("updates the profile row when a different experience is selected", () => {
    const { getByLabelText, getByRole, getByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("Prior Startup Experience"));
    fireEvent.press(getByRole("button", { name: "Sold a startup" }));
    fireEvent.press(getByLabelText("Back"));

    expect(getByText("Sold a startup")).toBeTruthy();
  });
});

describe("ProfileEditScreen personal detail editors", () => {
  it("edits first and last name", () => {
    const { getByLabelText, getByPlaceholderText, getByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("Name"));
    expect(getByText("Name")).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText("First Name*"), "Ada");
    fireEvent.changeText(
      getByPlaceholderText("Last Name (optional)"),
      "Lovelace",
    );
    fireEvent.press(getByText("Done"));

    expect(getByText("Ada Lovelace")).toBeTruthy();
  });

  it("opens the date of birth editor from Age", () => {
    const { getByLabelText, getByText } = render(<ProfileEditScreen />);

    fireEvent.press(getByLabelText("Age"));
    expect(getByText("Age")).toBeTruthy();
    expect(getByLabelText("Date of Birth")).toBeTruthy();
    expect(getByText("Age: Not selected")).toBeTruthy();
  });

  it("prepopulates the user's date of birth and calculates their age", () => {
    const { getByLabelText, getByText, getByRole, getByTestId } = render(
      <ProfileEditScreen initialDateOfBirth="2000-01-01T00:00:00Z" />,
    );

    fireEvent.press(getByLabelText("Age"));

    expect(getByText("01/01/00")).toBeTruthy();
    expect(getByText(/^Age: \d+$/)).toBeTruthy();
    fireEvent.press(getByRole("button", { name: "Open calendar" }));
    expect(getByTestId("profile-dob-picker")).toBeTruthy();

    fireEvent(getByTestId("profile-dob-picker"), "onChange", {
      nativeEvent: { timestamp: new Date(2010, 0, 1).getTime() },
    });
    expect(getByText("Age: 16")).toBeTruthy();
    fireEvent.press(getByText("Done"));
    expect(getByText("16 years old")).toBeTruthy();
  });

  it("edits the city and location preferences", () => {
    const { getByLabelText, getByRole, getByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("Location"));
    expect(getByText("Where are you based?")).toBeTruthy();
    fireEvent.changeText(getByLabelText("Your city"), "London");
    fireEvent.press(getByRole("radio", { name: "Remote only" }));
    fireEvent.press(getByText("Done"));

    expect(getByText(/London, Remote only/)).toBeTruthy();
  });

  it("edits the LinkedIn profile URL", () => {
    const { getByLabelText, getByText } = render(<ProfileEditScreen />);

    fireEvent.press(getByLabelText("LinkedIn"));
    expect(getByText("LinkedIn")).toBeTruthy();
    const input = getByLabelText("LinkedIn profile URL");
    fireEvent.changeText(input, "https://www.linkedin.com/in/ada-lovelace");
    fireEvent.press(getByText("Done"));

    expect(getByText("https://www.linkedin.com/in/ada-lovelace")).toBeTruthy();
  });

  it("edits the scheduling link", () => {
    const { getByLabelText, getByPlaceholderText, getByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("Scheduling Link"));
    fireEvent.changeText(
      getByPlaceholderText("https://calendly.com/example"),
      "https://calendly.com/ada",
    );
    fireEvent.press(getByText("Done"));

    expect(getByText("https://calendly.com/ada")).toBeTruthy();
  });
});

describe("ProfileEditScreen number of founders editor", () => {
  it("opens with zero founders and the requested not-selected subheadline", () => {
    const { getByLabelText, getByText } = render(<ProfileEditScreen />);

    fireEvent.press(getByLabelText("Number of Founders"));

    expect(getByText("Number of Founders")).toBeTruthy();
    expect(getByText("Not Selected")).toBeTruthy();
    expect(getByText("How many founders in your team now?")).toBeTruthy();
    expect(getByLabelText("Founder count").props.children).toBe(0);
    expect(
      getByLabelText("Decrease founder count").props.accessibilityState.disabled,
    ).toBe(true);
  });

  it("updates the count and profile row when returning", () => {
    const { getByLabelText, getByText } = render(<ProfileEditScreen />);

    fireEvent.press(getByLabelText("Number of Founders"));
    fireEvent.press(getByLabelText("Increase founder count"));
    fireEvent.press(getByLabelText("Increase founder count"));
    expect(getByLabelText("Founder count").props.children).toBe(2);

    fireEvent.press(getByLabelText("Back"));
    expect(getByText("2")).toBeTruthy();
  });
});

describe("ProfileEditScreen skills and expertise editor", () => {
  it("opens with Not Selected and applies selected skills to the profile", () => {
    const { getByLabelText, getByRole, getByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("Skills & Expertise"));

    expect(getByText("Skills & Expertise")).toBeTruthy();
    expect(getByText("Not Selected")).toBeTruthy();
    expect(getByText("Which of the following skills do you have?")).toBeTruthy();
    expect(getByText("Include skills and expertise that your cofounders own, if applicable")).toBeTruthy();
    expect(
      getByRole("button", { name: "AI/ML" }).props.accessibilityState.selected,
    ).toBe(false);

    fireEvent.press(getByRole("button", { name: "AI/ML" }));
    fireEvent.press(getByRole("button", { name: "Engineering" }));
    fireEvent.press(getByLabelText("Back"));

    expect(getByText("AI/ML, Engineering")).toBeTruthy();
  });
});

describe("ProfileEditScreen equity split editor", () => {
  it("starts unselected and shows the expectation range question for acceptance", () => {
    const { getByLabelText, getByRole, getByText, queryByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("Equity Split"));

    expect(getByText("Equity Split")).toBeTruthy();
    expect(getByText("Not Selected")).toBeTruthy();
    expect(getByText("What’s your equity split expectation?")).toBeTruthy();
    expect(queryByText("What is your equity expectation range?")).toBeNull();

    fireEvent.press(
      getByRole("radio", {
        name: "Willing to accept a specific equity range",
      }),
    );

    expect(getByText("What is your equity expectation range?")).toBeTruthy();
    expect(getByText("Equity Range")).toBeTruthy();
    expect(getByText("10% to 90%")).toBeTruthy();
  });

  it("shows the offer range question only when offering a range is selected", () => {
    const { getByLabelText, getByRole, getByText, queryByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("Equity Split"));
    fireEvent.press(
      getByRole("radio", {
        name: "Willing to offer specific equity range",
      }),
    );

    expect(getByText("What's your equity offer range?")).toBeTruthy();
    expect(queryByText("What is your equity expectation range?")).toBeNull();
  });

  it("saves the selected equity preference on returning to the profile", () => {
    const { getByLabelText, getByRole, getByText } = render(
      <ProfileEditScreen />,
    );

    fireEvent.press(getByLabelText("Equity Split"));
    fireEvent.press(getByRole("radio", { name: "Equal split" }));
    fireEvent.press(getByLabelText("Back"));

    expect(getByText("Equal split")).toBeTruthy();
  });
});

describe("ProfileEditScreen scroll position", () => {
  it("restores the profile scroll position after returning from a sub-screen", () => {
    const { getByLabelText, getByTestId } = render(<ProfileEditScreen />);

    fireEvent.scroll(getByTestId("profile-edit-scroll"), {
      nativeEvent: { contentOffset: { x: 0, y: 420 } },
    });
    fireEvent.press(getByLabelText("Commitment Level"));
    fireEvent.press(getByLabelText("Back"));

    expect(getByTestId("profile-edit-scroll").props.contentOffset).toEqual({
      x: 0,
      y: 420,
    });
  });
});

describe("ProfileEditScreen industries and interests editor", () => {
  it("loads industry pills from the API and saves selected interests", async () => {
    const { findByRole, getByLabelText, getByRole, getByText } = render(
      <ProfileEditScreen firebaseToken="profile-token" />,
    );

    fireEvent.press(getByLabelText("Industries & Interests"));

    expect(await findByRole("button", { name: "Social Networks" })).toBeTruthy();
    expect(getByRole("button", { name: "Travel" })).toBeTruthy();
    expect(getByRole("button", { name: "Wellness" })).toBeTruthy();
    expect(getIndustries).toHaveBeenCalledWith("profile-token");
    expect(getMyProfileIndustries).toHaveBeenCalledWith("profile-token");

    fireEvent.press(getByRole("button", { name: "Social Networks" }));
    fireEvent.press(getByRole("button", { name: "Travel" }));
    fireEvent.press(getByLabelText("Back"));

    expect(getByText("Social Networks, Travel")).toBeTruthy();
  });

  it("preselects industries returned by the user's profile industries API", async () => {
    getMyProfileIndustries.mockResolvedValue([
      {
        id: 2,
        industry_name: "Travel",
        created_at: "2026-10-07T10:00:00Z",
        updated_at: "2026-10-07T10:00:00Z",
      },
    ]);

    const { findByRole, getByLabelText } = render(
      <ProfileEditScreen firebaseToken="profile-token" />,
    );
    fireEvent.press(getByLabelText("Industries & Interests"));

    const selectedPill = await findByRole("button", { name: "Travel" });
    const unselectedPill = await findByRole("button", {
      name: "Social Networks",
    });
    expect(selectedPill.props.accessibilityState.selected).toBe(true);
    expect(unselectedPill.props.accessibilityState.selected).toBe(false);
  });

  it("limits industry selection to five and shows feedback at the limit", async () => {
    getIndustries.mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => ({
        id: index + 1,
        industry_name: `Industry ${index + 1}`,
      })),
    );

    const { findByRole, getByLabelText, getByRole, getByText } = render(
      <ProfileEditScreen firebaseToken="profile-token" />,
    );
    fireEvent.press(getByLabelText("Industries & Interests"));

    await findByRole("button", { name: "Industry 1" });
    for (let index = 1; index <= 5; index += 1) {
      fireEvent.press(getByRole("button", { name: `Industry ${index}` }));
    }
    fireEvent.press(getByRole("button", { name: "Industry 6" }));

    expect(getByText("Sorry. You can select upto 5 industries")).toBeTruthy();
    for (let index = 1; index <= 5; index += 1) {
      expect(
        getByRole("button", { name: `Industry ${index}` }).props
          .accessibilityState.selected,
      ).toBe(true);
    }
    expect(
      getByRole("button", { name: "Industry 6" }).props.accessibilityState
        .selected,
    ).toBe(false);
  });
});

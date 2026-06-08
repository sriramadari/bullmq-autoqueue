import { describe, expect, it } from "vitest";
import { toKebabCase } from "../src/naming";

describe("toKebabCase", () => {
  it("converts camelCase folder names", () => {
    expect(toKebabCase("sendNotificationFollowers")).toBe("send-notification-followers");
    expect(toKebabCase("reelUpload")).toBe("reel-upload");
  });

  it("converts snake/space separators", () => {
    expect(toKebabCase("otp_email")).toBe("otp-email");
    expect(toKebabCase("general email")).toBe("general-email");
  });

  it("handles acronym boundaries", () => {
    expect(toKebabCase("OTPEmail")).toBe("otp-email");
    expect(toKebabCase("sendCSVEmails")).toBe("send-csv-emails");
  });

  it("collapses repeated separators and lowercases", () => {
    expect(toKebabCase("Foo__Bar")).toBe("foo-bar");
    expect(toKebabCase("already-kebab")).toBe("already-kebab");
  });
});

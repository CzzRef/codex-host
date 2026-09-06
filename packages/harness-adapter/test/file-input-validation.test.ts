import { describe, expect, it } from "vitest";

import { validateHostFileInputs } from "../src/index.js";
import type { HostFileInputProbe, HostInput } from "../src/index.js";

const cwd = "/work/repo";
const present: HostFileInputProbe = () => ({ size: 10 });
const missing: HostFileInputProbe = () => undefined;

function file(path: string, mediaType = "image/png", bytes = 10): HostInput {
  return { type: "file", path, mediaType, bytes };
}

const text: HostInput = { type: "text", text: "look" };

describe("Host file input validation", () => {
  it("passes a text-only Turn even when the Session accepts no attachments", () => {
    expect(
      validateHostFileInputs([text], { cwd, capability: undefined, probe: missing }),
    ).toBeUndefined();
  });

  it("rejects the whole Turn when the Session declares no file input", () => {
    const error = validateHostFileInputs([text, file(`${cwd}/a.png`)], {
      cwd,
      capability: undefined,
      probe: present,
    });
    expect(error).toMatchObject({ code: "invalidRequest" });
    expect(error?.message).toContain("does not accept file input");
  });

  it("rejects a Session that declares attachFiles false", () => {
    expect(
      validateHostFileInputs([file(`${cwd}/a.png`)], {
        cwd,
        capability: { attachFiles: false },
        probe: present,
      }),
    ).toMatchObject({ code: "invalidRequest" });
  });

  it("accepts an attachment inside the Thread directory", () => {
    expect(
      validateHostFileInputs([text, file(`${cwd}/shots/a.png`)], {
        cwd,
        capability: { attachFiles: true },
        probe: present,
      }),
    ).toBeUndefined();
  });

  it("rejects a relative path or one that walks up", () => {
    for (const path of ["shots/a.png", `${cwd}/../escape.png`]) {
      expect(
        validateHostFileInputs([file(path)], {
          cwd,
          capability: { attachFiles: true },
          probe: present,
        }),
      ).toMatchObject({ code: "invalidRequest" });
    }
  });

  it("does not treat a sibling directory with the same prefix as inside", () => {
    expect(
      validateHostFileInputs([file("/work/repo-2/a.png")], {
        cwd,
        capability: { attachFiles: true },
        probe: present,
      })?.message,
    ).toContain("outside the Thread directory");
  });

  it("rejects a file that is missing or unreadable", () => {
    expect(
      validateHostFileInputs([file(`${cwd}/gone.png`)], {
        cwd,
        capability: { attachFiles: true },
        probe: missing,
      })?.message,
    ).toContain("missing or unreadable");
  });

  it("enforces the declared media types", () => {
    expect(
      validateHostFileInputs([file(`${cwd}/a.csv`, "text/csv")], {
        cwd,
        capability: { attachFiles: true, mediaTypes: ["image/png"] },
        probe: present,
      })?.message,
    ).toContain("does not accept text/csv");
  });

  it("enforces the declared byte ceiling using the probed size, not the claim", () => {
    expect(
      validateHostFileInputs([file(`${cwd}/a.png`, "image/png", 1)], {
        cwd,
        capability: { attachFiles: true, maxBytes: 5 },
        probe: () => ({ size: 6 }),
      })?.message,
    ).toContain("exceeds the 5 byte limit");
  });

  it("stops at the first bad attachment instead of dispatching the rest", () => {
    const error = validateHostFileInputs(
      [file(`${cwd}/a.png`), file("relative.png"), file(`${cwd}/b.png`)],
      { cwd, capability: { attachFiles: true }, probe: present },
    );
    expect(error?.message).toContain("relative.png");
  });
});

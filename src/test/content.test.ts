import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";

chai.use(sinonChai);
mocha.setup("bdd");

import {
  applyAppendMode,
  findPasteTarget,
  grayLayoutDown,
  showGrayLayout,
} from "../content";

describe("applyAppendMode (#1518)", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    input.type = "password";
    document.body.appendChild(input);
  });

  afterEach(() => {
    document.body.removeChild(input);
  });

  it("appends the code to the input's existing value", () => {
    input.value = "myPassword";
    applyAppendMode(input, "123456");
    expect(input.value).to.eq("myPassword123456");
  });

  it("dispatches input/change events so page scripts observe the update", () => {
    const inputHandler = sinon.fake();
    const changeHandler = sinon.fake();
    input.addEventListener("input", inputHandler);
    input.addEventListener("change", changeHandler);
    applyAppendMode(input, "123456");
    expect(inputHandler).to.have.been.calledOnce;
    expect(changeHandler).to.have.been.calledOnce;
  });

  it("appends to an empty value correctly", () => {
    input.value = "";
    applyAppendMode(input, "654321");
    expect(input.value).to.eq("654321");
  });
});

describe("findPasteTarget (#1423)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("prioritizes an input whose name/id matches an OTP identity keyword over an earlier plain input", () => {
    container.innerHTML = `
      <input type="text" name="username" />
      <input type="text" id="otp-code" />
    `;
    const target = findPasteTarget();
    expect(target?.id).to.eq("otp-code");
  });

  it("excludes password fields from the final fallback when nothing else matches", () => {
    container.innerHTML = `
      <input type="password" name="pw" />
      <input type="text" name="unrelated-visible-field" />
    `;
    const target = findPasteTarget();
    expect(target?.type).to.not.eq("password");
    expect(target?.name).to.eq("unrelated-visible-field");
  });

  it("falls back to the active element when it's a valid input and nothing else matches by identity", () => {
    container.innerHTML = `<input type="text" name="generic" />`;
    const activeInput = container.querySelector("input") as HTMLInputElement;
    activeInput.focus();
    const target = findPasteTarget();
    expect(target).to.eq(activeInput);
  });
});

describe("QR capture overlay event propagation (#1426)", () => {
  let grayLayout: HTMLDivElement;
  let captureBox: HTMLDivElement;

  beforeEach(() => {
    grayLayout = document.createElement("div");
    grayLayout.id = "__ga_grayLayout__";
    captureBox = document.createElement("div");
    captureBox.id = "__ga_captureBox__";
    grayLayout.appendChild(captureBox);
    document.body.appendChild(grayLayout);
  });

  afterEach(() => {
    // Defensive: the second test below swaps `grayLayout` mid-test to
    // point at a real element built by showGrayLayout() (and removes the
    // plain beforeEach fixture up front) -- if that test throws before
    // completing its reassignment, `grayLayout` may already be detached
    // or may be pointing at a node that was already removed. Guard so
    // this hook itself can't mask the real assertion failure with a
    // secondary "not a child of this node" error.
    if (grayLayout && grayLayout.parentNode === document.body) {
      document.body.removeChild(grayLayout);
    }
    const qrCanvas = document.getElementById("__ga_qrCanvas__");
    if (qrCanvas) {
      document.body.removeChild(qrCanvas);
    }
  });

  it("grayLayoutDown does not throw and sets the capture box position", () => {
    const event = new MouseEvent("mousedown", { clientX: 10, clientY: 20 });
    grayLayoutDown(event);
    expect(captureBox.style.display).to.eq("block");
    expect(captureBox.style.left).to.eq("10px");
  });

  it("mousedown/mousemove/mouseup handlers wired via showGrayLayout call stopPropagation", () => {
    // Exercise the REAL production closures, not a reimplementation of
    // them. showGrayLayout() is now exported (same precedent as
    // grayLayoutDown/Move/Up) so it can be called directly here. It only
    // wires up onmousedown/onmousemove/onmouseup/oncontextmenu when its
    // internal `if (!grayLayout)` guard sees no existing
    // "__ga_grayLayout__" element -- so the plain (unwired) fixture the
    // beforeEach above creates has to be removed first, otherwise
    // showGrayLayout() would just reuse it as-is without attaching any
    // handlers at all.
    document.body.removeChild(grayLayout);

    showGrayLayout();

    const wired = document.getElementById(
      "__ga_grayLayout__"
    ) as HTMLDivElement | null;
    expect(wired, "showGrayLayout() should have created a real element").to.not
      .be.null;
    const wiredEl = wired as HTMLDivElement;

    // Hand the real (singleton, guard-protected) element to afterEach
    // immediately, before any assertion below can throw, so cleanup always
    // targets the element actually in the DOM.
    grayLayout = wiredEl;

    // Pull the actual closures showGrayLayout() assigned onto the element
    // (the ones with event.stopPropagation() baked in, from this task's
    // Step 2 fix) and invoke them directly with a mock event carrying a
    // stopPropagation spy -- this calls the production code path itself,
    // not a copy of it.
    const handlerProps = ["onmousedown", "onmousemove", "onmouseup"] as const;

    for (const prop of handlerProps) {
      const handler = wiredEl[prop] as ((event: MouseEvent) => void) | null;
      expect(handler, `${prop} should be wired by showGrayLayout()`).to.not.be
        .null;

      const stopPropagation = sinon.fake();
      const mockEvent = ({
        button: 0,
        clientX: 5,
        clientY: 5,
        stopPropagation,
        preventDefault: sinon.fake(),
      } as unknown) as MouseEvent;

      expect(() =>
        (handler as (event: MouseEvent) => void)(mockEvent)
      ).to.not.throw();
      expect(stopPropagation, `${prop} should call stopPropagation`).to.have
        .been.calledOnce;
    }
  });
});

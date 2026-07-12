import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";

chai.use(sinonChai);
mocha.setup("bdd");

import { applyAppendMode, findPasteTarget } from "../content";

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

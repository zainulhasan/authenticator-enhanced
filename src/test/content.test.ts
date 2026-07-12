import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";

chai.use(sinonChai);
mocha.setup("bdd");

import { applyAppendMode } from "../content";

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

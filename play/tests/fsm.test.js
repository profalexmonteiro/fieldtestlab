import { afterEach, describe, expect, it, vi } from "vitest";
import { createMachine } from "../src/core/fsm.js";
import { clearEvents, emit, on } from "../src/core/events.js";
import { PHASES } from "../src/game/state.js";

afterEach(() => clearEvents());

describe("eventos", () => {
  it("entrega na ordem de inscrição e permite cancelar", () => {
    const got = [];
    const off = on("x", (v) => got.push("a" + v));
    on("x", (v) => got.push("b" + v));
    emit("x", 1); off(); emit("x", 2);
    expect(got).toEqual(["a1", "b1", "b2"]);
  });
});

describe("máquina de estados", () => {
  const make = (opts) => createMachine("t", "a", { a: ["b"], b: ["c"], c: "*" }, opts);
  it("segue as transições permitidas e emite <id>:changed", () => {
    const m = make(), seen = [];
    on("t:changed", (e) => seen.push(`${e.from}>${e.to}`));
    m.go("b").go("c").go("a");
    expect(m.state).toBe("a");
    expect(seen).toEqual(["a>b", "b>c", "c>a"]);
  });
  it("recusa transição inválida e estado desconhecido", () => {
    const m = make();
    expect(() => m.go("c")).toThrow(/a → c/);
    expect(() => m.go("zzz")).toThrow();
    expect(m.state).toBe("a");
  });
  it("modo não estrito só avisa", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = make({ strict: false });
    m.go("c");
    expect(m.state).toBe("c");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it("reentrar no mesmo estado é permitido", () => {
    const m = make();
    expect(m.can("a")).toBe(true);
  });
  it("onChange roda antes do evento; ganchos de saída e entrada na ordem certa", () => {
    const log = []; let mirror = "a";
    const m = make({ onChange: (s) => { mirror = s; log.push("change"); } });
    m.onExit("a", () => log.push("exit a"));
    m.onEnter("b", () => log.push("enter b"));
    on("t:changed", () => log.push("event:" + mirror));
    m.go("b");
    expect(log).toEqual(["exit a", "change", "enter b", "event:b"]);
  });
});

describe("etapas do chamado", () => {
  it("formam um ciclo: enter → board → cabinet → bench → return → report → board", () => {
    const m = createMachine("phase", "enter", PHASES);
    ["board", "cabinet", "bench", "return", "report", "board"].forEach((p) => m.go(p));
    expect(m.state).toBe("board");
    expect(() => m.go("report")).toThrow();
    const n = createMachine("phase", "bench", PHASES);
    expect(() => n.go("report")).toThrow();          // não dá para pular a devolução dos materiais
  });
});

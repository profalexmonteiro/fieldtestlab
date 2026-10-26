import { getLang } from "./i18n.js";

export const $ = (selector) => document.querySelector(selector);

// Creates an element with attributes/properties and children in one call.
export function el(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "className" || key === "textContent" || key === "hidden" || key === "tabIndex" || key === "title" || key === "type" || key === "disabled") {
      element[key] = value;
    } else {
      element.setAttribute(key, value === true ? "" : String(value));
    }
  }
  element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return element;
}

const SVG_NS = "http://www.w3.org/2000/svg";
export function svgEl(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

export const formatSeconds = (value, minimumFractionDigits = 2) =>
  value.toLocaleString(getLang(), { minimumFractionDigits, maximumFractionDigits: 3 });

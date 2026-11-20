import { NETWORK } from "../data/index.js";
import { fieldNetwork } from "../net/network.js";
import { validFieldSamples } from "../rules/field.js";

export function fieldStatus(run) {
  const plan = NETWORK.fieldPlans[run?.ch.id];
  if (!plan) return null;
  const network = fieldNetwork(run.ch.campaign?.criteria);
  const samples = run.fieldSamples;
  const index = validFieldSamples(plan, samples, network);
  return { network, index, points: plan.points, next: plan.points[index], samples: samples.slice(0, index) };
}

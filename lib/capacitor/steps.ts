import { registerPlugin } from "@capacitor/core";

export interface StepsPlugin {
  getTodaySteps(): Promise<{ steps: number }>;
}

const Steps = registerPlugin<StepsPlugin>("Steps");

export default Steps;

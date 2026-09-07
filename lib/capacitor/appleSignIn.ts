import { registerPlugin } from "@capacitor/core";

export interface AppleSignInResult {
  identityToken: string;
  authorizationCode?: string;
  user: string;
  email?: string;
  givenName?: string;
  familyName?: string;
}

export interface AppleSignInNativePlugin {
  signIn(): Promise<AppleSignInResult>;
}

const AppleSignInNative = registerPlugin<AppleSignInNativePlugin>("AppleSignInNative");

export default AppleSignInNative;

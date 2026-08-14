const REMEMBERED_LOGIN_ID_KEY = "devnote-auth:remembered-login-id";
const AUTO_LOGIN_PREFERENCE_KEY = "devnote-auth:auto-login";

export interface LoginPreferences {
  loginId: string;
  rememberLoginId: boolean;
  autoLogin: boolean;
}

export const readLoginPreferences = (): LoginPreferences => {
  const loginId = localStorage.getItem(REMEMBERED_LOGIN_ID_KEY)?.slice(0, 100) ?? "";
  const autoLogin = localStorage.getItem(AUTO_LOGIN_PREFERENCE_KEY) === "true";
  return { loginId, rememberLoginId: Boolean(loginId), autoLogin };
};

export const saveLoginPreferences = (preferences: LoginPreferences): void => {
  const normalizedLoginId = preferences.loginId.trim().slice(0, 100);
  if ((preferences.rememberLoginId || preferences.autoLogin) && normalizedLoginId) localStorage.setItem(REMEMBERED_LOGIN_ID_KEY, normalizedLoginId);
  else localStorage.removeItem(REMEMBERED_LOGIN_ID_KEY);

  if (preferences.autoLogin) localStorage.setItem(AUTO_LOGIN_PREFERENCE_KEY, "true");
  else localStorage.removeItem(AUTO_LOGIN_PREFERENCE_KEY);
};

export const disableAutoLoginPreference = (): LoginPreferences => {
  const preferences = readLoginPreferences();
  const nextPreferences = { ...preferences, autoLogin: false };
  saveLoginPreferences(nextPreferences);
  return nextPreferences;
};

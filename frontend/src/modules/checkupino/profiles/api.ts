import { checkupinoTransport } from "../api/transport";
import { checkupinoApi } from "../query/api";
import { adaptPanelProfile, type PanelProfile } from "./contracts";

export const validProfileId = (value: string) => /^[0-9a-hjkmnp-tv-z]{26}$/i.test(value);
export const profilePath = (target: string | null) => {
  if (target !== null && !validProfileId(target)) throw new TypeError("Invalid profile reference.");
  return target === null ? "/api/panel-profile" : `/api/admin/users/${target}/support-profile`;
};
export const profileApi = checkupinoApi.injectEndpoints({
  endpoints: (builder) => ({
    panelProfile: builder.query<PanelProfile, string | null>({
      keepUnusedDataFor: 0,
      query: (target) => ({ method: "GET", path: profilePath(target) }),
      providesTags: (_result, _error, target) => [{ type: "AdminUsers", id: target ?? "SELF" }],
      transformResponse: (wire: unknown, _meta, target) => {
        const profile = adaptPanelProfile(wire);
        if (
          profile.mode !== (target === null ? "self" : "support") ||
          (target !== null && profile.user.public_id.toLowerCase() !== target.toLowerCase())
        ) {
          throw new TypeError("Profile response does not match the requested subject.");
        }
        return profile;
      },
    }),
  }),
});
export const { usePanelProfileQuery } = profileApi;

export const readProfile = async (target: string | null, signal?: AbortSignal) => {
  const response = await checkupinoTransport.request<unknown>({
    method: "GET",
    path: profilePath(target),
    signal,
  });
  const profile = adaptPanelProfile(response.data);
  if (
    profile.mode !== (target === null ? "self" : "support") ||
    (target !== null && profile.user.public_id.toLowerCase() !== target.toLowerCase())
  ) {
    throw new TypeError("Profile response does not match the requested subject.");
  }
  return profile;
};

export const saveProfileName = async (
  target: string | null,
  body: {
    readonly first_name: string;
    readonly last_name: string;
    readonly reason: string;
    readonly expected_revision: string;
  },
  signal?: AbortSignal,
) => {
  // Construct a fresh allowlisted payload; never forward a DTO or form object wholesale.
  return checkupinoTransport.request<unknown>({
    method: "PUT",
    path: profilePath(target),
    signal,
    body: {
      first_name: body.first_name,
      last_name: body.last_name,
      reason: body.reason,
      expected_revision: body.expected_revision,
    },
  });
};

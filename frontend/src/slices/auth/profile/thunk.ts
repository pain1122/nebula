import { profileError, resetProfileFlagChange } from "./reducer";
import type { AppDispatch } from "../../../store";

export const editProfile =
  () => async (dispatch: AppDispatch) => {
    dispatch(profileError(
      "Profile editing is not connected to Laravel yet."
    ));
  };

export const resetProfileFlag = () => {
  try {
    return resetProfileFlagChange();
  } catch (error) {
    return error;
  }
};
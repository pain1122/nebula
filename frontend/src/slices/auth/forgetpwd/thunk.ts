import { userForgetPasswordError } from "./reducer";
import type { AppDispatch } from "../../../store";

type ForgetPasswordValues = {
  email: string;
};

type Navigate = (path: string) => void;

export const userForgetPassword =
  (_user: ForgetPasswordValues, _history?: Navigate) =>
  async (dispatch: AppDispatch) => {
    dispatch(userForgetPasswordError(
      "Password reset is not connected to Laravel yet."
    ));
  };

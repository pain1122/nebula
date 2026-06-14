import {
  registerUserFailed,
  resetRegisterFlagChange,
} from "./reducer";
import type { AppDispatch } from "../../../store";

type RegisterValues = {
  email: string;
  first_name: string;
  password: string;
  confirm_password: string;
};

export const registerUser =
  (_user: RegisterValues) =>
  async (dispatch: AppDispatch) => {
    dispatch(registerUserFailed(
      "Admin registration is not connected to Laravel yet."
    ));
  };

export const resetRegisterFlag = () => {
  try {
    return resetRegisterFlagChange();
  } catch (error) {
    return error;
  }
};

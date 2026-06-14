//Include Both Helper File with needed methods
import { getFirebaseBackend } from "../../../helpers/firebase_helper";
import {
  postFakeRegister,
  postJwtRegister,
} from "../../../helpers/fakebackend_helper";

// action
import {
  registerUserSuccessful,
  registerUserFailed,
  resetRegisterFlagChange,
} from "./reducer";

// initialize relavant method of both Auth
const fireBaseBackend :any= getFirebaseBackend();

// Is user register successfull then direct plot user in redux.
export const registerUser = (user:any) => async (dispatch:any) => {
  try {
    let response;

    if (import.meta.env.VITE_DEFAULT_AUTH === "firebase") {
      response = fireBaseBackend.registerUser(user.email, user.password);
      // yield put(registerUserSuccessful(response));
    } else if (import.meta.env.VITE_DEFAULT_AUTH === "jwt") {
      response = postJwtRegister('/post-jwt-register', user);
      // yield put(registerUserSuccessful(response));
    } else if (import.meta.env.VITE_API_BASE_URL) {
      response = postFakeRegister(user);
      const data :any= await response;

      if (data.message === "success") {
        dispatch(registerUserSuccessful(data));
      } else {
        dispatch(registerUserFailed(data));
      }
    }
  } catch (error) {
    dispatch(registerUserFailed(error));
  }
};

export const resetRegisterFlag = () => {
  try {
    const response = resetRegisterFlagChange();
    return response;
  } catch (error) {
    return error;
  }
};


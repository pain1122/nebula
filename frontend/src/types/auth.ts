export type {
  AuthUser,
  LoginCredentials,
  RoleName,
} from "../modules/checkupino/auth/types";

export interface LoginFormValues {
    email: string;
    password: string;
    remember?: boolean;
};

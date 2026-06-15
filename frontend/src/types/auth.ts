export type RoleName = "root-admin" | "admin" | "doctor" | "patient";

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    roles: RoleName[];
    doctor_profile: unknown | null;
}

export interface LoginCredentials {
    email: string;
    password: string;
    remember?: boolean;
}

export interface LoginFormValues {
    email: string;
    password: string;
    remember?: boolean;
};
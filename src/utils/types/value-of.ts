export type ValueOf<T extends object> = T extends unknown ? T[keyof T] : never;

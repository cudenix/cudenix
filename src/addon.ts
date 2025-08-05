export type Addon = (...options: any[]) => string | Promise<string>;

export interface AddonOptions {
	compile?: "AFTER" | "BEFORE" | false;
}

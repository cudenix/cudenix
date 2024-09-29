export type WSData =
	| Record<
			"close" | "drain" | "message" | "open",
			((...options: any[]) => any) | undefined
	  >
	| undefined;

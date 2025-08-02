export const merge = (
	object1: Record<PropertyKey, unknown>,
	object2: Record<PropertyKey, unknown>,
) => {
	const keys = Object.keys(object2);

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];

		if (!key) {
			continue;
		}

		object1[key] = object2[key];
	}

	return object1;
};

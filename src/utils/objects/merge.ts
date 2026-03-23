export const merge = (
	object1: Record<PropertyKey, unknown>,
	object2: Record<PropertyKey, unknown>,
) => {
	const keys = Object.keys(object2);

	if (keys.length <= 8) {
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];

			if (!key) {
				continue;
			}

			object1[key] = object2[key];
		}

		return object1;
	}

	return Object.assign(object1, object2);
};

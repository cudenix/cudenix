export const merge = (
	object1: Record<PropertyKey, unknown>,
	object2: Record<PropertyKey, unknown>,
) => {
	const keys = Object.keys(object2);

	for (let i = 0; i < keys.length; i++) {
		object1[keys[i]] = object2[keys[i]];
	}

	return object1;
};

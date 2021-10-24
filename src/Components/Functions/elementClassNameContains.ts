export const elementClassNameContains = (
	element: Element | null,
	match: RegExp
): boolean => {
	return new RegExp(match).test(element?.className);
};


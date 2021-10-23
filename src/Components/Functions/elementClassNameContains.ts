export const elementClassNameContains = (element: Element | null, match: RegExp): boolean => {
	return element?.className.split(' ').some(match.test)
}

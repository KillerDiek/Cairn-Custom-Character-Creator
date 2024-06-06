export async function preloadTemplates() {
	const templatePaths = [
		"modules/cairn-custom-character-creation/templates/forms/Settings.html"
	];
	return loadTemplates(templatePaths);
}
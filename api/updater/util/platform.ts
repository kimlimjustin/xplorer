export enum AVAILABLE_PLATFORMS {
	MacOS = 'darwin',
	Win32 = 'win32',
	Win64 = 'win64',
	Linux = 'linux',
}

export function validatePlatform(platform: string): string | undefined {
	switch (platform) {
		case AVAILABLE_PLATFORMS.MacOS:
		case AVAILABLE_PLATFORMS.Win32:
		case AVAILABLE_PLATFORMS.Win64:
		case AVAILABLE_PLATFORMS.Linux:
			return platform;
	}
}

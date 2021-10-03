export default interface fileData {
	name: string;
	isDir: boolean;
	isHidden: boolean;
	createdAt?: string | Date;
	modifiedAt?: string | Date;
	accessedAt?: string | Date;
	size?: number;
	isSystemFile?: boolean;
	isTrash?: boolean;
	type?: string;
	path?: string;
	realPath?: string;
	trashDeletionDate?: string | Date;
	displayName?: string;
}

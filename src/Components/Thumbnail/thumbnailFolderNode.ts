class ThumbnailFolderNode {
	public _ch: string;
	public _icon: string;
	public _isLeaf: boolean;
	public _children: ThumbnailFolderNode[];

	constructor(ch: string) {
		this._ch = ch;
		this._children = [];
	}
}

export default ThumbnailFolderNode;

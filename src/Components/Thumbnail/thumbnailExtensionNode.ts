class ThumbnailExtensionNode {
	public _ch: string;
	public _icon: string;
	public _isLeaf: boolean;
	public _children: ThumbnailExtensionNode[];

	constructor(ch: string) {
		this._ch = ch;
		this._children = [];
	}
}

export default ThumbnailExtensionNode;

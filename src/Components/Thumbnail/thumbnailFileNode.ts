class ThumbnailFileNode {
	public _ch: string;
	public _icon: string;
	public _isLeaf: boolean;
	public _children: ThumbnailFileNode[];

	constructor(ch: string) {
		this._ch = ch;
		this._children = [];
	}
}

export default ThumbnailFileNode;
